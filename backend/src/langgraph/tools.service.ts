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
      async ({ query, jurisdiction, court, docType, documentType }, config: LangGraphRunnableConfig) => {
        this.logger.log(
          `🔧 [Tool Call] search_legal_docs -> query: "${query}"${court ? `, court: ${court}` : ''}${jurisdiction ? `, jurisdiction: ${jurisdiction}` : ''}${documentType || docType ? `, docType: ${documentType || docType}` : ''}`,
        );

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

          // Build Qdrant metadata filter
          const mustFilters: any[] = [];
          if (court) {
            mustFilters.push({ key: 'court', match: { value: court } });
          } else if (jurisdiction) {
            mustFilters.push({ key: 'jurisdiction', match: { value: jurisdiction } });
          }

          const targetDocType = documentType || docType;
          if (targetDocType) {
            mustFilters.push({
              should: [
                { key: 'documentType', match: { value: targetDocType } },
                { key: 'docType', match: { value: targetDocType } },
              ],
            });
          }

          const filter = mustFilters.length > 0 ? { must: mustFilters } : undefined;

          const startQdrant = Date.now();
          // 2. Fetch candidates from Qdrant (top 10 candidates for CPU reranking)
          let results = await this.qdrantService.hybridSearch({
            denseVector,
            sparseVector,
            filter,
            limit: 10,
          });

          // Soft filter fallback: If filtered search returns 0 results, retry without filter
          if ((!results || !results.points || results.points.length === 0) && filter) {
            this.logger.warn(`Filtered search yielded 0 results, falling back to unfiltered hybrid search`);
            results = await this.qdrantService.hybridSearch({
              denseVector,
              sparseVector,
              filter: undefined,
              limit: 10,
            });
          }

          const qdrantTimeMs = Date.now() - startQdrant;
          if (!results || !results.points || results.points.length === 0) {
            return 'No relevant documents found in the database for this query.';
          }

          this.logger.log(`🔍 [Qdrant: ${qdrantTimeMs}ms] Retrieved ${results.points.length} candidates. Sending to re-ranker...`);

          // 3. Re-rank with graceful fallback to Qdrant if reranking fails or times out
          let reranked: any[] = [];
          const candidatePoints = results.points.slice(0, 10);
          const documents = candidatePoints.map((p: any) => p.payload?.text ?? '');

          try {
            const startRerank = Date.now();
            const scores = await this.embeddingService.rerank(query, documents);
            const rerankTimeMs = Date.now() - startRerank;
            this.logger.log(
              `⏱️ [Latency Benchmark] Qdrant: ${qdrantTimeMs}ms | Reranker (${documents.length}): ${rerankTimeMs}ms | Total: ${qdrantTimeMs + rerankTimeMs}ms`,
            );

            // Zip results with re-ranker scores, filter out irrelevant ones, sort descending, take top 5
            const SCORE_THRESHOLD = 0.0;
            reranked = candidatePoints
              .map((point: any, i: number) => ({ ...point, rerankScore: scores[i] }))
              .filter((point: any) => point.rerankScore >= SCORE_THRESHOLD)
              .sort((a: any, b: any) => b.rerankScore - a.rerankScore)
              .slice(0, 5);

            if (reranked.length === 0) {
              this.logger.warn(`⚠️ [Re-ranker] All candidates fell below threshold, falling back to top Qdrant results`);
              reranked = candidatePoints.slice(0, 5);
            } else {
              this.logger.log(`✅ [Re-ranker] Top scores: [${reranked.map((r: any) => r.rerankScore?.toFixed(3)).join(', ')}]`);
            }
          } catch (rerankErr: any) {
            this.logger.warn(
              `⚠️ Reranker timed out or failed (${rerankErr.message}). Gracefully falling back to top Qdrant hybrid results.`,
            );
            reranked = candidatePoints.slice(0, 5);
          }

          // 5. Emit source metadata to the stream via config.writer() (custom stream mode)
          const sourceMeta = reranked.map((point: any) => {
            const p = point.payload || {};
            return {
              fileName: p.fileName ?? '',
              pageStart: p.pageStart ?? 0,
              pageEnd: p.pageEnd ?? 0,
              paragraphNumber: p.paragraphNumber,
              heading: p.heading,
              section: p.section,
              sectionHeading: p.sectionHeading,
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
              const paraRef = p.paragraphNumber ? ` · Para ${p.paragraphNumber}` : '';
              const headingRef = p.sectionHeading ? ` · ${p.sectionHeading}` : p.heading ? ` · ${p.heading}` : '';
              
              const source = `${p.fileName} · ${pageRef}${paraRef}${headingRef} · Chunk ${p.chunkIndex}`;

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
                documentId: point.payload?.driveFileId || point.payload?.documentId,
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
          'You can optionally filter by court (e.g. Supreme Court of India, Delhi High Court), jurisdiction (e.g. All_India, Maharashtra), ' +
          'and/or docType (e.g. court_judgment, court_order, tribunal_order, central_act, circular, notification, petition, legal_contract).',
        schema: z.object({
          query: z
            .string()
            .describe('The legal search query, keywords, case title, or statute to look up in the database.'),
          court: z
            .string()
            .optional()
            .describe('Optional: filter by specific court (e.g. Supreme Court of India, Delhi High Court). ONLY provide if explicitly mentioned in query.'),
          jurisdiction: z
            .string()
            .optional()
            .describe('Optional: filter by jurisdiction (e.g. All_India, Delhi, Maharashtra). ONLY provide if explicitly mentioned in query.'),
          docType: z
            .string()
            .optional()
            .describe('Optional: filter by document type (e.g. court_judgment, court_order, tribunal_order, central_act, circular, notification, petition, legal_contract). ONLY provide if explicitly requested.'),
          documentType: z
            .string()
            .optional()
            .describe('Alias for docType.'),
        }),
      },
    );

    return [legalSearchTool];
  }
}
