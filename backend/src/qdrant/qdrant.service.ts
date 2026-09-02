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
        this.logger.log(
          `Collection "${COLLECTION_NAME}" not found — creating with on-disk vectors + int8 quantization...`,
        );

        await this.client.createCollection(COLLECTION_NAME, {
          vectors: {
            dense: {
              size: 1024, // BGE-M3 output dimension
              distance: 'Cosine',
              on_disk: true, // Keep raw vectors on SSD, not RAM
            },
          },
          sparse_vectors: {
            sparse: {
              index: {
                on_disk: true, // Sparse index on SSD too
              },
            },
          },
          quantization_config: {
            scalar: {
              type: 'int8', // 75% RAM reduction with minimal accuracy loss
              always_ram: true, // Quantized index stays in RAM for speed
            },
          },
        });

        // Create payload indexes for fast filtered searches
        await this.client.createPayloadIndex(COLLECTION_NAME, {
          field_name: 'documentId',
          field_schema: 'keyword',
        });
        await this.client.createPayloadIndex(COLLECTION_NAME, {
          field_name: 'docType',
          field_schema: 'keyword',
        });
        await this.client.createPayloadIndex(COLLECTION_NAME, {
          field_name: 'jurisdiction',
          field_schema: 'keyword',
        });

        this.logger.log(`✅ Collection "${COLLECTION_NAME}" created successfully.`);
      } else {
        this.logger.log(`✅ Qdrant connected, collection "${COLLECTION_NAME}" is ready.`);
      }
    } catch (error) {
      this.logger.error(`❌ Failed to initialize Qdrant: ${error}`);
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
   * Delete all chunks belonging to a specific document.
   * Useful for re-ingesting a failed or updated document cleanly.
   */
  async deleteByDocumentId(documentId: string): Promise<void> {
    await this.client.delete(COLLECTION_NAME, {
      wait: true,
      filter: {
        must: [{ key: 'documentId', match: { value: documentId } }],
      },
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
