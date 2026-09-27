import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { WorkflowService } from './workflow.service';
import { SendMessageDto } from './dto/chat-request.dto';
import { Chat, ChatDocument } from './schemas/chat.schema';
import { Message, MessageDocument } from './schemas/message.schema';
import { RagLog, RagLogDocument } from './schemas/rag-log.schema';
import { Session, AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';

@Controller('chat')
export class LanggraphController {
  constructor(
    private readonly workflowService: WorkflowService,
    @InjectModel(Chat.name) private readonly chatModel: Model<ChatDocument>,
    @InjectModel(Message.name) private readonly messageModel: Model<MessageDocument>,
    @InjectModel(RagLog.name) private readonly ragLogModel: Model<RagLogDocument>,
  ) {}

  private getObjectId(id: string): Types.ObjectId {
    try {
      return new Types.ObjectId(id);
    } catch {
      return id as any;
    }
  }

  // 1. Fetch all chats for the sidebar (GET /chat)
  @Get()
  async getChats(@Session() session: UserSession) {
    const rawUserId = session?.user?.id;
    const userId = this.getObjectId(rawUserId);
    console.log('🔍 [getChats] session.user.id:', rawUserId, '| Type:', typeof rawUserId);
    console.log('🔍 [getChats] Converted userId (ObjectId):', userId);

    const chats = await this.chatModel
      .find({ userId })
      .sort({ updatedAt: -1 })
      .exec();

    return {
      success: true,
      chats,
    };
  }

  // 2. Create a new chat (POST /chat)
  @Post()
  @HttpCode(HttpStatus.OK)
  async createNewChat(@Session() session: UserSession) {
    const userId = this.getObjectId(session?.user?.id);
    const threadId = uuidv4();

    const newChat = await this.chatModel.create({
      userId,
      threadId,
      title: 'New Chat',
    });

    return {
      success: true,
      chat: newChat,
      threadId: newChat.threadId,
    };
  }

  // 3. Get history for a specific chat (GET /chat/:threadId/history)
  @Get(':threadId/history')
  async getChatHistory(
    @Session() session: UserSession,
    @Param('threadId') threadId: string,
  ) {
    const userId = this.getObjectId(session?.user?.id);
    const chat = await this.chatModel.findOne({ threadId, userId }).exec();

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    const messages = await this.messageModel
      .find({ threadId })
      .sort({ createdAt: 1 })
      .exec();

    return {
      success: true,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...((m as any).sources?.length ? { sources: (m as any).sources } : {}),
      })),
    };
  }

  // 4. Send a message to the LangGraph agent (POST /chat/:threadId/message) — NON-STREAMING FALLBACK
  @Post(':threadId/message')
  @AllowAnonymous()
  @HttpCode(HttpStatus.OK)
  async sendMessage(
    @Session() session: UserSession,
    @Param('threadId') threadId: string,
    @Body() body: SendMessageDto,
  ) {
    const { message } = body || {};
    if (!message) {
      throw new BadRequestException('Message is required');
    }

    const userId = this.getObjectId(session?.user?.id);
    const chat = await this.chatModel.findOne({ threadId, userId }).exec();
    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    // 1. Save user message to Message collection
    await this.messageModel.create({
      threadId,
      role: 'user',
      content: message,
    });

    // 2. Invoke LangGraph agent (MongoDBSaver automatically manages thread history)
    const result = await this.workflowService.executeChat(
      [{ role: 'user', content: message }],
      threadId,
    );

    const latestResponse = result.messages[result.messages.length - 1];
    const aiMessage =
      typeof latestResponse.content === 'string'
        ? latestResponse.content
        : JSON.stringify(latestResponse.content);

    // 3. Save AI response to Message collection
    await this.messageModel.create({
      threadId,
      role: 'ai',
      content: aiMessage,
    });

    // 4. Update chat's updatedAt (and title if it was "New Chat")
    const updateData: any = { updatedAt: new Date() };
    if (chat.title === 'New Chat') {
      updateData.title = message.length > 30 ? message.substring(0, 30) + '...' : message;
    }
    await this.chatModel.findByIdAndUpdate(chat._id, updateData).exec();

    return {
      success: true,
      message: aiMessage,
    };
  }

  // 4b. Stream a message via SSE (POST /chat/:threadId/stream)
  @Post(':threadId/stream')
  @AllowAnonymous()
  async streamMessage(
    @Session() session: UserSession,
    @Param('threadId') threadId: string,
    @Body() body: SendMessageDto,
    @Res() res: any,
  ) {
    const { message } = body || {};
    if (!message) {
      throw new BadRequestException('Message is required');
    }

    const userId = this.getObjectId(session?.user?.id);
    const chat = await this.chatModel.findOne({ threadId, userId }).exec();
    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    // NOTE: Do NOT save the user message here. Save it AFTER streaming completes.
    // Saving it before caused duplicate messages: the frontend adds an optimistic
    // user message to the cache, then if React Query auto-refetches history during
    // the long tool-call, it finds the same message in MongoDB → duplicate in UI.

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    let fullText = '';
    let sources: any[] = [];

    // Heartbeat: send a SSE comment every 10s to keep the connection alive.
    // Without this, the Next.js rewrite proxy times out during the 15-30s
    // tool execution (Qdrant + CPU reranker) when no events are flowing.
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 10_000);

    try {
      for await (const sseEvent of this.workflowService.streamChat(
        [{ role: 'user', content: message }],
        threadId,
      )) {
        res.write(`event: ${sseEvent.event}\ndata: ${sseEvent.data}\n\n`);

        // Collect final data
        if (sseEvent.event === 'done') {
          const parsed = JSON.parse(sseEvent.data);
          fullText = parsed.fullText;
          sources = parsed.sources;
        }
      }
    } catch (err: any) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
    } finally {
      clearInterval(heartbeat);
    }

    // Save BOTH user message and AI response to MongoDB AFTER streaming completes.
    // This ensures no mid-stream refetch can find a duplicate user message.
    await this.messageModel.create({
      threadId,
      role: 'user',
      content: message,
    });

    if (fullText) {
      await this.messageModel.create({
        threadId,
        role: 'ai',
        content: fullText,
        ...(sources.length > 0 ? { sources } : {}),
      });
    }

    // Update chat metadata
    const updateData: any = { updatedAt: new Date() };
    if (chat.title === 'New Chat') {
      updateData.title = message.length > 30 ? message.substring(0, 30) + '...' : message;
    }
    await this.chatModel.findByIdAndUpdate(chat._id, updateData).exec();

    res.end();
  }

  // 5. Delete a chat thread & all its messages (DELETE /chat/:threadId)
  @Delete(':threadId')
  async deleteChat(
    @Session() session: UserSession,
    @Param('threadId') threadId: string,
  ) {
    const userId = this.getObjectId(session?.user?.id);

    const chat = await this.chatModel.findOneAndDelete({ threadId, userId }).exec();
    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    // 2. Cascade delete all messages in Message collection
    await this.messageModel.deleteMany({ threadId }).exec();

    // 3. Cascade delete all LangGraph checkpoints and checkpoint_writes in MongoDB
    await this.workflowService.deleteThread(threadId);

    return {
      success: true,
      message: 'Chat thread, messages, and checkpoints deleted successfully',
    };
  }

  // 6. View recent RAG logs (GET /chat/rag-logs)
  @Get('rag-logs')
  @AllowAnonymous()
  async getRagLogs() {
    const logs = await this.ragLogModel
      .find()
      .sort({ timestamp: -1 })
      .limit(100)
      .exec();

    return {
      success: true,
      count: logs.length,
      logs,
    };
  }

  // 7. Clear all RAG logs (DELETE /chat/rag-logs)
  @Delete('rag-logs')
  @AllowAnonymous()
  async clearRagLogs() {
    const result = await this.ragLogModel.deleteMany({}).exec();
    return {
      success: true,
      deleted: result.deletedCount,
      message: `Cleared ${result.deletedCount} RAG log entries`,
    };
  }
}
