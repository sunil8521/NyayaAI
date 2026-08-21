export interface TextChunk {
  text: string;
  index: number;
}

const CHUNK_TARGET_TOKENS = 600;
const CHUNK_OVERLAP_TOKENS = 80;
const CHARS_PER_TOKEN = 4; // rough approximation for English legal text

/**
 * Splits extracted PDF text into overlapping chunks, preferring to break on
 * paragraph or section boundaries rather than mid-sentence.
 *
 * Legal-aware: splits on Section, Article, Clause headings and numbered items.
 */
export function chunkText(text: string): TextChunk[] {
  const targetChars = CHUNK_TARGET_TOKENS * CHARS_PER_TOKEN;
  const overlapChars = CHUNK_OVERLAP_TOKENS * CHARS_PER_TOKEN;

  const paragraphs = text
    .split(/\n\s*\n|\n(?=(?:Section|Article|Clause|\d+\.)\s)/g)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: TextChunk[] = [];
  let buffer = '';

  for (const para of paragraphs) {
    if (buffer.length + para.length > targetChars && buffer.length > 0) {
      chunks.push({ text: buffer.trim(), index: chunks.length });
      // carry the tail of the previous chunk forward so context isn't lost at the boundary
      buffer = buffer.slice(-overlapChars) + '\n\n' + para;
    } else {
      buffer += (buffer ? '\n\n' : '') + para;
    }
  }
  if (buffer.trim()) {
    chunks.push({ text: buffer.trim(), index: chunks.length });
  }

  return chunks;
}
