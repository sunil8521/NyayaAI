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
    enum: ['queued', 'processing', 'completed', 'failed', 'deleted'],
    default: 'queued',
    index: true,
  })
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'deleted';

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

  @Prop({ default: 'general_legal' })
  docType: string;

  @Prop({ default: 'All_India_Generic' })
  jurisdiction: string;

  @Prop()
  fileSizeBytes?: number;

  /** Google Drive's last-modified timestamp — used to detect file updates */
  @Prop()
  driveModifiedTime?: Date;

  @Prop()
  completedAt?: Date;

  @Prop()
  failedAt?: Date;
}

export const IngDocSchema = SchemaFactory.createForClass(IngDoc);
