import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ChatDocument = Chat & Document;

@Schema({ timestamps: true })
export class Chat {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'user',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  threadId: string;

  @Prop({ default: 'New Chat' })
  title: string;
}

export const ChatSchema = SchemaFactory.createForClass(Chat);
