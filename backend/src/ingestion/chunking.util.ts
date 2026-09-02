export interface TextChunk {
  text: string;
  index: number;
  /** 1-based page where this chunk starts */
  pageStart: number;
  /** 1-based page where this chunk ends */
  pageEnd: number;
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
 * Splits extracted PDF text into overlapping chunks, preferring to break on
 * paragraph or section boundaries rather than mid-sentence.
 *
 * Legal-aware: splits on Section, Sec., Article, Clause, Sub-section headings
 * and numbered items. Case-insensitive for Indian legal abbreviations.
 *
 * Accepts per-page text so that each chunk knows which pages it spans.
 */
export function chunkText(fullText: string, pages?: PageText[]): TextChunk[] {
  const targetChars = CHUNK_TARGET_TOKENS * CHARS_PER_TOKEN;
  const overlapChars = CHUNK_OVERLAP_TOKENS * CHARS_PER_TOKEN;

  // ── Build a char-offset → page lookup ──────────────────────
  // Each entry: [startCharOffset, pageNum]
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

  const paragraphs = fullText
    .split(/\n\s*\n|\n(?=(?:Section|Sec\.|Article|Clause|Sub-section|\d+\.)\s)/gi)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: TextChunk[] = [];
  let buffer = '';
  let bufferStartChar = 0; // char position in fullText where buffer starts
  let cursor = 0; // running char position as we consume paragraphs

  for (const para of paragraphs) {
    // Find where this paragraph starts in fullText
    const paraStart = fullText.indexOf(para, cursor);
    if (paraStart >= 0) cursor = paraStart;

    if (buffer.length + para.length > targetChars && buffer.length > 0) {
      const pageStart = findPage(bufferStartChar);
      const pageEnd = findPage(bufferStartChar + buffer.length - 1);
      chunks.push({ text: buffer.trim(), index: chunks.length, pageStart, pageEnd });

      // carry the tail of the previous chunk forward so context isn't lost at the boundary
      const overlapStart = buffer.length - overlapChars;
      bufferStartChar = bufferStartChar + Math.max(0, overlapStart);
      buffer = buffer.slice(-overlapChars) + '\n\n' + para;
    } else {
      if (buffer.length === 0) bufferStartChar = cursor;
      buffer += (buffer ? '\n\n' : '') + para;
    }

    cursor += para.length;
  }

  if (buffer.trim()) {
    const pageStart = findPage(bufferStartChar);
    const pageEnd = findPage(bufferStartChar + buffer.length - 1);
    chunks.push({ text: buffer.trim(), index: chunks.length, pageStart, pageEnd });
  }

  return chunks;
}
