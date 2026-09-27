export interface TextChunk {
  text: string;
  index: number;
  /** 1-based page where this chunk starts */
  pageStart: number;
  /** 1-based page where this chunk ends */
  pageEnd: number;
  /** The section heading this chunk belongs to (if detected) */
  section?: string;
}

export interface PageText {
  /** 1-based page number */
  pageNum: number;
  text: string;
}

const CHUNK_TARGET_TOKENS = 600;
const CHUNK_OVERLAP_TOKENS = 80;
const CHARS_PER_TOKEN = 4; // rough approximation for English legal text

/**
 * Unified regex to detect legal section headings in Indian legal documents.
 * Used BOTH for paragraph splitting AND for heading tracking.
 *
 * Matches patterns like:
 *   "Section 144 —", "Sec. 377", "Article 21", "Clause 4.2",
 *   "ISSUE NO. 1", "ORDER", "JUDGMENT", "HELD:", "FACTS",
 *   "I. Background", "II. Arguments", "III. Analysis"
 */
const HEADING_REGEX = /^(?:(?:Section|Sec\.|Article|Clause|Sub-section|Part|Chapter|Schedule|Annexure|Appendix)\s+[\d\w.()]+|(?:ORDER|JUDGMENT|JUDGEMENT|HELD|FACTS|ISSUE(?:\s*NO\.?\s*\d+)?|PRAYER|ARGUMENTS?|ANALYSIS|DISCUSSION|CONCLUSION|DISPOSITION|BACKGROUND|PROCEDURAL\s*HISTORY|PRELIMINARY|OPERATIVE\s*PART)[\s:—-]*$|[IVXLCDM]+\.\s+\w)/im;

/** Single source of truth for heading detection — used everywhere. */
function isHeadingLine(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 0 && trimmed.length < 120 && HEADING_REGEX.test(trimmed);
}

/**
 * Splits extracted PDF text into overlapping chunks, preferring to break on
 * paragraph or section boundaries rather than mid-sentence.
 *
 * Legal-aware: splits on Section, Sec., Article, Clause, Sub-section headings
 * and numbered items. Case-insensitive for Indian legal abbreviations.
 *
 * Context-enriched: prepends current section heading to each chunk so
 * embeddings capture structural context (not just raw text).
 *
 * Bug fixes over previous version:
 *   - Heading tracking: flush old buffer BEFORE updating currentHeading
 *   - No filename in embedding text (unreliable for legal corpus)
 *   - Unified HEADING_REGEX for both splitting and tracking
 *
 * Accepts per-page text so that each chunk knows which pages it spans.
 */
export function chunkText(fullText: string, pages?: PageText[], _fileName?: string): TextChunk[] {
  const targetChars = CHUNK_TARGET_TOKENS * CHARS_PER_TOKEN;
  const overlapChars = CHUNK_OVERLAP_TOKENS * CHARS_PER_TOKEN;

  // ── Build a char-offset → page lookup ──────────────────────
  const pageOffsets: Array<{ start: number; end: number; pageNum: number }> = [];
  if (pages && pages.length > 0) {
    let offset = 0;
    for (const p of pages) {
      const len = p.text.length;
      pageOffsets.push({ start: offset, end: offset + len, pageNum: p.pageNum });
      offset += len + 2; // +2 accounts for the \n\n between pages in fullText
    }
  }

  function findPage(charPos: number): number {
    if (pageOffsets.length === 0) return 1;
    for (const po of pageOffsets) {
      if (charPos >= po.start && charPos < po.end) return po.pageNum;
    }
    // Past the end → last page
    return pageOffsets[pageOffsets.length - 1].pageNum;
  }

  // ── Flush helper: pushes current buffer as a chunk ─────────
  function flushBuffer() {
    if (!buffer.trim()) return;

    const contextPrefix = currentHeading ? `[Section: ${currentHeading}]\n\n` : '';
    const enrichedText = contextPrefix + buffer.trim();

    const pageStart = findPage(bufferStartChar);
    const pageEnd = findPage(bufferStartChar + buffer.length - 1);
    chunks.push({
      text: enrichedText,
      index: chunks.length,
      pageStart,
      pageEnd,
      section: currentHeading || undefined,
    });

    // carry the tail of the previous chunk forward for overlap
    const overlapStart = buffer.length - overlapChars;
    bufferStartChar = bufferStartChar + Math.max(0, overlapStart);
    buffer = buffer.slice(-overlapChars);
  }

  // ── Paragraph splitting ────────────────────────────────────
  // Split on double newlines (natural paragraph boundaries).
  // Heading-based splitting is handled in the loop via isHeadingLine()
  // which uses the SAME HEADING_REGEX — no mismatch.
  const paragraphs = fullText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: TextChunk[] = [];
  let buffer = '';
  let bufferStartChar = 0; // char position in fullText where buffer starts
  let cursor = 0; // running char position as we consume paragraphs
  let currentHeading = ''; // track the most recent section heading

  for (const para of paragraphs) {
    // Find where this paragraph starts in fullText
    const paraStart = fullText.indexOf(para, cursor);
    if (paraStart >= 0) cursor = paraStart;

    // Detect if this paragraph starts with a section heading
    const firstLine = para.split('\n')[0].trim();
    const isHeading = isHeadingLine(firstLine);

    // FIX: If we hit a new heading, flush the old buffer FIRST
    // so the old chunk gets the OLD heading, not the new one.
    if (isHeading && buffer.trim()) {
      flushBuffer();
      currentHeading = firstLine;
      // Start fresh buffer with this paragraph
      bufferStartChar = cursor;
      buffer = para;
    } else if (buffer.length + para.length > targetChars && buffer.length > 0) {
      // Buffer is full — flush it
      flushBuffer();
      buffer = (buffer ? buffer + '\n\n' : '') + para;
      if (!buffer.startsWith(para)) {
        // buffer has overlap prefix, keep bufferStartChar as set by flushBuffer
      } else {
        bufferStartChar = cursor;
      }
    } else {
      if (buffer.length === 0) bufferStartChar = cursor;
      buffer += (buffer ? '\n\n' : '') + para;
    }

    // Update heading if detected (for non-flushing case)
    if (isHeading) {
      currentHeading = firstLine;
    }

    cursor += para.length;
  }

  // Flush remaining buffer
  flushBuffer();

  return chunks;
}
