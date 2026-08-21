import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import { PDFParse } from 'pdf-parse';
import { GoogleDriveService } from './google-drive.service';
import { EmbeddingService } from './embedding.service';
import { QdrantService } from '../qdrant/qdrant.service';
import type { LegalChunkPoint } from '../qdrant/qdrant.service';
import { chunkText } from './chunking.util';

interface ProcessDocumentJob {
  source: 'upload' | 'drive';
  fileName: string;
  driveFileId?: string;
  fileBuffer?: string; // base64, only present for manual uploads
}

@Processor('document-ingestion', { concurrency: 2 })
export class IngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestionProcessor.name);

  constructor(
    private readonly driveService: GoogleDriveService,
    private readonly embeddingService: EmbeddingService,
    private readonly qdrantService: QdrantService,
  ) {
    super();
  }

  /**
   * Extract text from a PDF buffer using pdf-parse v2.
   * PDFParse v2 uses: new PDFParse({ data }) → .getText() → { text }
   */
  private async extractText(pdfBuffer: Buffer): Promise<string> {
    const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
    const result = await parser.getText();
    await parser.destroy();
    return result.text;
  }

  async process(job: Job<ProcessDocumentJob>): Promise<void> {
    const { source, fileName, driveFileId, fileBuffer } = job.data;
    this.logger.log(`Processing "${fileName}" (${source})`);

    // Hybrid approach: stream to disk → read → parse → delete
    // Safe for large PDFs — never holds the full file in RAM during download
    const tempPath = path.join('/tmp', `ingest-${job.id ?? Date.now()}.pdf`);
    let extractedText = '';

    try {
      if (source === 'drive' && driveFileId) {
        // STEP 1: Stream from Drive to disk (no RAM spike)
        await this.driveService.streamPdfToDisk(driveFileId, tempPath);

        // STEP 2: Read from disk into memory for parsing
        const buf = await fs.readFile(tempPath);
        extractedText = await this.extractText(buf);
      } else {
        // Manual upload — already have the buffer as base64
        const buf = Buffer.from(fileBuffer ?? '', 'base64');
        extractedText = await this.extractText(buf);
      }
    } finally {
      // STEP 3: Immediately delete temp file to keep disk clean
      if (existsSync(tempPath)) {
        await fs.unlink(tempPath);
      }
    }

    // 3. Chunk
    const chunks = chunkText(extractedText);
    if (chunks.length === 0) {
      this.logger.warn(`No extractable text in "${fileName}" — skipping`);
      return;
    }

    this.logger.log(`Extracted ${chunks.length} chunks from "${fileName}", embedding...`);

    // 4. Embed — batched call to Python BGE-M3 server
    const { dense, sparse } = await this.embeddingService.embed(
      chunks.map((c) => c.text),
    );

    // 5. Build points and upsert to Qdrant
    const documentId = driveFileId ?? randomUUID();
    const points: LegalChunkPoint[] = chunks.map((chunk, i) => ({
      id: randomUUID(),
      denseVector: dense[i],
      sparseVector: sparse[i],
      payload: {
        text: chunk.text,
        documentId,
        fileName,
        chunkIndex: chunk.index,
      },
    }));

    await this.qdrantService.upsertChunks(points);
    this.logger.log(`✅ Indexed ${points.length} chunks from "${fileName}"`);
  }
}
