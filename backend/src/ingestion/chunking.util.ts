export interface TextChunk {
  text: string;
  index: number;
  /** 1-based page where this chunk starts */
  pageStart: number;
  /** 1-based page where this chunk ends */
  pageEnd: number;

  /** Structural hierarchy for Legislation / Acts only (e.g. "Chapter II", "Section 138") */
  chapter?: string;
  section?: string;
  sectionHeading?: string;
  subsection?: string;
  clause?: string;

  /** Structural heading for Judgments / Orders / Filings (e.g. "Facts", "Court Analysis", "Operative Order") */
  heading?: string;

  /** Paragraph numbers present in this chunk (e.g. "14" or "14-16", and [14, 15, 16]) */
  paragraphNumber?: string;
  paragraphNumbers?: number[];

  /** Laws, sections, or articles cited/referenced in this chunk (e.g. ["Section 138", "Article 21"]) */
  legalReferences: string[];

  /** Breadcrumb hierarchy path */
  parentPath: string[];

  /** True if this chunk continues an oversized section or paragraph */
  isContinuation: boolean;
  /** Estimated token count for BGE-M3 */
  tokenCount: number;
}

export interface PageText {
  /** 1-based page number */
  pageNum: number;
  text: string;
}

export interface ChunkingOptions {
  fileName?: string;
  docType?: string;
  docSubtype?: string;
  targetTokens?: number;
  maxTokens?: number;
  overlapTokens?: number;
}

const DEFAULT_TARGET_TOKENS = 600;
const DEFAULT_MAX_TOKENS = 800;
const DEFAULT_OVERLAP_TOKENS = 80;
const CHARS_PER_TOKEN = 4; // BGE-M3 approximation: ~4 chars per token for legal text

/**
 * Regex patterns for Indian legal document hierarchy
 */
const CHAPTER_REGEX = /^(?:CHAPTER|PART)\s+([IVXLCDM\d]+[A-Z]?)(?:\s*[:—-]\s*([^\n]+))?/i;
const SECTION_REGEX = /^(?:Section|Sec\.|Article|Art\.)\s+(\d+[A-Z]?)(?:\s*[:—-]\s*([^\n]+))?/i;
const SUBSECTION_REGEX = /^\s*\((\d+)\)\s+([^\n]+)/;
const CLAUSE_REGEX = /^\s*\(([a-z])\)\s+([^\n]+)/i;
const SCHEDULE_REGEX = /^(?:SCHEDULE|ANNEXURE|APPENDIX)\s+([IVXLCDM\d]+[A-Z]?)(?:\s*[:—-]\s*([^\n]+))?/i;

/**
 * Headings belonging to Court Judgments / Orders
 */
const JUDGMENT_SECTION_REGEX = /^(?:(?:I|II|III|IV|V|VI|VII|VIII|IX|X)\.\s+([^\n]+)|(?:JUDGMENT|JUDGEMENT|ORDER|FACTS|ISSUES?|ARGUMENTS?|ANALYSIS|DISCUSSION|FINDINGS?|CONCLUSION|DISPOSITION|OPERATIVE\s*PART|HELD|PRELIMINARY|BACKGROUND)[\s:—-]*$)/im;

/**
 * Unified regex to detect legal headings for paragraph splitting
 */
const ANY_HEADING_REGEX = /^(?:(?:Section|Sec\.|Article|Clause|Sub-section|Part|Chapter|Schedule|Annexure|Appendix)\s+[\d\w.()]+|(?:ORDER|JUDGMENT|JUDGEMENT|HELD|FACTS|ISSUE(?:\s*NO\.?\s*\d+)?|PRAYER|ARGUMENTS?|ANALYSIS|DISCUSSION|CONCLUSION|DISPOSITION|BACKGROUND|PROCEDURAL\s*HISTORY|PRELIMINARY|OPERATIVE\s*PART)[\s:—-]*$|[IVXLCDM]+\.\s+\w)/im;

/**
 * Regex to extract referenced laws / sections cited inside the text
 */
const CITED_LAW_REGEX = /\b(?:(?:Section|Sec\.|Article|Art\.)\s+\d+[A-Z]?(?:\s*\([0-9a-z]+\))?|(?:Order\s+[IVXLCDM\d]+\s+Rule\s+\d+)|(?:IPC|CrPC|BNS|BNSS|CPC|Constitution\s+of\s+India|Negotiable\s+Instruments\s+Act|Companies\s+Act|Arbitration\s+Act))\b/gi;

function isHeadingLine(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 0 && trimmed.length < 120 && ANY_HEADING_REGEX.test(trimmed);
}

function extractLegalReferences(text: string): string[] {
  const matches = text.match(CITED_LAW_REGEX) || [];
  const unique = Array.from(new Set(matches.map((m) => m.trim().replace(/\s+/g, ' '))));
  return unique.slice(0, 10); // keep top 10 unique cited laws per chunk
}

/**
 * Paragraph numbering in court judgments and orders:
 * e.g. "1. ", "12. ", "[14] ", "Para 5: ", "Paragraph 10. "
 */
const PARA_NUM_REGEX = /^(?:\[(\d+)\]|(\d+)\.|\b(?:Para|Paragraph|para)\s*(\d+)[:.]?)\s+/i;

function extractParagraphNumber(firstLine: string): number | undefined {
  const match = firstLine.match(PARA_NUM_REGEX);
  if (!match) return undefined;
  const numStr = match[1] || match[2] || match[3];
  const num = parseInt(numStr, 10);
  return Number.isNaN(num) ? undefined : num;
}

/**
 * Estimates token count for BGE-M3 (word count * 1.35 factor)
 */
function estimateTokens(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words * 1.35));
}

/**
 * Splits text into sentences cleanly along legal delimiters (. , ; , \n)
 */
function splitIntoSentences(text: string): string[] {
  const rawSentences = text
    .split(/(?<=[.?!;])\s+(?=[A-Z0-9("']|\(\d+\)|\([a-z]\))/g)
    .map((s) => s.trim())
    .filter(Boolean);

  if (rawSentences.length <= 1) {
    return text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  }
  return rawSentences;
}

/**
 * Calculates a clean sentence-boundary overlap without cutting mid-word or mid-sentence.
 */
function getSentenceOverlap(text: string, maxOverlapChars: number): string {
  if (text.length <= maxOverlapChars) return text;
  const tail = text.slice(-maxOverlapChars);
  const match = tail.search(/[.!?]\s+[A-Z0-9(]/);
  if (match !== -1 && match < tail.length - 20) {
    return tail.slice(match + 2).trim();
  }
  const spaceMatch = tail.indexOf(' ');
  if (spaceMatch !== -1) {
    return tail.slice(spaceMatch + 1).trim();
  }
  return tail.trim();
}

/**
 * Document-Aware Legal Chunker:
 *  - Distinguishes structural section (Acts only) from judicial headings (Judgments).
 *  - Extracts cited laws/statutes into `legalReferences`.
 *  - Slices oversized paragraphs along clean sentence boundaries (never exceeds max tokens).
 *  - Adds hierarchical breadcrumbs to each chunk.
 *  - Accurate page mapping without fragile indexOf lookups.
 *  - Clean sentence-level overlap.
 */
export function chunkText(
  fullText: string,
  pages?: PageText[],
  options?: ChunkingOptions,
): TextChunk[] {
  const targetChars = (options?.targetTokens || DEFAULT_TARGET_TOKENS) * CHARS_PER_TOKEN;
  const overlapChars = (options?.overlapTokens || DEFAULT_OVERLAP_TOKENS) * CHARS_PER_TOKEN;

  // Determine document family
  const docTypeStr = (options?.docType || '').toLowerCase();
  const isStatute = ['central_act', 'state_act', 'rules_regulations', 'amendment', 'bare_act', 'statute'].includes(docTypeStr);
  const isJudgmentOrOrder = ['court_judgment', 'court_order', 'tribunal_order', 'petition', 'application'].includes(docTypeStr);

  // ── 1. Build character-offset to page-number lookup ─────────────
  const pageOffsets: Array<{ start: number; end: number; pageNum: number }> = [];
  if (pages && pages.length > 0) {
    let offset = 0;
    for (const p of pages) {
      const len = p.text.length;
      pageOffsets.push({ start: offset, end: offset + len, pageNum: p.pageNum });
      offset += len + 2; // accounts for \n\n between pages
    }
  }

  function findPage(charPos: number): number {
    if (pageOffsets.length === 0) return 1;
    for (const po of pageOffsets) {
      if (charPos >= po.start && charPos <= po.end) return po.pageNum;
    }
    return pageOffsets[pageOffsets.length - 1].pageNum;
  }

  // ── 2. Paragraph & structure detection ─────────────────────────
  const rawParagraphs = fullText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: TextChunk[] = [];

  // Structural tracking state
  let currentChapter: string | undefined = undefined;
  let currentSection: string | undefined = undefined;
  let currentSectionHeading: string | undefined = undefined;
  let currentSubsection: string | undefined = undefined;
  let currentClause: string | undefined = undefined;
  let currentHeading: string | undefined = undefined;
  let currentChunkParagraphs: number[] = [];

  let buffer = '';
  let bufferStartChar = 0;
  let cursor = 0;
  let isContinuation = false;

  function buildParentPath(): string[] {
    const path: string[] = [];
    if (isStatute) {
      if (currentChapter) path.push(currentChapter);
      if (currentSection) {
        const secLabel = `Section ${currentSection}${currentSectionHeading ? `: ${currentSectionHeading}` : ''}`;
        path.push(secLabel);
      }
      if (currentSubsection) path.push(currentSubsection);
      if (currentClause) path.push(currentClause);
    } else {
      // In judgments/orders, parentPath reflects judicial parts (Facts, Analysis, Order)
      if (currentHeading) path.push(currentHeading);
    }
    return path;
  }

  function buildBreadcrumbPrefix(continuation: boolean, paraNumberStr?: string): string {
    const path = buildParentPath();
    const parts = [...path];
    if (paraNumberStr && !isStatute) {
      parts.push(`Para ${paraNumberStr}`);
    }
    if (parts.length === 0) return '';
    const breadcrumb = parts.join(' > ');
    return continuation ? `[${breadcrumb} (Continued)]\n\n` : `[${breadcrumb}]\n\n`;
  }

  function flushBuffer(continuationFlag = false) {
    if (!buffer.trim()) return;

    const paraNumbers = [...currentChunkParagraphs];
    let paraNumberStr: string | undefined = undefined;
    if (paraNumbers.length === 1) {
      paraNumberStr = String(paraNumbers[0]);
    } else if (paraNumbers.length > 1) {
      paraNumberStr = `${paraNumbers[0]}-${paraNumbers[paraNumbers.length - 1]}`;
    }

    const prefix = buildBreadcrumbPrefix(continuationFlag, paraNumberStr);
    const enrichedText = prefix + buffer.trim();

    const pageStart = findPage(bufferStartChar);
    const pageEnd = findPage(Math.max(bufferStartChar, bufferStartChar + buffer.length - 1));

    // Extract cited laws/sections mentioned in this chunk
    const legalReferences = extractLegalReferences(enrichedText);

    chunks.push({
      text: enrichedText,
      index: chunks.length,
      pageStart,
      pageEnd,
      // Rule applied: section/chapter only set for statutes; heading set for judgments
      chapter: isStatute ? currentChapter : undefined,
      section: isStatute ? currentSection : undefined,
      sectionHeading: isStatute ? currentSectionHeading : undefined,
      subsection: isStatute ? currentSubsection : undefined,
      clause: isStatute ? currentClause : undefined,
      heading: isJudgmentOrOrder || !isStatute ? currentHeading : undefined,
      paragraphNumber: paraNumberStr,
      paragraphNumbers: paraNumbers.length > 0 ? paraNumbers : undefined,
      legalReferences,
      parentPath: buildParentPath(),
      isContinuation: continuationFlag,
      tokenCount: estimateTokens(enrichedText),
    });

    // Clean sentence overlap
    const overlapText = getSentenceOverlap(buffer, overlapChars);
    const overlapLen = overlapText.length;
    bufferStartChar = bufferStartChar + Math.max(0, buffer.length - overlapLen);
    buffer = overlapText;
    currentChunkParagraphs = overlapText.length > 0 && paraNumbers.length > 0 ? [paraNumbers[paraNumbers.length - 1]] : [];
  }

  // ── 3. Iterate through paragraphs with structural awareness ─────
  for (const para of rawParagraphs) {
    const paraStart = cursor;
    const firstLine = para.split('\n')[0].trim();
    const paraNum = extractParagraphNumber(firstLine);
    if (paraNum !== undefined && !currentChunkParagraphs.includes(paraNum)) {
      currentChunkParagraphs.push(paraNum);
    }

    const chapterMatch = firstLine.match(CHAPTER_REGEX);
    const sectionMatch = firstLine.match(SECTION_REGEX);
    const subMatch = firstLine.match(SUBSECTION_REGEX);
    const clauseMatch = firstLine.match(CLAUSE_REGEX);
    const scheduleMatch = firstLine.match(SCHEDULE_REGEX);
    const judgmentMatch = firstLine.match(JUDGMENT_SECTION_REGEX);

    // Structural boundary condition
    const isNewSectionOrChapter = isStatute
      ? Boolean(chapterMatch || sectionMatch || scheduleMatch)
      : Boolean(judgmentMatch || (isHeadingLine(firstLine) && !sectionMatch));

    if (isNewSectionOrChapter && buffer.trim()) {
      flushBuffer(isContinuation);
      isContinuation = false;
      buffer = '';
      currentChunkParagraphs = [];
    }

    // ── Update active hierarchy according to document family ──────
    if (isStatute) {
      // In Bare Acts / Statutes: section and chapter are structural
      if (chapterMatch) {
        currentChapter = `Chapter ${chapterMatch[1]}${chapterMatch[2] ? `: ${chapterMatch[2].trim()}` : ''}`;
        currentSection = undefined;
        currentSectionHeading = undefined;
        currentSubsection = undefined;
        currentClause = undefined;
      }
      if (sectionMatch) {
        currentSection = sectionMatch[1];
        currentSectionHeading = sectionMatch[2] ? sectionMatch[2].trim() : undefined;
        currentSubsection = undefined;
        currentClause = undefined;
      }
      if (subMatch) {
        currentSubsection = `Subsection (${subMatch[1]})`;
      }
      if (clauseMatch) {
        currentClause = `Clause (${clauseMatch[1]})`;
      }
      if (scheduleMatch) {
        currentChapter = `Schedule ${scheduleMatch[1]}`;
        currentSection = undefined;
        currentSectionHeading = undefined;
      }
    } else {
      // In Judgments / Orders: heading reflects judicial structure
      if (judgmentMatch) {
        currentHeading = judgmentMatch[0].trim();
      } else if (isHeadingLine(firstLine) && !sectionMatch) {
        currentHeading = firstLine;
      }
    }

    // ── 4. Handle Oversized Paragraphs (> targetChars) ─────────────
    if (para.length > targetChars) {
      if (buffer.trim()) {
        flushBuffer(isContinuation);
        buffer = '';
      }

      // Split oversized paragraph along clean sentence boundaries
      const sentences = splitIntoSentences(para);
      let subBuffer = '';
      let subStartChar = paraStart;
      let isFirstSentenceChunk = true;

      for (const sent of sentences) {
        if (subBuffer.length + sent.length > targetChars && subBuffer.length > 0) {
          buffer = subBuffer;
          bufferStartChar = subStartChar;
          flushBuffer(!isFirstSentenceChunk);
          isFirstSentenceChunk = false;
          subBuffer = (buffer ? buffer + ' ' : '') + sent;
          subStartChar = cursor;
        } else {
          subBuffer += (subBuffer ? ' ' : '') + sent;
        }
      }

      if (subBuffer.trim()) {
        buffer = subBuffer;
        bufferStartChar = subStartChar;
        isContinuation = !isFirstSentenceChunk;
      }
    } else if (buffer.length + para.length > targetChars && buffer.length > 0) {
      flushBuffer(isContinuation);
      isContinuation = false;
      buffer = (buffer ? buffer + '\n\n' : '') + para;
      if (!buffer.startsWith(para)) {
        // overlap prefix retained
      } else {
        bufferStartChar = paraStart;
      }
    } else {
      if (buffer.length === 0) bufferStartChar = paraStart;
      buffer += (buffer ? '\n\n' : '') + para;
    }

    cursor += para.length + 2;
  }

  // Flush remaining buffer
  if (buffer.trim()) {
    flushBuffer(isContinuation);
  }

  return chunks;
}
