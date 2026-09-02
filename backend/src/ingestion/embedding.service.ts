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
    const { data } = await axios.post<EmbedResponse>(`${this.baseUrl}/embed`, { texts });
    return data;
  }

  /** Re-ranks documents against a query using the BGE cross-encoder for maximum accuracy. */
  async rerank(query: string, documents: string[]): Promise<number[]> {
    const { data } = await axios.post<RerankResponse>(`${this.baseUrl}/rerank`, {
      query,
      documents,
    });
    return data.scores;
  }
}
