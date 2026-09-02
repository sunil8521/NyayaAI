import { Injectable, Logger } from '@nestjs/common';
import { tool, StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name);

  constructor() {}

  getTools(): StructuredTool[] {
    const legalSearchTool = tool(
      async ({ query }) => {
        this.logger.log(`🔧 [Tool Call] search_legal_docs -> query: "${query}"`);

        this.logger.log(`🔧 [Tool Call] search_legal_docs -> query: "${query}"`);

        return 'We are working on this feature! Searching legal documents is currently offline while we upgrade our systems.';
      },
      {
        name: 'search_database',
        description:
          'Search the database for information about Sunil. ' +
          'Only use this tool when asked about Sunil and the requested details are NOT already present in the previous conversation messages.',
        schema: z.object({
          query: z
            .string()
            .describe('The search query or keywords to look up.'),
        }),
      },
    );

    return [legalSearchTool];
  }
}
