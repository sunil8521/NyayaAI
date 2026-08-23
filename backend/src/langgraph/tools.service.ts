import { Injectable, Logger } from '@nestjs/common';
import { tool, StructuredTool } from '@langchain/core/tools';
import { z } from "zod";

@Injectable()
export class ToolsService {
    private readonly logger = new Logger(ToolsService.name);

    constructor() { }

    getTools(): StructuredTool[] {
        const legalSearchTool = tool(
            async ({ query }) => {
                this.logger.log(`🔧 [Tool Call] search_legal_docs -> query: "${query}"`);

                const result = " We are currently working on fetching the exact legal clauses from the document database. Hold tight.";

                return result;
            },
            {
                name: 'search_legal_docs',
                description: 'Search the legal document database for evidence, contracts, laws, or legal clauses.',
                schema: z.object({
                    query: z.string().describe('The legal query or keywords to look up in the documents'),
                }),
            }
        );

        return [legalSearchTool];
    }
}
