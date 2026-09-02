import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ChatService } from 'src/chat/chat.service';
import { ToolsService } from './tools.service';
import { SystemMessage } from '@langchain/core/messages';
import { ToolNode, toolsCondition } from '@langchain/langgraph/prebuilt';
import { StateGraph, START, MessagesAnnotation, CompiledStateGraph } from '@langchain/langgraph';
import { MongoDBSaver } from '@langchain/langgraph-checkpoint-mongodb';

@Injectable()
export class WorkflowService implements OnModuleInit {
  private readonly logger = new Logger(WorkflowService.name);
  private app!: CompiledStateGraph<any, any, any>;
  private checkpointer!: MongoDBSaver;

  constructor(
    private readonly chatService: ChatService,
    private readonly toolsService: ToolsService,
    @InjectConnection() private readonly connection: Connection,
  ) { }

  async onModuleInit(): Promise<void> {
    const nativeClient = (this.connection as any).getClient();
    const dbName = this.connection.db?.databaseName || 'okila';

    this.checkpointer = new MongoDBSaver({
      client: nativeClient as any,
      dbName,
    });

    const tools = this.toolsService.getTools();
    const llmWithTools = this.chatService.getLlm().bindTools(tools);

    const toolNode = new ToolNode(tools);

    const chatbot = async (state: typeof MessagesAnnotation.State) => {
      const now = new Date().toLocaleString();
      const systemPrompt = new SystemMessage(
        `You are a helpful assistant. The current date and time is ${now}. If the user asks anything related to Sunil, you MUST use the 'search_database' tool to find the answer. Otherwise, just answer normally without using the tool. When you use the tool, ALWAYS cite the source file name and chunk number at the end of your answer.`
      );

      const response = await llmWithTools.invoke([systemPrompt, ...state.messages]);
      return { messages: [response] };
    };

    const graph = new StateGraph(MessagesAnnotation)
      .addNode('chatbot', chatbot)
      .addNode('tools', toolNode)
      .addEdge(START, 'chatbot')
      .addConditionalEdges('chatbot', toolsCondition)
      .addEdge('tools', 'chatbot');

    this.app = graph.compile({ checkpointer: this.checkpointer });
    this.logger.log('✅ LangGraph Workflow with MongoDBSaver initialized successfully');
  }

  async executeChat(inputMessages: any[], threadId: string): Promise<any> {
    const config = { configurable: { thread_id: threadId } };
    return this.app.invoke({ messages: inputMessages }, config);
  }



  async deleteThread(threadId: string): Promise<void> {
    // 1. Call LangGraph checkpointer delete if supported
    try {
      if (typeof (this.checkpointer as any)?.deleteThread === 'function') {
        await (this.checkpointer as any).deleteThread(threadId);
      }
    } catch (err) {
      this.logger.warn(`Checkpointer deleteThread error: ${err}`);
    }

    // 2. Clean up from MongoDB checkpoint collections (checkpoints, checkpoint_writes, checkpoint_blobs)
    try {
      const db = this.connection.db;
      if (db) {
        await Promise.allSettled([
          db.collection('checkpoints').deleteMany({ thread_id: threadId }),
          db.collection('checkpoint_writes').deleteMany({ thread_id: threadId }),
          db.collection('checkpoint_blobs').deleteMany({ thread_id: threadId }),
        ]);
        this.logger.log(`🧹 Cleaned up checkpoints & checkpoint_writes for thread: ${threadId}`);
      }
    } catch (err) {
      this.logger.warn(`Direct MongoDB checkpoint cleanup error: ${err}`);
    }
  }
}
