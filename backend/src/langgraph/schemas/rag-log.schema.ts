import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RagLogDocument = RagLog & Document;

/** Lightweight snapshot of a single chunk that was retrieved/reranked */
class ChunkRef {
  @Prop() documentId: string;
  @Prop() fileName: string;
  @Prop() chunkIndex: number;
  @Prop() score: number; // qdrant hybrid score or reranker score
}

@Schema({ collection: 'rag_logs', timestamps: true })
export class RagLog {
  @Prop({ required: true }) threadId: string;
  @Prop({ required: true }) query: string;

  /** Filters the LLM chose to apply (if any) */
  @Prop({ type: Object }) filters?: { jurisdiction?: string; docType?: string };

  /** Top candidates from Qdrant (before reranking) — IDs + scores only */
  @Prop({ type: Number }) retrievedCount: number;

  /** Top 5 after reranking — lightweight refs */
  @Prop({ type: [Object] }) finalChunks: ChunkRef[];

  /** Reranker scores for the final chunks */
  @Prop({ type: [Number] }) rerankerScores: number[];

  /** Total pipeline latency in ms */
  @Prop() latencyMs: number;

  @Prop({ default: () => new Date() }) timestamp: Date;
}

export const RagLogSchema = SchemaFactory.createForClass(RagLog);
