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
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { WorkflowService } from './workflow.service';
import { SendMessageDto } from './dto/chat-request.dto';
import { Chat, ChatDocument } from './schemas/chat.schema';
import { Message, MessageDocument } from './schemas/message.schema';
import { Session } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';

@Controller('chat')
export class LanggraphController {
  constructor(
    private readonly workflowService: WorkflowService,
    @InjectModel(Chat.name) private readonly chatModel: Model<ChatDocument>,
    @InjectModel(Message.name) private readonly messageModel: Model<MessageDocument>,
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
      })),
    };
  }

  // 4. Send a message to the LangGraph agent (POST /chat/:threadId/message)
  @Post(':threadId/message')
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
}
