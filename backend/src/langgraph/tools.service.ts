import { Injectable, Logger } from '@nestjs/common';
import { tool, StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
// import { EmbeddingService } from '../ingestion/embedding.service';
// import { QdrantService } from '../qdrant/qdrant.service';

@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name);

  constructor(
    // private readonly embeddingService: EmbeddingService,
    // private readonly qdrantService: QdrantService,
  ) {}

  getTools(): StructuredTool[] {
    const legalSearchTool = tool(
      async ({ query }) => {
        this.logger.log(`🔧 [Tool Call] search_legal_docs -> query: "${query}"`);

        // try {
        //   // 1. Embed the user's single query wrapped in an array
        //   const response = await this.embeddingService.embed([query]);
        //
        //   // Guard check against malformed or empty model responses
        //   if (!response || !response.dense?.length || !response.sparse?.length) {
        //     return 'The embedding server returned an invalid response. Could not search database.';
        //   }
        //
        //   // Extract the first vector item out of the batch response arrays
        //   const denseVector = response.dense[0]; 
        //   const sparseVector = response.sparse[0];
        //
        //   // 2. Fetch a BROAD set of candidates from Qdrant (top 50)
        //   const results = await this.qdrantService.hybridSearch({
        //     denseVector,
        //     sparseVector,
        //     limit: 50, // Broad pool for re-ranking
        //   });
        //
        //   if (!results || !results.points || results.points.length === 0) {
        //     return 'No relevant documents found in the database for this query.';
        //   }
        //
        //   this.logger.log(`🔍 [Qdrant] Retrieved ${results.points.length} candidates. Sending to re-ranker...`);
        //
        //   // 3. Re-rank: cross-encoder scores each chunk against the query
        //   const documents = results.points.map((p: any) => p.payload?.text ?? '');
        //   const scores = await this.embeddingService.rerank(query, documents);
        //
        //   // 4. Zip results with re-ranker scores, sort descending, take top 5
        //   const reranked = results.points
        //     .map((point: any, i: number) => ({ ...point, rerankScore: scores[i] }))
        //     .sort((a: any, b: any) => b.rerankScore - a.rerankScore)
        //     .slice(0, 5);
        //
        //   this.logger.log(`✅ [Re-ranker] Top 5 scores: [${reranked.map((r: any) => r.rerankScore.toFixed(3)).join(', ')}]`);
        //
        //   // 5. Format the top 5 results with source citations for the LLM
        //   const formattedResults = reranked
        //     .map((point: any, i: number) => {
        //       const p = point.payload || {};
        //       const source = [
        //         p.fileName && `📄 ${p.fileName}`,
        //         p.docType && `Type: ${p.docType}`,
        //         p.jurisdiction && `Court: ${p.jurisdiction}`,
        //         p.chunkIndex !== undefined && `Chunk #${p.chunkIndex}`,
        //       ]
        //         .filter(Boolean)
        //         .join(' | ');
        //
        //       return \`--- Result \${i + 1} (rerank: \${point.rerankScore?.toFixed(3)}) ---\\n[Source: \${source}]\\n\${p.text ?? ''}\`;
        //     })
        //     .join('\\n\\n');
        //
        //   return formattedResults;
        // } catch (err: any) {
        //   this.logger.error(\`❌ search failed: \${err.message}\`);
        //   return \`Error searching documents: \${err.message}. The database may be unavailable.\`;
        // }

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
