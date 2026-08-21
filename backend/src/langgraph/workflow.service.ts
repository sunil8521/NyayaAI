import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ChatService } from 'src/chat/chat.service';
import { ToolsService } from './tools.service';
import { ToolNode, toolsCondition } from '@langchain/langgraph/prebuilt';
import { StateGraph, START, MessagesAnnotation, MemorySaver } from '@langchain/langgraph';

@Injectable()
export class WorkflowService implements OnModuleInit {
  private readonly logger = new Logger(WorkflowService.name);
  private app: any;

  constructor(
    private readonly chatService: ChatService,
    private readonly toolsService: ToolsService,
  ) {}

  async onModuleInit(): Promise<void> {
    const tools = this.toolsService.getTools();
    const llmWithTools = this.chatService.getLlm().bindTools(tools);

    const toolNode = new ToolNode(tools);
    const chatbot = async (state: typeof MessagesAnnotation.State) => {
      const response = await llmWithTools.invoke(state.messages);
      if (response.tool_calls && response.tool_calls.length > 0) {
        for (const call of response.tool_calls) {
          this.logger.log(
            `🤖 [LLM Decision] Tool requested: "${call.name}" with args: ${JSON.stringify(call.args)}`,
          );
        }
      }
      return { messages: [response] };
    };
    const checkpointer = new MemorySaver();

    const graph = (new StateGraph(MessagesAnnotation) as any)
      .addNode('chatbot', chatbot)
      .addNode('tools', toolNode)
      .addEdge(START, 'chatbot')
      .addConditionalEdges('chatbot', toolsCondition)
      .addEdge('tools', 'chatbot');

    this.app = graph.compile({ checkpointer });
  }

  async executeChat(inputMessages: any[], threadId: string): Promise<any> {
    const config = { configurable: { thread_id: threadId || '1' } };
    return this.app.invoke({ messages: inputMessages }, config);
  }
}
