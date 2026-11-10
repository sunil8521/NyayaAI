import { Logger } from '@nestjs/common';
import type { TextChunk } from '../chunking.util';

export interface ValidationIssue {
  chunkIndex: number;
  issue: string;
  severity: 'error' | 'warning';
}

export interface ChunkValidationResult {
  isValid: boolean;
  validatedChunks: TextChunk[];
  droppedCount: number;
  issues: ValidationIssue[];
}

const MAX_ALLOWED_TOKENS = 800;
const MIN_ALLOWED_CHARS = 15;

/**
 * Ingestion Guardrail: Chunk Validator (Step 6)
 * Inspects, cleans, and enforces strict quality constraints on every chunk before embedding or vector DB storage.
 */
export class ChunkValidator {
  private static readonly logger = new Logger(ChunkValidator.name);

  static validate(chunks: TextChunk[]): ChunkValidationResult {
    const issues: ValidationIssue[] = [];
    const validatedChunks: TextChunk[] = [];
    let droppedCount = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const trimmed = (chunk.text || '').trim();

      // 1. Guard against empty / blank chunks
      if (!trimmed || trimmed.length < MIN_ALLOWED_CHARS) {
        issues.push({
          chunkIndex: i,
          issue: `Dropped empty or near-empty chunk (length: ${trimmed.length} chars)`,
          severity: 'warning',
        });
        droppedCount++;
        continue;
      }

      // 2. Guard against invalid page numbers
      let pageStart = chunk.pageStart || 1;
      let pageEnd = chunk.pageEnd || pageStart;
      if (pageStart < 1) pageStart = 1;
      if (pageEnd < pageStart) pageEnd = pageStart;

      // 3. Token count guardrail (Max 800 tokens)
      const tokenCount = chunk.tokenCount || Math.ceil(trimmed.split(/\s+/).length * 1.35);

      if (tokenCount > MAX_ALLOWED_TOKENS) {
        issues.push({
          chunkIndex: i,
          issue: `Oversized chunk detected (${tokenCount} tokens > ${MAX_ALLOWED_TOKENS} max limit). Sub-splitting into compliant chunks.`,
          severity: 'warning',
        });

        // Sub-split along sentences to guarantee strict token compliance
        const subChunks = this.splitOversizedChunk(chunk, pageStart, pageEnd);
        for (const sub of subChunks) {
          sub.index = validatedChunks.length;
          validatedChunks.push(sub);
        }
        continue;
      }

      // Clean, validated chunk
      validatedChunks.push({
        ...chunk,
        index: validatedChunks.length,
        text: trimmed,
        pageStart,
        pageEnd,
        tokenCount,
        legalReferences: chunk.legalReferences || [],
      });
    }

    const isValid = issues.filter((iss) => iss.severity === 'error').length === 0;

    this.logger.log(
      `🛡️ [Chunk Guardrail] Validated ${chunks.length} raw chunks → ${validatedChunks.length} clean chunks (${droppedCount} dropped, ${issues.length} issues handled)`,
    );

    return {
      isValid,
      validatedChunks,
      droppedCount,
      issues,
    };
  }

  /**
   * Sub-splits oversized chunks along sentence or clause boundaries
   * to strictly satisfy the <= 800 token maximum limit.
   */
  private static splitOversizedChunk(
    chunk: TextChunk,
    pageStart: number,
    pageEnd: number,
  ): TextChunk[] {
    const rawSentences = chunk.text
      .split(/(?<=[.?!;])\s+(?=[A-Z0-9("'])/g)
      .map((s) => s.trim())
      .filter(Boolean);

    // If any sentence is itself huge (> 550 tokens), break it down by words
    const sentences: string[] = [];
    for (const sent of rawSentences) {
      const est = Math.ceil(sent.split(/\s+/).length * 1.35);
      if (est > 550) {
        const words = sent.split(/\s+/);
        let curr = '';
        for (const w of words) {
          if (Math.ceil((curr + ' ' + w).split(/\s+/).length * 1.35) > 500) {
            if (curr) sentences.push(curr);
            curr = w;
          } else {
            curr += (curr ? ' ' : '') + w;
          }
        }
        if (curr) sentences.push(curr);
      } else {
        sentences.push(sent);
      }
    }

    const result: TextChunk[] = [];
    let currentText = '';
    let isSubContinuation = chunk.isContinuation;

    for (const sent of sentences) {
      const estimated = Math.ceil((currentText + ' ' + sent).split(/\s+/).length * 1.35);
      if (estimated > 550 && currentText.trim()) {
        result.push({
          ...chunk,
          text: currentText.trim(),
          pageStart,
          pageEnd,
          isContinuation: isSubContinuation,
          tokenCount: Math.ceil(currentText.trim().split(/\s+/).length * 1.35),
          legalReferences: chunk.legalReferences || [],
        });
        isSubContinuation = true;
        currentText = sent;
      } else {
        currentText += (currentText ? ' ' : '') + sent;
      }
    }

    if (currentText.trim()) {
      result.push({
        ...chunk,
        text: currentText.trim(),
        pageStart,
        pageEnd,
        isContinuation: isSubContinuation,
        tokenCount: Math.ceil(currentText.trim().split(/\s+/).length * 1.35),
        legalReferences: chunk.legalReferences || [],
      });
    }

    return result.length > 0 ? result : [chunk];
  }
}
