import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { tool, StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { LangGraphRunnableConfig } from '@langchain/langgraph';
import { EmbeddingService } from '../ingestion/embedding.service';
import { QdrantService } from '../qdrant/qdrant.service';
import { RagLog, RagLogDocument } from './schemas/rag-log.schema';

@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name);

  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly qdrantService: QdrantService,
    @InjectModel(RagLog.name) private readonly ragLogModel: Model<RagLogDocument>,
  ) {}

  getTools(): StructuredTool[] {
    const legalSearchTool = tool(
      async ({ query, jurisdiction, docType }, config: LangGraphRunnableConfig) => {
        this.logger.log(`🔧 [Tool Call] search_legal_docs -> query: "${query}"${jurisdiction ? `, jurisdiction: ${jurisdiction}` : ''}${docType ? `, docType: ${docType}` : ''}`);

        try {
          const startTime = Date.now();
          // 1. Embed the user's single query wrapped in an array
          const response = await this.embeddingService.embed([query]);

          // Guard check against malformed or empty model responses
          if (!response || !response.dense?.length || !response.sparse?.length) {
            return 'The embedding server returned an invalid response. Could not search database.';
          }

          // Extract the first vector item out of the batch response arrays
          const denseVector = response.dense[0]; 
          const sparseVector = response.sparse[0];

          // Build Qdrant metadata filter from optional params
          // IGNORING LLM METADATA GUESSES FOR NOW: The LLM keeps hallucinating `tribunal_order` 
          // which filters out all the real documents. 
          const filter = undefined;

          // 2. Fetch a BROAD set of candidates from Qdrant (top 50)
          const results = await this.qdrantService.hybridSearch({
            denseVector,
            sparseVector,
            filter,
            limit: 10, // Reduced from 30 to 10 because reranker is on CPU and too slow otherwise
          });

          if (!results || !results.points || results.points.length === 0) {
            return 'No relevant documents found in the database for this query.';
          }

          this.logger.log(`🔍 [Qdrant] Retrieved ${results.points.length} candidates. Sending to re-ranker...`);

          // 3. Re-rank: cross-encoder scores each chunk against the query
          const documents = results.points.map((p: any) => p.payload?.text ?? '');
          const scores = await this.embeddingService.rerank(query, documents);

          // 4. Zip results with re-ranker scores, filter out irrelevant ones, sort descending, take top 5
          const SCORE_THRESHOLD = 0.0; // Typical cross-encoder threshold for relevance
          const reranked = results.points
            .map((point: any, i: number) => ({ ...point, rerankScore: scores[i] }))
            .filter((point: any) => point.rerankScore >= SCORE_THRESHOLD)
            .sort((a: any, b: any) => b.rerankScore - a.rerankScore)
            .slice(0, 5);

          if (reranked.length === 0) {
            this.logger.log(`⚠️ [Re-ranker] All retrieved documents fell below the similarity threshold of ${SCORE_THRESHOLD}.`);
            return 'No relevant documents found in the database for this query.';
          }

          this.logger.log(`✅ [Re-ranker] Top 5 scores: [${reranked.map((r: any) => r.rerankScore.toFixed(3)).join(', ')}]`);

          // 5. Emit source metadata to the stream via config.writer() (custom stream mode)
          const sourceMeta = reranked.map((point: any) => {
            const p = point.payload || {};
            return {
              fileName: p.fileName ?? '',
              pageStart: p.pageStart ?? 0,
              pageEnd: p.pageEnd ?? 0,
              chunkIndex: p.chunkIndex ?? 0,
              docType: p.docType,
              jurisdiction: p.jurisdiction,
              excerpt: (p.text ?? '').substring(0, 150),
            };
          });

          try {
            if (config.writer) {
              config.writer({ type: 'sources', sources: sourceMeta });
            }
          } catch (writerErr) {
            // writer may not exist if not in streaming mode (e.g. invoke fallback)
            this.logger.debug(`config.writer not available (non-streaming mode): ${writerErr}`);
          }

          // 6. Format the top 5 results with source citations for the LLM
          const formattedResults = reranked
            .map((point: any, i: number) => {
              const p = point.payload || {};
              const pageRef = p.pageStart === p.pageEnd 
                ? `p. ${p.pageStart}` 
                : `pp. ${p.pageStart}-${p.pageEnd}`;
              
              const source = `${p.fileName} · ${pageRef} · Chunk ${p.chunkIndex}`;

              return `--- Result ${i + 1} (rerank: ${point.rerankScore?.toFixed(3)}) ---\n**Source:** ${source}\n\n${p.text ?? ''}`;
            })
            .join('\n\n');

          // 7. Log observability data (lightweight — IDs + scores only)
          try {
            await this.ragLogModel.create({
              threadId: 'tool_call', // will be enriched later if needed
              query,
              filters: (jurisdiction || docType) ? { jurisdiction, docType } : undefined,
              retrievedCount: results.points.length,
              finalChunks: reranked.map((point: any) => ({
                documentId: point.payload?.documentId,
                fileName: point.payload?.fileName,
                chunkIndex: point.payload?.chunkIndex,
                score: point.rerankScore,
              })),
              rerankerScores: reranked.map((r: any) => parseFloat(r.rerankScore.toFixed(4))),
              latencyMs: Date.now() - startTime,
            });
          } catch (logErr) {
            this.logger.warn(`⚠️ Failed to save RAG log: ${logErr}`);
          }

          return formattedResults;
        } catch (err: any) {
          this.logger.error(`❌ search failed: ${err.message}`);
          return `Error searching documents: ${err.message}. The database may be unavailable.`;
        }
      },
      {
        name: 'search_database',
        description:
          'Search the legal database for case laws, court judgments, precedents, statutes, and uploaded legal documents. ' +
          'Use this tool whenever the user asks about specific legal cases, court judgments, legal precedents, statutory interpretations, or information from the uploaded documents. ' +
          'You can optionally filter by jurisdiction (e.g. Supreme_Court_of_India, Delhi_High_Court, NCLT, ITAT) ' +
          'and/or docType (e.g. court_judgment, tribunal_order, central_act, writ_petition, commercial_contract, criminal_complaint, legal_draft).',
        schema: z.object({
          query: z
            .string()
            .describe('The legal search query, keywords, case title, or statute to look up in the database.'),
          jurisdiction: z
            .string()
            .optional()
            .describe('Optional: filter by court/tribunal (e.g. Supreme_Court_of_India, Delhi_High_Court, NCLT, Competition_Commission_of_India). ONLY provide this if the user explicitly mentions the jurisdiction. Do not guess.'),
          docType: z
            .string()
            .optional()
            .describe('Optional: filter by document type (e.g. court_judgment, tribunal_order, central_act, circular_notification). ONLY provide this if the user explicitly specifies the exact document type. Do not guess, otherwise search will fail.'),
        }),
      },
    );

    return [legalSearchTool];
  }
}
