import { Module } from '@nestjs/common';
// import { ConfigModule } from '@nestjs/config';
import { LanggraphController } from './langgraph.controller';
import { ToolsService } from './tools.service';
import { WorkflowService } from './workflow.service';
import { ChatModule } from 'src/chat/chat.module';

@Module({
    imports: [ChatModule],
    controllers: [LanggraphController],
    providers: [ToolsService, WorkflowService],
    exports: [WorkflowService]
})
export class LanggraphModule { }
