import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LanggraphController } from './langgraph.controller';
import { ToolsService } from './tools.service';
import { WorkflowService } from './workflow.service';
import { ChatModule } from 'src/chat/chat.module';
import { Chat, ChatSchema } from './schemas/chat.schema';
import { Message, MessageSchema } from './schemas/message.schema';
// import { IngestionModule } from '../ingestion/ingestion.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Chat.name, schema: ChatSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
    ChatModule,
    // IngestionModule, // Provides EmbeddingService for the search tool
  ],
  controllers: [LanggraphController],
  providers: [ToolsService, WorkflowService],
  exports: [WorkflowService],
})
export class LanggraphModule { }
