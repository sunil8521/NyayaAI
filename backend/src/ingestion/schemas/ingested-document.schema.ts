import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document as MongooseDoc } from 'mongoose';

@Schema({ _id: false })
export class ClassificationData {
  @Prop({ required: true })
  documentType: string;

  @Prop()
  documentSubtype?: string;

  @Prop()
  court?: string;

  @Prop()
  tribunal?: string;

  @Prop()
  issuingAuthority?: string;

  @Prop()
  jurisdiction?: string;

  @Prop()
  title?: string;

  @Prop()
  caseNumber?: string;

  @Prop()
  caseTitle?: string;

  @Prop({ type: [String], default: [] })
  parties?: string[];

  @Prop()
  decisionDate?: string;

  @Prop()
  confidence?: number;

  @Prop()
  method?: string;

  @Prop({ type: Array, default: [] })
  evidence?: Array<{ field: string; page?: number; text: string }>;

  @Prop()
  needsReview?: boolean;
}

export type IngDocDocument = IngDoc & MongooseDoc;

@Schema({ timestamps: true, collection: 'ingested_documents' })
export class IngDoc {
  /** Google Drive file ID — single unique identifier across MongoDB & Qdrant */
  @Prop({ required: true, unique: true, index: true })
  driveFileId: string;

  @Prop({ required: true })
  fileName: string;

  @Prop({ required: true, enum: ['upload', 'drive'], default: 'drive' })
  source: 'upload' | 'drive';

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

  @Prop({ type: ClassificationData })
  classification?: ClassificationData;

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

  @Prop()
  deletedAt?: Date;
}

export const IngDocSchema = SchemaFactory.createForClass(IngDoc);
// Only 2 indexes needed besides _id_:
// 1. driveFileId_1 (unique) - auto-created via @Prop({ unique: true, index: true })
// 2. status_1 - auto-created via @Prop({ index: true })
