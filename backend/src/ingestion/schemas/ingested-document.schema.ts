import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document as MongooseDoc } from 'mongoose';

export type IngDocDocument = IngDoc & MongooseDoc;

@Schema({ timestamps: true, collection: 'ingested_documents' })
export class IngDoc {
  /** YOUR permanent internal UUID — never reuse Google Drive's ID here. */
  @Prop({ required: true, unique: true, index: true })
  documentId: string;

  @Prop({ required: true })
  fileName: string;

  @Prop({ required: true, enum: ['upload', 'drive'] })
  source: 'upload' | 'drive';

  /** Google Drive file ID (only for source='drive') */
  @Prop({ index: true })
  driveFileId?: string;

  @Prop({
    required: true,
    enum: ['new', 'queued', 'processing', 'completed', 'failed', 'deleted'],
    default: 'new',
    index: true,
  })
  status: 'new' | 'queued' | 'processing' | 'completed' | 'failed' | 'deleted';

  @Prop()
  error?: string;

  @Prop({ default: 0 })
  chunkCount: number;

  /** How many chunks were successfully upserted so far */
  @Prop({ default: 0 })
  processedChunks: number;

  /** Number of processing attempts (incremented on each retry) */
  @Prop({ default: 0 })
  attemptCount: number;

  @Prop()
  docType?: string;

  @Prop()
  jurisdiction?: string;

  @Prop()
  fileSizeBytes?: number;

  /** The Drive folder path where this file lives (e.g. /Judgments/2026) */
  @Prop()
  folderPath?: string;

  /** Google Drive's last-modified timestamp — used to detect file updates */
  @Prop()
  driveModifiedTime?: Date;

  @Prop()
  completedAt?: Date;

  @Prop()
  failedAt?: Date;

  @Prop({ index: true })
  deletedAt?: Date;
}

export const IngDocSchema = SchemaFactory.createForClass(IngDoc);

// ⚡ Production indexes for sub-20ms dashboard queries
IngDocSchema.index({ status: 1, driveModifiedTime: -1 }); // Dashboard sort by status + recency
IngDocSchema.index({ status: 1, deletedAt: -1 });          // Deleted tab queries
IngDocSchema.index({ driveFileId: 1 }, { unique: true, sparse: true }); // Drive sync dedup
IngDocSchema.index({ fileName: 'text' });                   // Full-text search
