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
        `You are Rocky Legal, an expert AI legal research assistant specializing in Indian law, statutes (IPC, CrPC, BNS, CPC), and case law precedents. The current date and time is ${now}.\n` +
        `When the user asks about specific legal judgments, case precedents, statutory interpretation, or information from uploaded legal documents, ALWAYS use the 'search_database' tool to retrieve relevant authorities and evidence.\n\n` +
        `RULES FOR ANSWERING:\n` +
        `1. Answer the user's question ONLY from the provided sources.\n` +
        `2. Do not invent facts, holdings, statutes, or case names.\n` +
        `3. If the sources do not contain enough information, say: "The retrieved documents do not contain enough information to answer this."\n` +
        `4. Distinguish between the court's holding and a party's argument.\n` +
        `5. Preserve the legal meaning of the source.\n` +
        `6. Prefer the most authoritative source when multiple sources conflict.\n` +
        `7. Do not treat a legal proposition as established merely because it appears in a party's argument.\n` +
        `8. Your users are senior advocates and legal professionals. Provide detailed, comprehensive, and highly professional answers. DO NOT give one-sentence answers; instead, provide the full context, background, and legal reasoning found in the documents in a formal, respectful tone.\n\n` +
        `FORMATTING & CITATIONS:\n` +
        `- Use markdown for formatting. **Bold** the most critical pieces of evidence or reasoning in your answer.\n` +
        `- DO NOT include source file names, chunk numbers, or citations like "Source: [filename]" in your response text. The UI automatically displays the sources below your message.`
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

  /**
   * Stream chat execution — yields SSE events for tokens (messages) and sources (custom).
   * Returns the full assembled AI message text and source metadata.
   */
  async *streamChat(
    inputMessages: any[],
    threadId: string,
  ): AsyncGenerator<{ event: string; data: string }> {
    const config = {
      configurable: { thread_id: threadId },
      streamMode: ['messages', 'custom'] as Array<'messages' | 'custom'>,
    };

    let fullText = '';
    let sources: any[] = [];

    const stream = await this.app.stream(
      { messages: inputMessages },
      config as any,
    );

    for await (const chunk of stream) {
      // When using multiple streamMode, each chunk is a tuple [mode, data]
      const [mode, data] = chunk as unknown as [string, any];

      if (mode === 'messages') {
        // data is [messageChunk, metadata]
        const [messageChunk, metadata] = data;
        // Only stream tokens from the chatbot node (skip tool node LLM calls)
        if (metadata?.langgraph_node === 'chatbot' && messageChunk?.content) {
          const token = typeof messageChunk.content === 'string'
            ? messageChunk.content
            : '';
          if (token) {
            fullText += token;
            yield { event: 'token', data: JSON.stringify({ token }) };
          }
        }
      } else if (mode === 'custom') {
        // Custom data emitted by config.writer() in the tool
        if (data?.type === 'sources' && Array.isArray(data.sources)) {
          sources = data.sources;
          yield { event: 'sources', data: JSON.stringify({ sources }) };
        }
      }
    }

    // Final event with the complete message and sources
    yield {
      event: 'done',
      data: JSON.stringify({ fullText, sources }),
    };
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
