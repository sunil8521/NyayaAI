import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Job } from 'bullmq';
import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { PDFParse } from 'pdf-parse';
import { GoogleDriveService } from './google-drive.service';
import { EmbeddingService } from './embedding.service';
import { QdrantService } from '../qdrant/qdrant.service';
import type { LegalChunkPoint } from '../qdrant/qdrant.service';
import { chunkText, type PageText } from './chunking.util';
import { ChunkValidator } from './chunking/chunk.validator';
import { IngDoc, IngDocDocument } from './schemas/ingested-document.schema';
import { ClassificationService } from './classification/classification.service';

interface ProcessDocumentJob {
  source: 'drive';
  fileName: string;
  driveFileId: string;
}

/** Splits an array into sub-arrays of the given size. */
function batchArray<T>(array: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
    array.slice(i * size, i * size + size),
  );
}

/** PDF magic bytes: %PDF- (hex: 25 50 44 46 2D) */
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D]);

/** Max file size: 100 MB — reject anything larger to prevent OOM */
const MAX_PDF_SIZE = 100 * 1024 * 1024;

/** Timeout for OCR per page in milliseconds (30s per page) */
const OCR_PAGE_TIMEOUT_MS = 30_000;

@Processor('document-ingestion', {
  concurrency: 2,
  lockDuration: 300000,     // 5 min lock — heavy PDFs can block the event loop
  stalledInterval: 60000,   // Check for stalled jobs every 60s
  maxStalledCount: 2,       // Allow 2 stalls before marking as failed
})
export class IngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestionProcessor.name);

  constructor(
    private readonly driveService: GoogleDriveService,
    private readonly embeddingService: EmbeddingService,
    private readonly qdrantService: QdrantService,
    private readonly classificationService: ClassificationService,
    @InjectModel(IngDoc.name) private readonly ingDocModel: Model<IngDocDocument>,
  ) {
    super();
  }

  /**
   * Startup monitor:
   * Does NOT mark all 'processing' documents as failed (which corrupts multi-worker state).
   * BullMQ handles retrying stalled jobs automatically via stalledInterval.
   */
  async onModuleInit() {
    const activeProcessing = await this.ingDocModel.countDocuments({ status: 'processing' });
    if (activeProcessing > 0) {
      this.logger.log(
        `ℹ️ [Startup] Found ${activeProcessing} documents currently in 'processing' state. BullMQ will manage their stalled-job recovery.`,
      );
    }
  }

  private readonly execFileAsync = promisify(execFile);

  /**
   * Validates that a file on disk is a real PDF by checking magic bytes.
   * Reads only the first 5 bytes from disk (zero RAM footprint).
   */
  private async validatePdfFile(pdfPath: string, fileName: string): Promise<void> {
    const stats = await fs.stat(pdfPath);
    if (stats.size < 5) {
      throw new Error(`File "${fileName}" is too small (${stats.size} bytes) — not a valid PDF`);
    }
    if (stats.size > MAX_PDF_SIZE) {
      throw new Error(
        `File "${fileName}" is ${(stats.size / 1024 / 1024).toFixed(1)} MB — exceeds ${MAX_PDF_SIZE / 1024 / 1024} MB limit`,
      );
    }
    const handle = await fs.open(pdfPath, 'r');
    const header = Buffer.alloc(5);
    try {
      await handle.read(header, 0, 5, 0);
    } finally {
      await handle.close();
    }

    if (!header.equals(PDF_MAGIC)) {
      const hexHeader = header.toString('hex');
      throw new Error(
        `File "${fileName}" is not a valid PDF (magic bytes: ${hexHeader}, expected: ${PDF_MAGIC.toString('hex')})`,
      );
    }
  }

  /**
   * Extracts text from a PDF on disk using a three-tier strategy:
   *  1. pdftotext (Poppler) — fast, handles native text-layer PDFs
   *  2. Tesseract OCR fallback — handles scanned/image-based PDFs
   *  3. pdf-parse fallback (last resort)
   *
   * Operates directly on the disk path without loading the entire PDF into a Node buffer.
   */
  private async extractText(
    pdfPath: string,
  ): Promise<{ fullText: string; pages: PageText[] }> {
    // ── TIER 1: pdftotext (native text layer) ────────────────────
    const pdfTextResult = await this.extractWithPdftotext(pdfPath);
    if (pdfTextResult.fullText.trim().length > 50) {
      this.logger.log(`📝 Text extracted via pdftotext (${pdfTextResult.pages.length} pages)`);
      return pdfTextResult;
    }

    // ── TIER 2: Tesseract OCR (scanned/image PDFs) ───────────────
    this.logger.log(`🔍 pdftotext found no text — falling back to Tesseract OCR...`);
    const ocrResult = await this.extractWithOcr(pdfPath);
    if (ocrResult.fullText.trim().length > 10) {
      this.logger.log(`🔍 OCR extracted text from ${ocrResult.pages.length} pages`);
      return ocrResult;
    }

    // ── TIER 3: pdf-parse fallback (last resort) ─────────────────
    this.logger.warn(`⚠️ OCR also failed — trying pdf-parse as last resort`);
    const pdfBuffer = await fs.readFile(pdfPath);
    const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
    const result = await parser.getText();
    await parser.destroy();
    const pages: PageText[] = (result.pages ?? []).map((p: any) => ({
      pageNum: p.num,
      text: p.text,
    }));
    return { fullText: result.text, pages };
  }

  /**
   * Extracts text using Poppler's pdftotext CLI.
   * Writes directly to an output file to avoid Node's execFile maxBuffer (1MB) limit.
   * Splits on form-feed (\f) characters to get per-page text.
   */
  private async extractWithPdftotext(
    pdfPath: string,
  ): Promise<{ fullText: string; pages: PageText[] }> {
    const txtPath = path.join(
      '/tmp',
      `pdftotext-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`,
    );
    try {
      await this.execFileAsync('pdftotext', [pdfPath, txtPath]);

      if (!existsSync(txtPath)) {
        return { fullText: '', pages: [] };
      }

      const stdout = await fs.readFile(txtPath, 'utf-8');
      const pageStrings = stdout.split('\f');
      const pages: PageText[] = [];
      let fullText = '';

      for (let i = 0; i < pageStrings.length; i++) {
        const pageText = pageStrings[i].trim();
        if (pageText) {
          pages.push({ pageNum: i + 1, text: pageText });
          fullText += pageText + '\n\n';
        }
      }

      return { fullText: fullText.trim(), pages };
    } catch (err) {
      this.logger.warn(`pdftotext failed: ${err}`);
      return { fullText: '', pages: [] };
    } finally {
      if (existsSync(txtPath)) {
        await fs.unlink(txtPath).catch(() => {});
      }
    }
  }

  /**
   * Extracts text from scanned/image PDFs using:
   *  1. pdftoppm — converts PDF pages to PNG images (300 DPI)
   *  2. tesseract — runs OCR on each page image
   */
  private async extractWithOcr(
    pdfPath: string,
  ): Promise<{ fullText: string; pages: PageText[] }> {
    const ocrDir = path.join('/tmp', `ocr-${Date.now()}`);
    await fs.mkdir(ocrDir, { recursive: true });

    try {
      // Convert PDF pages to PNG images at 300 DPI
      await this.execFileAsync('pdftoppm', [
        '-png', '-r', '300', pdfPath, path.join(ocrDir, 'page'),
      ]);

      // Find all generated page images, sorted by page number
      const files = await fs.readdir(ocrDir);
      const pageFiles = files
        .filter(f => f.startsWith('page-') && f.endsWith('.png'))
        .sort();

      if (pageFiles.length === 0) {
        this.logger.warn('pdftoppm produced no images');
        return { fullText: '', pages: [] };
      }

      const pages: PageText[] = [];
      let fullText = '';

      // OCR each page image
      for (let i = 0; i < pageFiles.length; i++) {
        const imgPath = path.join(ocrDir, pageFiles[i]);
        try {
          const { stdout } = await this.execFileAsync(
            'tesseract',
            [imgPath, 'stdout', '-l', 'eng', '--psm', '6'],
            { timeout: OCR_PAGE_TIMEOUT_MS },
          );
          const pageText = stdout.trim();
          if (pageText) {
            pages.push({ pageNum: i + 1, text: pageText });
            fullText += pageText + '\n\n';
          }
        } catch (ocrErr) {
          this.logger.warn(`OCR failed for page ${i + 1}: ${ocrErr}`);
        }
      }

      return { fullText: fullText.trim(), pages };
    } finally {
      // Clean up temp images
      await fs.rm(ocrDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  /**
   * Generates a deterministic Qdrant point ID from driveFileId + chunkIndex.
   * This prevents duplicate chunks on retry — upsert just overwrites the same ID.
   */
  private deterministicPointId(driveFileId: string, chunkIndex: number): string {
    const hex = createHash('sha256')
      .update(`${driveFileId}_${chunkIndex}`)
      .digest('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }

  async process(job: Job<ProcessDocumentJob>): Promise<void> {
    const { source, fileName, driveFileId } = job.data;
    this.logger.log(`📄 Processing "${fileName}" (${source}: ${driveFileId})`);

    // Mark as processing & increment attempt counter
    await this.ingDocModel.updateOne(
      { driveFileId },
      { status: 'processing', $inc: { attemptCount: 1 } },
    );

    // ── STEP 0: Idempotent retry — deterministic IDs mean upserts overwrite,
    //    so we do NOT delete old chunks. If the worker crashed at 80% last time,
    //    those 80% are already safely in Qdrant. We just re-upsert everything.
    //    This makes large document processing resumable and crash-safe.

    // Temp file path used for Drive download (owned solely by this worker run)
    const tempPath = path.join('/tmp', `ingest-${job.id ?? Date.now()}.pdf`);
    let extractedText = '';
    let pages: PageText[] = [];

    try {
      if (!driveFileId) {
        throw new Error(`Document "${fileName}" is missing driveFileId`);
      }

      // ── STEP 1: Stream directly from Drive to disk (zero RAM footprint) ─
      await this.driveService.streamPdfToDisk(driveFileId, tempPath);

      // ── STEP 1.5: Validate PDF magic bytes + size directly from disk ─
      await this.validatePdfFile(tempPath, fileName);
      const fileStats = await fs.stat(tempPath);
      this.logger.log(`📋 Validated PDF: ${(fileStats.size / 1024).toFixed(1)} KB`);

      // ── STEP 1.6: Extract text directly from disk path ─────────────
      const extracted = await this.extractText(tempPath);
      extractedText = extracted.fullText;
      pages = extracted.pages;
      this.logger.debug(`RAW EXTRACTED TEXT (first 500 chars):\n${extractedText.substring(0, 500)}`);

      // ── STEP 2: Multi-Stage Document Classification (Rules -> BGE-M3 -> Gemini) ─
      // Run classification BEFORE chunking so chunking is document-type aware!
      const classification = await this.classificationService.classifyDocument(
        fileName,
        extractedText,
        pages,
      );

      this.logger.log(
        `🏷️ Document Classified: "${fileName}" → ${classification.documentType} [${classification.documentSubtype || 'general'}] (${classification.method}, ${(classification.confidence * 100).toFixed(0)}%)`,
      );

      // ── STEP 3: Document-Aware Legal Chunking ──────────────────────
      const rawChunks = chunkText(extractedText, pages, {
        fileName,
        docType: classification.documentType,
        docSubtype: classification.documentSubtype || undefined,
      });

      if (rawChunks.length === 0) {
        this.logger.warn(`No extractable text in "${fileName}" — skipping`);
        await this.ingDocModel.updateOne(
          { driveFileId },
          { status: 'failed', error: 'No extractable text found in PDF', failedAt: new Date() },
        );
        return;
      }

      // ── STEP 4: Token-aware Splitting & Counting (BGE-M3 Tokenizer) ──
      // Count exact tokens using Python BGE-M3 tokenizer
      try {
        const tokenCounts = await this.embeddingService.countTokens(
          rawChunks.map((c) => c.text),
        );
        for (let i = 0; i < rawChunks.length; i++) {
          if (tokenCounts[i] !== undefined) {
            rawChunks[i].tokenCount = tokenCounts[i];
          }
        }
      } catch (err) {
        this.logger.warn(`BGE-M3 token counting service unavailable, using estimated counts: ${err}`);
      }

      // ── STEP 6: Ingestion Chunk Validator Guardrail ─────────────────
      // Enforce quality guardrails: non-empty, valid pages, strict <= 800 tokens max limit
      const { validatedChunks: chunks, droppedCount, issues } = ChunkValidator.validate(rawChunks);

      if (chunks.length === 0) {
        this.logger.warn(`No valid chunks after validation for "${fileName}" — skipping`);
        await this.ingDocModel.updateOne(
          { driveFileId },
          { status: 'failed', error: 'All chunks dropped by validation guardrail', failedAt: new Date() },
        );
        return;
      }

      this.logger.log(
        `Extracted & validated ${chunks.length} chunks from "${fileName}" (${droppedCount} dropped, ${issues.length} issues). Embedding in batches...`,
      );

      // ── STEP 4 & 5: Streaming Pipeline: Batch Embed → Upsert → Checkpoint ──
      // Embeds and upserts in micro-batches of 32 chunks immediately, keeping RAM footprint flat
      const chunkBatches = batchArray(chunks, 32);
      let processedSoFar = 0;

      for (const batch of chunkBatches) {
        const texts = batch.map((c) => c.text);
        const { dense, sparse } = await this.embeddingService.embed(texts);

        const points: LegalChunkPoint[] = batch.map((chunk, idx) => ({
          id: this.deterministicPointId(driveFileId, chunk.index),
          denseVector: dense[idx],
          sparseVector: sparse[idx],
          payload: {
            text: chunk.text,
            driveFileId,
            documentId: driveFileId,
            fileName,
            chunkIndex: chunk.index,
            page: chunk.pageStart,
            pageStart: chunk.pageStart,
            pageEnd: chunk.pageEnd,
            // Unified structural metadata (from chunker)
            chapter: chunk.chapter,
            section: chunk.section,
            sectionHeading: chunk.sectionHeading,
            subsection: chunk.subsection,
            clause: chunk.clause,
            heading: chunk.heading,
            paragraphNumber: chunk.paragraphNumber,
            paragraphNumbers: chunk.paragraphNumbers,
            legalReferences: chunk.legalReferences,
            parentPath: chunk.parentPath,
            isContinuation: chunk.isContinuation,
            tokenCount: chunk.tokenCount,
            // Unified document metadata (from classification)
            documentType: classification.documentType,
            documentSubtype: classification.documentSubtype || undefined,
            court: classification.court || undefined,
            tribunal: classification.tribunal || undefined,
            issuingAuthority: classification.issuingAuthority || undefined,
            jurisdiction: classification.jurisdiction || 'All_India',
            caseNumber: classification.caseNumber || undefined,
            caseTitle: classification.caseTitle || undefined,
            decisionDate: classification.decisionDate || undefined,
            // Legacy fields for backward compatibility
            docType: classification.documentType,
            uploadedAt: new Date().toISOString().split('T')[0],
          },
        }));

        // Upsert this micro-batch immediately to Qdrant (deterministic IDs ensure idempotency)
        await this.qdrantService.upsertChunks(points);

        processedSoFar += batch.length;
        // Checkpoint progress to MongoDB immediately
        await this.ingDocModel.updateOne(
          { driveFileId },
          { processedChunks: processedSoFar, totalChunks: chunks.length },
        );
      }

      // ── STEP 6: Mark completed in MongoDB with full classification ─
      await this.ingDocModel.updateOne(
        { driveFileId },
        {
          status: 'completed',
          chunkCount: chunks.length,
          processedChunks: chunks.length,
          docType: classification.documentType,
          jurisdiction: classification.jurisdiction || 'All_India',
          classification,
          completedAt: new Date(),
        },
      );

      this.logger.log(
        `✅ Indexed ${chunks.length} chunks from "${fileName}" (${classification.documentType} / ${classification.court || classification.tribunal || classification.jurisdiction})`,
      );
    } catch (err: any) {
      this.logger.error(`❌ Failed to process "${fileName}": ${err.message}`);

      // Mark failed in MongoDB so we know what broke
      await this.ingDocModel.updateOne(
        { driveFileId },
        { status: 'failed', error: err.message?.slice(0, 500), failedAt: new Date() },
      );

      throw err; // Re-throw so BullMQ can retry if configured
    } finally {
      // Clean up temp file created exclusively for this worker run
      if (tempPath && existsSync(tempPath)) {
        await fs.unlink(tempPath).catch(() => {});
      }
    }
  }
}
