import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';

const COLLECTION_NAME = 'legal_docs';

export interface SparseVector {
  indices: number[];
  values: number[];
}

export interface LegalChunkPoint {
  id: string | number;
  denseVector: number[];
  sparseVector: SparseVector;
  payload: {
    text: string;
    documentId: string;
    fileName?: string;
    chunkIndex?: number;
    jurisdiction?: string;
    docType?: string;
    matterId?: string;
    date?: string;
    page?: number;
    [key: string]: unknown;
  };
}

export interface HybridSearchParams {
  denseVector: number[];
  sparseVector: SparseVector;
  filter?: Record<string, unknown>;
  limit?: number;
}

@Injectable()
export class QdrantService implements OnModuleInit {
  private readonly logger = new Logger(QdrantService.name);
  private readonly client: QdrantClient;

  constructor(private readonly configService: ConfigService) {
    this.client = new QdrantClient({
      url: this.configService.get<string>('QDRANT_URL', 'http://localhost:6333'),
    });
  }

  async onModuleInit() {
    try {
      const { collections } = await this.client.getCollections();
      const exists = collections.some((c) => c.name === COLLECTION_NAME);
      if (!exists) {
        this.logger.warn(
          `Collection "${COLLECTION_NAME}" not found — create it before ingesting documents.`,
        );
      } else {
        this.logger.log(`✅ Qdrant connected, collection "${COLLECTION_NAME}" is ready.`);
      }
    } catch (error) {
      this.logger.error(`❌ Failed to connect to Qdrant: ${error}`);
    }
  }

  /** Upsert chunk embeddings (dense + sparse) with their metadata payload. */
  async upsertChunks(points: LegalChunkPoint[]): Promise<void> {
    await this.client.upsert(COLLECTION_NAME, {
      wait: true,
      points: points.map((p) => ({
        id: p.id,
        vector: {
          dense: p.denseVector,
          sparse: p.sparseVector,
        },
        payload: p.payload,
      })),
    });
  }

  /**
   * Hybrid search: runs dense + sparse retrieval in parallel, then fuses
   * results with Reciprocal Rank Fusion (RRF).
   */
  async hybridSearch({ denseVector, sparseVector, filter, limit = 10 }: HybridSearchParams) {
    return this.client.query(COLLECTION_NAME, {
      prefetch: [
        { query: denseVector, using: 'dense', limit: limit * 3 },
        { query: sparseVector, using: 'sparse', limit: limit * 3 },
      ],
      query: { fusion: 'rrf' },
      filter,
      limit,
      with_payload: true,
    });
  }
}
