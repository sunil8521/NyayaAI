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
import { IngDoc, IngDocDocument } from './schemas/ingested-document.schema';

interface ProcessDocumentJob {
  source: 'upload' | 'drive';
  fileName: string;
  documentId: string;
  driveFileId?: string;
  fileBuffer?: string; // base64, legacy fallback for small uploads
  filePath?: string; // disk path, preferred for large uploads
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
    @InjectModel(IngDoc.name) private readonly ingDocModel: Model<IngDocDocument>,
  ) {
    super();
  }

  /**
   * Safety net: runs once when the NestJS server starts.
   * If the server previously crashed while BullMQ was processing,
   * BullMQ's stalledInterval handles retrying the *job*, but MongoDB
   * might still have a stale 'processing' status. This catches those zombies.
   */
  async onModuleInit() {
    const result = await this.ingDocModel.updateMany(
      { status: 'processing' },
      {
        $set: {
          status: 'failed',
          error: 'Server restarted while processing — ready for retry',
          failedAt: new Date()
        }
      }
    );
    if (result.modifiedCount > 0) {
      this.logger.warn(`🧟 Recovered ${result.modifiedCount} zombie documents from 'processing' → 'failed'`);
    }
  }

  private readonly execFileAsync = promisify(execFile);

  /**
   * Validates that a buffer is a real PDF by checking magic bytes.
   * Also enforces max file size to prevent OOM on huge files.
   */
  private validatePdf(buf: Buffer, fileName: string): void {
    if (buf.length < 5) {
      throw new Error(`File "${fileName}" is too small (${buf.length} bytes) — not a valid PDF`);
    }
    if (buf.length > MAX_PDF_SIZE) {
      throw new Error(
        `File "${fileName}" is ${(buf.length / 1024 / 1024).toFixed(1)} MB — exceeds ${MAX_PDF_SIZE / 1024 / 1024} MB limit`,
      );
    }
    const header = buf.subarray(0, 5);
    if (!header.equals(PDF_MAGIC)) {
      const hexHeader = header.toString('hex');
      throw new Error(
        `File "${fileName}" is not a valid PDF (magic bytes: ${hexHeader}, expected: ${PDF_MAGIC.toString('hex')})`,
      );
    }
  }

  /**
   * Extracts text from a PDF, using a two-tier strategy:
   *  1. pdftotext (Poppler) — fast, handles native text-layer PDFs
   *  2. Tesseract OCR fallback — handles scanned/image-based PDFs
   *
   * Returns both the full concatenated text and per-page text for page-level citations.
   */
  private async extractText(
    pdfBuffer: Buffer,
    pdfFilePath?: string,
  ): Promise<{ fullText: string; pages: PageText[] }> {
    // We need a file on disk for CLI tools
    const diskPath = pdfFilePath && existsSync(pdfFilePath)
      ? pdfFilePath
      : path.join('/tmp', `extract-${Date.now()}.pdf`);
    const createdTmp = diskPath !== pdfFilePath;
    if (createdTmp) {
      await fs.writeFile(diskPath, pdfBuffer);
    }

    try {
      // ── TIER 1: pdftotext (native text layer) ────────────────────
      const pdfTextResult = await this.extractWithPdftotext(diskPath);
      if (pdfTextResult.fullText.trim().length > 50) {
        this.logger.log(`📝 Text extracted via pdftotext (${pdfTextResult.pages.length} pages)`);
        return pdfTextResult;
      }

      // ── TIER 2: Tesseract OCR (scanned/image PDFs) ───────────────
      this.logger.log(`🔍 pdftotext found no text — falling back to Tesseract OCR...`);
      const ocrResult = await this.extractWithOcr(diskPath);
      if (ocrResult.fullText.trim().length > 10) {
        this.logger.log(`🔍 OCR extracted text from ${ocrResult.pages.length} pages`);
        return ocrResult;
      }

      // ── TIER 3: pdf-parse fallback (last resort) ─────────────────
      this.logger.warn(`⚠️ OCR also failed — trying pdf-parse as last resort`);
      const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
      const result = await parser.getText();
      await parser.destroy();
      const pages: PageText[] = (result.pages ?? []).map((p: any) => ({
        pageNum: p.num,
        text: p.text,
      }));
      return { fullText: result.text, pages };
    } finally {
      if (createdTmp && existsSync(diskPath)) {
        await fs.unlink(diskPath).catch(() => {});
      }
    }
  }

  /**
   * Extracts text using Poppler's pdftotext CLI.
   * Splits on form-feed (\f) characters to get per-page text.
   */
  private async extractWithPdftotext(
    pdfPath: string,
  ): Promise<{ fullText: string; pages: PageText[] }> {
    try {
      const { stdout } = await this.execFileAsync('pdftotext', [pdfPath, '-']);
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
          const { stdout } = await this.execFileAsync('tesseract', [
            imgPath, 'stdout', '-l', 'eng', '--psm', '6',
          ]);
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
   * Generates a deterministic Qdrant point ID from documentId + chunkIndex.
   * This prevents duplicate chunks on retry — upsert just overwrites the same ID.
   */
  private deterministicPointId(documentId: string, chunkIndex: number): string {
    // UUID v5-style: hash the composite key into a hex string
    return createHash('sha256')
      .update(`${documentId}_${chunkIndex}`)
      .digest('hex')
      .slice(0, 32); // 32 hex chars = 128-bit, fits Qdrant string ID
  }

  private inferDocType(fileName: string, textContent: string = ''): string {
    const combined = `${fileName} ${textContent.slice(0, 4000)}`.toLowerCase();

    // 1. Circulars, Notifications & Government Gazettes
    if (
      combined.includes('circular') ||
      combined.includes('notification') ||
      combined.includes('gazette of india') ||
      combined.includes('guideline') ||
      combined.includes('advisory')
    )
      return 'circular_notification';

    // 2. Central & State Acts, Codes, Rules, Statutes
    if (
      combined.includes('bare act') ||
      combined.includes('statute') ||
      combined.includes('ordinance') ||
      combined.includes('constitution of india') ||
      combined.includes('penal code') ||
      combined.includes('procedure code') ||
      combined.includes('act, 19') ||
      combined.includes('act, 20') ||
      combined.includes('act no.') ||
      combined.includes('rules, 19') ||
      combined.includes('rules, 20') ||
      combined.includes('regulations, 20')
    )
      return 'central_act';

    // 3. Tribunals (NCLT, NCLAT, ITAT, DRT, NGT, RERA, CCI, CESTAT, etc.)
    if (
      combined.includes('nclat') ||
      combined.includes('nclt') ||
      combined.includes('national company law') ||
      /\bitat\b/.test(combined) ||
      combined.includes('income tax appellate') ||
      combined.includes('debt recovery') ||
      /\bdrt\b/.test(combined) ||
      /\bdrat\b/.test(combined) ||
      combined.includes('national green tribunal') ||
      /\bngt\b/.test(combined) ||
      /\brera\b/.test(combined) ||
      combined.includes('competition commission') ||
      /\bcci\b/.test(combined) ||
      combined.includes('cestat') ||
      combined.includes('aptel') ||
      combined.includes('tdsat')
    )
      return 'tribunal_order';

    // 4. Petitions, Writs, Appeals, SLPs, Bail Applications
    if (
      combined.includes('writ petition') ||
      combined.includes('special leave petition') ||
      combined.includes('slp(c)') ||
      combined.includes('slp (c)') ||
      combined.includes('slp(crl)') ||
      combined.includes('criminal appeal') ||
      combined.includes('civil appeal') ||
      combined.includes('bail application') ||
      combined.includes('anticipatory bail') ||
      combined.includes('quashing petition') ||
      combined.includes('section 482') ||
      combined.includes('revision petition') ||
      combined.includes('review petition')
    )
      return 'writ_petition';

    // 5. Commercial Contracts, Agreements, Deeds & MoUs
    if (
      combined.includes('this agreement is made') ||
      combined.includes('memorandum of understanding') ||
      combined.includes('non-disclosure agreement') ||
      combined.includes('lease deed') ||
      combined.includes('sale deed') ||
      combined.includes('power of attorney') ||
      combined.includes('service agreement') ||
      combined.includes('employment agreement') ||
      combined.includes('indemnity bond') ||
      combined.includes('commercial contract')
    )
      return 'commercial_contract';

    // 6. Criminal Complaints, FIRs, Chargesheets
    if (
      combined.includes('first information report') ||
      combined.includes('fir no') ||
      combined.includes('chargesheet') ||
      combined.includes('charge sheet') ||
      combined.includes('police report under section 173') ||
      combined.includes('complaint under section 138') ||
      combined.includes('complaint under section 156(3)') ||
      combined.includes('central bureau of investigation') ||
      combined.includes('enforcement directorate')
    )
      return 'criminal_complaint';

    // 7. Court Judgments, Orders, Precedents & Law Reports
    if (
      combined.includes('judgment') ||
      combined.includes('judgement') ||
      combined.includes('order passed on') ||
      combined.includes('ruling') ||
      combined.includes('coram:') ||
      combined.includes('bench:') ||
      combined.includes('appellant') ||
      combined.includes('petitioner') ||
      combined.includes('respondent') ||
      combined.includes('versus') ||
      combined.includes('vs.') ||
      combined.includes('v.') ||
      combined.includes('air 19') ||
      combined.includes('air 20') ||
      combined.includes('scc ') ||
      combined.includes('scr ')
    )
      return 'court_judgment';

    // 8. Legal Drafts, Notices, Opinions & Written Statements
    if (
      combined.includes('legal notice') ||
      combined.includes('reply to legal notice') ||
      combined.includes('written statement') ||
      combined.includes('rejoinder') ||
      combined.includes('affidavit') ||
      combined.includes('legal opinion')
    )
      return 'legal_draft';

    return 'general_legal';
  }

  private inferJurisdiction(fileName: string, textContent: string = ''): string {
    const combined = `${fileName} ${textContent.slice(0, 4000)}`.toLowerCase();

    // 1. Supreme Court of India
    if (
      combined.includes('supreme court of india') ||
      combined.includes('in the supreme court') ||
      combined.includes('hon\'ble supreme court') ||
      combined.includes('honble supreme court') ||
      combined.includes('supreme_court') ||
      /\bsci\b/.test(combined)
    )
      return 'Supreme_Court_of_India';

    // 2. Tribunals & Regulatory Bodies
    if (combined.includes('nclat') || combined.includes('company law appellate tribunal'))
      return 'NCLAT';
    if (combined.includes('nclt') || combined.includes('national company law tribunal'))
      return 'NCLT';
    if (/\bitat\b/.test(combined) || combined.includes('income tax appellate tribunal'))
      return 'ITAT';
    if (/\bdrat\b/.test(combined) || combined.includes('debts recovery appellate tribunal'))
      return 'DRAT';
    if (/\bdrt\b/.test(combined) || combined.includes('debts recovery tribunal'))
      return 'DRT';
    if (combined.includes('national green tribunal') || /\bngt\b/.test(combined))
      return 'National_Green_Tribunal';
    if (/\brera\b/.test(combined) || combined.includes('real estate regulatory'))
      return 'RERA';
    if (combined.includes('competition commission of india') || /\bcci\b/.test(combined))
      return 'Competition_Commission_of_India';
    if (combined.includes('cestat') || combined.includes('customs excise and service tax'))
      return 'CESTAT';
    if (combined.includes('aptel') || combined.includes('appellate tribunal for electricity'))
      return 'APTEL';
    if (combined.includes('tdsat') || combined.includes('telecom disputes settlement'))
      return 'TDSAT';
    if (combined.includes('reserve bank of india') || combined.includes('rbi/'))
      return 'Reserve_Bank_of_India';
    if (combined.includes('sebi') || combined.includes('securities and exchange board of india'))
      return 'SEBI';

    // 3. Indian High Courts (All Major High Courts)
    if (combined.includes('high court of delhi') || combined.includes('delhi high court') || combined.includes('dhc'))
      return 'Delhi_High_Court';
    if (combined.includes('high court of judicature at bombay') || combined.includes('bombay high court') || combined.includes('bhc') || combined.includes('mumbai'))
      return 'Bombay_High_Court';
    if (combined.includes('high court at calcutta') || combined.includes('calcutta high court') || combined.includes('chc') || combined.includes('kolkata'))
      return 'Calcutta_High_Court';
    if (combined.includes('high court of judicature at madras') || combined.includes('madras high court') || combined.includes('mhc') || combined.includes('chennai'))
      return 'Madras_High_Court';
    if (combined.includes('high court of judicature at allahabad') || combined.includes('allahabad high court') || combined.includes('ahc') || combined.includes('lucknow bench'))
      return 'Allahabad_High_Court';
    if (combined.includes('high court of karnataka') || combined.includes('karnataka high court') || combined.includes('khc') || combined.includes('bengaluru') || combined.includes('bangalore'))
      return 'Karnataka_High_Court';
    if (combined.includes('punjab and haryana high court') || combined.includes('phhc') || combined.includes('chandigarh'))
      return 'Punjab_and_Haryana_High_Court';
    if (combined.includes('high court of gujarat') || combined.includes('gujarat high court') || combined.includes('ghc') || combined.includes('ahmedabad'))
      return 'Gujarat_High_Court';
    if (combined.includes('high court of judicature for rajasthan') || combined.includes('rajasthan high court') || combined.includes('rhc') || combined.includes('jaipur bench') || combined.includes('jodhpur bench'))
      return 'Rajasthan_High_Court';
    if (combined.includes('high court of kerala') || combined.includes('kerala high court') || combined.includes('klhc') || combined.includes('ernakulam') || combined.includes('cochin'))
      return 'Kerala_High_Court';
    if (combined.includes('high court for the state of telangana') || combined.includes('telangana high court') || combined.includes('tshc') || combined.includes('hyderabad'))
      return 'Telangana_High_Court';
    if (combined.includes('high court of andhra pradesh') || combined.includes('andhra pradesh high court') || combined.includes('aphc') || combined.includes('amaravati'))
      return 'Andhra_Pradesh_High_Court';
    if (combined.includes('high court of judicature at patna') || combined.includes('patna high court') || combined.includes('phc') || combined.includes('bihar'))
      return 'Patna_High_Court';
    if (combined.includes('high court of madhya pradesh') || combined.includes('madhya pradesh high court') || combined.includes('mphc') || combined.includes('jabalpur') || combined.includes('indore bench') || combined.includes('gwalior bench'))
      return 'Madhya_Pradesh_High_Court';
    if (combined.includes('gauhati high court') || combined.includes('guwahati') || combined.includes('ghc_assam'))
      return 'Gauhati_High_Court';
    if (combined.includes('orissa high court') || combined.includes('high court of orissa') || combined.includes('cuttack') || combined.includes('ohc'))
      return 'Orissa_High_Court';
    if (combined.includes('high court of jharkhand') || combined.includes('jharkhand high court') || combined.includes('ranchi') || combined.includes('jhc'))
      return 'Jharkhand_High_Court';
    if (combined.includes('high court of chhattisgarh') || combined.includes('chhattisgarh high court') || combined.includes('bilaspur') || combined.includes('cghc'))
      return 'Chhattisgarh_High_Court';
    if (combined.includes('high court of uttarakhand') || combined.includes('uttarakhand high court') || combined.includes('nainital') || combined.includes('ukhc'))
      return 'Uttarakhand_High_Court';
    if (combined.includes('high court of himachal pradesh') || combined.includes('himachal pradesh high court') || combined.includes('shimla') || combined.includes('hphc'))
      return 'Himachal_Pradesh_High_Court';
    if (combined.includes('high court of jammu and kashmir') || combined.includes('jammu and kashmir high court') || combined.includes('srinagar') || combined.includes('jkhc'))
      return 'Jammu_and_Kashmir_High_Court';

    return 'All_India_Generic';
  }

  async process(job: Job<ProcessDocumentJob>): Promise<void> {
    const { source, fileName, driveFileId, fileBuffer, filePath, documentId } =
      job.data;
    this.logger.log(`📄 Processing "${fileName}" (${source})`);

    // Mark as processing & increment attempt counter
    await this.ingDocModel.updateOne(
      { documentId },
      { status: 'processing', $inc: { attemptCount: 1 } },
    );

    // ── STEP 0: Idempotent retry — deterministic IDs mean upserts overwrite,
    //    so we do NOT delete old chunks. If the worker crashed at 80% last time,
    //    those 80% are already safely in Qdrant. We just re-upsert everything.
    //    This makes large document processing resumable and crash-safe.

    // Temp file path used only for Drive downloads
    const tempPath = path.join('/tmp', `ingest-${job.id ?? Date.now()}.pdf`);
    let extractedText = '';
    let pages: PageText[] = [];

    try {
      // ── STEP 1: Get the PDF buffer ──────────────────────────────
      let buf: Buffer;
      let diskPath: string | undefined;

      if (source === 'drive' && driveFileId) {
        await this.driveService.streamPdfToDisk(driveFileId, tempPath);
        buf = await fs.readFile(tempPath);
        diskPath = tempPath;
      } else if (filePath) {
        buf = await fs.readFile(filePath);
        diskPath = filePath;
      } else {
        buf = Buffer.from(fileBuffer ?? '', 'base64');
      }

      // ── STEP 1.5: Validate PDF magic bytes + size ───────────────
      this.validatePdf(buf, fileName);
      this.logger.log(`📋 Validated PDF: ${(buf.length / 1024).toFixed(1)} KB`);

      const extracted = await this.extractText(buf, diskPath);
      extractedText = extracted.fullText;
      pages = extracted.pages;
      this.logger.debug(`RAW EXTRACTED TEXT (first 500 chars):\n${extractedText.substring(0, 500)}`);

      // ── STEP 2: Chunk (with page tracking) ─────────────────────
      const chunks = chunkText(extractedText, pages, fileName);
      if (chunks.length === 0) {
        this.logger.warn(`No extractable text in "${fileName}" — skipping`);
        await this.ingDocModel.updateOne(
          { documentId },
          { status: 'failed', error: 'No extractable text found in PDF', failedAt: new Date() },
        );
        return;
      }

      this.logger.log(
        `Extracted ${chunks.length} chunks from "${fileName}". Embedding in batches...`,
      );

      // ── STEP 3: Embed in safe micro-batches of 32 ─────────────
      const textBatches = batchArray(
        chunks.map((c) => c.text),
        32,
      );
      const allDense: number[][] = [];
      const allSparse: { indices: number[]; values: number[] }[] = [];

      for (const batch of textBatches) {
        const { dense, sparse } = await this.embeddingService.embed(batch);
        allDense.push(...dense);
        allSparse.push(...sparse);
      }

      // ── STEP 4: Build Qdrant points with deterministic IDs + page metadata ─
      let docType = this.inferDocType(fileName, extractedText);
      const jurisdiction = this.inferJurisdiction(fileName, extractedText);

      // Fallback: if rules returned 'general_legal', try embedding-based classification
      if (docType === 'general_legal') {
        try {
          const textSample = extractedText.slice(0, 4000);
          const classification = await this.embeddingService.classify(textSample);
          if (classification.confidence >= 0.6) {
            this.logger.log(
              `🤖 [Classifier] Rule-based → general_legal, embedding → ${classification.docType} (${(classification.confidence * 100).toFixed(1)}%)`,
            );
            docType = classification.docType;
          } else {
            this.logger.log(
              `🤖 [Classifier] Low confidence (${(classification.confidence * 100).toFixed(1)}%), keeping general_legal`,
            );
          }
        } catch (err) {
          this.logger.warn(`⚠️ Embedding classifier failed, keeping general_legal: ${err}`);
        }
      }

      const points: LegalChunkPoint[] = chunks.map((chunk, i) => ({
        id: this.deterministicPointId(documentId, chunk.index),
        denseVector: allDense[i],
        sparseVector: allSparse[i],
        payload: {
          text: chunk.text,
          documentId,
          fileName,
          chunkIndex: chunk.index,
          pageStart: chunk.pageStart,
          pageEnd: chunk.pageEnd,
          section: chunk.section,
          docType,
          jurisdiction,
          uploadedAt: new Date().toISOString().split('T')[0],
        },
      }));

      // ── STEP 5: Upsert in batches of 200 ──────────────────────
      const pointBatches = batchArray(points, 200);
      let processedSoFar = 0;
      for (const batch of pointBatches) {
        await this.qdrantService.upsertChunks(batch);
        processedSoFar += batch.length;
        // Update processedChunks in MongoDB for progress tracking
        await this.ingDocModel.updateOne(
          { documentId },
          { processedChunks: processedSoFar },
        );
      }

      // ── STEP 6: Mark completed in MongoDB ──────────────────────
      await this.ingDocModel.updateOne(
        { documentId },
        {
          status: 'completed',
          chunkCount: points.length,
          processedChunks: points.length,
          docType,
          jurisdiction,
          completedAt: new Date(),
        },
      );

      this.logger.log(
        `✅ Indexed ${points.length} chunks from "${fileName}" (${docType} / ${jurisdiction})`,
      );
    } catch (err: any) {
      this.logger.error(`❌ Failed to process "${fileName}": ${err.message}`);

      // Mark failed in MongoDB so we know what broke
      await this.ingDocModel.updateOne(
        { documentId },
        { status: 'failed', error: err.message?.slice(0, 500), failedAt: new Date() },
      );

      throw err; // Re-throw so BullMQ can retry if configured
    } finally {
      // Clean up temp files
      for (const p of [tempPath, filePath]) {
        if (p && existsSync(p)) {
          await fs.unlink(p).catch(() => { });
        }
      }
    }
  }
}
