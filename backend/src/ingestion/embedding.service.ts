import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { SparseVector } from '../qdrant/qdrant.service';

interface EmbedResponse {
  dense: number[][];
  sparse: SparseVector[];
}

interface RerankResponse {
  scores: number[];
}

interface ClassifyResponse {
  docType: string;
  confidence: number;
  scores: Record<string, number>;
}

@Injectable()
export class EmbeddingService {
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      'EMBEDDING_SERVER_URL'
    )!;
  }

  /** Sends a batch of chunk texts to the Python BGE-M3 server, gets back dense + sparse vectors. */
  async embed(texts: string[]): Promise<EmbedResponse> {
    if (!texts || texts.length === 0) {
      return { dense: [], sparse: [] };
    }

    const { data } = await axios.post<EmbedResponse>(
      `${this.baseUrl}/embed`,
      { texts },
      { timeout: 120_000 },
    );

    if (data.dense?.length !== texts.length || data.sparse?.length !== texts.length) {
      throw new Error(
        `Embedding response count mismatch: sent ${texts.length}, received ${data.dense?.length ?? 0} dense and ${data.sparse?.length ?? 0} sparse`,
      );
    }

    return data;
  }

  /** Re-ranks documents against a query using the BGE cross-encoder for maximum accuracy. */
  async rerank(query: string, documents: string[]): Promise<number[]> {
    if (!documents || documents.length === 0) return [];
    const { data } = await axios.post<RerankResponse>(
      `${this.baseUrl}/rerank`,
      { query, documents },
      { timeout: 12_000 },
    );
    return data.scores;
  }

  /** Classify a document by embedding similarity against precomputed category embeddings. */
  async classify(text: string): Promise<ClassifyResponse> {
    const { data } = await axios.post<ClassifyResponse>(
      `${this.baseUrl}/classify`,
      { text },
      { timeout: 30_000 },
    );
    return data;
  }

  /** Count actual tokens for a batch of texts using the BGE-M3 tokenizer on Python server. */
  async countTokens(texts: string[]): Promise<number[]> {
    try {
      const { data } = await axios.post<{ counts: number[] }>(
        `${this.baseUrl}/count-tokens`,
        { texts },
        { timeout: 5000 },
      );
      return data.counts;
    } catch {
      // Fallback: calibrated estimate if embedding server is unavailable
      return texts.map((t) => {
        const words = t.trim().split(/\s+/).filter(Boolean).length;
        return Math.max(1, Math.ceil(words * 1.35));
      });
    }
  }
}
