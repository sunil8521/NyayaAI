import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MessageDocument = Message & Document;

export type MessageRole = 'user' | 'ai' | 'system' | 'assistant';

@Schema({ timestamps: true })
export class Message {
  @Prop({ required: true, index: true })
  threadId: string;

  @Prop({ required: true, enum: ['user', 'ai', 'system', 'assistant'] })
  role: MessageRole;

  @Prop({ required: true })
  content: string;

  /** Source citations from RAG retrieval (only on AI messages) */
  @Prop({ type: [Object] })
  sources?: Array<{
    fileName: string;
    pageStart: number;
    pageEnd: number;
    chunkIndex: number;
    docType?: string;
    jurisdiction?: string;
    excerpt?: string;
  }>;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
