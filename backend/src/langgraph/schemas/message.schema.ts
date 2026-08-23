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
}

export const MessageSchema = SchemaFactory.createForClass(Message);
