import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bullmq';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { GoogleDriveService } from './google-drive.service';
import { QdrantService } from '../qdrant/qdrant.service';
import { IngDoc, IngDocDocument } from './schemas/ingested-document.schema';

@Controller('ingestion')
export class IngestionController {
  constructor(
    @InjectQueue('document-ingestion') private readonly queue: Queue,
    @InjectModel(IngDoc.name) private readonly ingDocModel: Model<IngDocDocument>,
    private readonly driveService: GoogleDriveService,
    private readonly qdrantService: QdrantService,
  ) {}

  /**
   * Manual PDF upload — writes file to /tmp and passes the path
   * into BullMQ instead of stuffing the raw base64 into Redis RAM.
   */
  @Post('upload')
  @AllowAnonymous() 
  @UseInterceptors(FileInterceptor('file'))
  async uploadPdf(@UploadedFile() file: Express.Multer.File) {
    const documentId = randomUUID();
    const jobId = `manual-${Date.now()}`;

    // Write uploaded file to /tmp so Redis only stores a small path string
    const tmpPath = path.join('/tmp', `upload-${documentId}.pdf`);
    await fs.writeFile(tmpPath, file.buffer);

    // Track this document in MongoDB
    await this.ingDocModel.create({
      documentId,
      fileName: file.originalname,
      source: 'upload',
      status: 'queued',
      fileSizeBytes: file.size,
    });

    await this.queue.add(
      'process-document',
      {
        source: 'upload',
        fileName: file.originalname,
        filePath: tmpPath,
        documentId,
      },
      { jobId },
    );

    return { queued: true, jobId, documentId };
  }

  /**
   * Preview all PDFs in Drive and compare with MongoDB database.
   * Shows which files are New, Completed, Processing, or Failed.
   */
  @Get('drive-preview')
  @AllowAnonymous()
  async previewDrive() {
    // 1. Fetch all PDFs across all subfolders in Drive
    const driveFiles = await this.driveService.listAllPdfsRecursively();

    // 2. Fetch all existing documents from MongoDB
    const existingDocs = await this.ingDocModel.find().lean();

    // Build lookup by driveFileId (for Drive-sourced docs)
    const driveFileMap = new Map<string, any>();
    for (const d of existingDocs) {
      if (d.driveFileId) driveFileMap.set(d.driveFileId, d);
    }

    // 3. Match Drive files with database records
    const files = driveFiles.map((df) => {
      const existing = driveFileMap.get(df.id);
      return {
        id: df.id,
        documentId: existing?.documentId,
        fileName: df.name,
        folderPath: df.folderPath,
        fileSizeBytes: df.fileSizeBytes,
        modifiedTime: df.modifiedTime,
        status: existing ? existing.status : 'new',
        chunkCount: existing ? existing.chunkCount : 0,
        processedChunks: existing?.processedChunks ?? 0,
        attemptCount: existing?.attemptCount ?? 0,
        docType: existing ? existing.docType : undefined,
        jurisdiction: existing ? existing.jurisdiction : undefined,
        error: existing ? existing.error : undefined,
      };
    });

    const summary = {
      totalDriveFiles: files.length,
      newFiles: files.filter((f) => f.status === 'new').length,
      completed: files.filter((f) => f.status === 'completed').length,
      processing: files.filter((f) => f.status === 'processing').length,
      queued: files.filter((f) => f.status === 'queued').length,
      failed: files.filter((f) => f.status === 'failed').length,
    };

    return { summary, files };
  }

  /**
   * Triggers a Drive folder sync.
   * If body contains { fileIds: ['driveId1', 'driveId2'] }, only those files are queued.
   * Otherwise, all new PDFs across all subfolders are queued.
   *
   * Key change: documentId = UUID (not driveFileId). driveFileId is stored separately.
   */
  @Post('sync')
  @AllowAnonymous()
  async syncFromDrive(@Body() body?: { fileIds?: string[] }) {
    const existingDocs = await this.ingDocModel
      .find({ source: 'drive' }, { driveFileId: 1, documentId: 1, status: 1 })
      .lean();

    // Map: driveFileId → MongoDB doc (for lookup)
    const driveFileIdToDoc = new Map<string, any>();
    for (const d of existingDocs) {
      if (d.driveFileId) driveFileIdToDoc.set(d.driveFileId, d);
    }

    // Set of driveFileIds that are already completed/processing/queued (skip them)
    const completedOrActiveIds = new Set<string>(
      existingDocs
        .filter((d) => d.status !== 'failed' && d.status !== 'deleted')
        .map((d) => d.driveFileId)
        .filter(Boolean) as string[],
    );

    let filesToQueue: { id: string; name: string }[] = [];

    if (body?.fileIds && body.fileIds.length > 0) {
      // Selective sync — queue specific files (even if they were previously completed)
      const requestedSet = new Set(body.fileIds);
      const allFiles = await this.driveService.listAllPdfsRecursively();
      filesToQueue = allFiles.filter((f) => requestedSet.has(f.id));
    } else {
      // Full sync — only new files
      filesToQueue = await this.driveService.listNewPdfs(completedOrActiveIds);
    }

    for (const file of filesToQueue) {
      // Check if this driveFileId already has a MongoDB doc
      const existingDoc = driveFileIdToDoc.get(file.id);

      let documentId: string;
      if (existingDoc) {
        // Reuse the existing UUID documentId (for retry or re-sync)
        documentId = existingDoc.documentId;
        await this.ingDocModel.updateOne(
          { documentId },
          {
            $set: {
              fileName: file.name || 'unknown.pdf',
              status: 'queued',
              error: null,
              processedChunks: 0,
            },
          },
        );
      } else {
        // Brand new file → generate a UUID
        documentId = randomUUID();
        await this.ingDocModel.create({
          documentId,
          fileName: file.name || 'unknown.pdf',
          source: 'drive',
          driveFileId: file.id,
          status: 'queued',
        });
      }

      await this.queue.add(
        'process-document',
        {
          source: 'drive',
          driveFileId: file.id,
          fileName: file.name,
          documentId,
        },
        { jobId: `drive-${documentId}-${Date.now()}` },
      );
    }

    return { queued: filesToQueue.length, fileNames: filesToQueue.map((f) => f.name) };
  }

  /**
   * Retry all failed documents.
   * Qdrant cleanup happens inside the processor (Step 0).
   */
  @Post('retry-failed')
  @AllowAnonymous()
  async retryFailed() {
    const failedDocs = await this.ingDocModel.find({ status: 'failed' }).lean();

    for (const doc of failedDocs) {
      await this.ingDocModel.updateOne(
        { documentId: doc.documentId },
        { status: 'queued', error: null, processedChunks: 0 },
      );

      await this.queue.add(
        'process-document',
        {
          source: doc.source,
          driveFileId: doc.driveFileId,
          fileName: doc.fileName,
          documentId: doc.documentId,
        },
        { jobId: `retry-${doc.documentId}-${Date.now()}` },
      );
    }

    return { retriedCount: failedDocs.length };
  }

  /**
   * Detect PDFs deleted from Google Drive and soft-delete them.
   * Sets status='deleted' in MongoDB and removes their chunks from Qdrant.
   */
  @Post('sync-deletions')
  @AllowAnonymous()
  async syncDeletions() {
    // 1. Get all drive-sourced docs that are NOT already deleted
    const driveDocs = await this.ingDocModel
      .find({ source: 'drive', status: { $ne: 'deleted' } })
      .lean();

    if (driveDocs.length === 0) {
      return { deletedCount: 0, deletedFiles: [] };
    }

    // 2. Get current Drive files
    const driveFiles = await this.driveService.listAllPdfsRecursively();
    const currentDriveIds = new Set(driveFiles.map((f) => f.id));

    // 3. Find docs whose driveFileId no longer exists in Drive
    const deletedDocs = driveDocs.filter(
      (d) => d.driveFileId && !currentDriveIds.has(d.driveFileId),
    );

    // 4. Soft-delete each one
    for (const doc of deletedDocs) {
      // Remove chunks from Qdrant
      try {
        await this.qdrantService.deleteByDocumentId(doc.documentId);
      } catch (e: any) {
        // Log but don't fail — the MongoDB status change is more important
      }

      // Mark as deleted in MongoDB (soft delete — keep the record)
      await this.ingDocModel.updateOne(
        { documentId: doc.documentId },
        { status: 'deleted', error: 'File removed from Google Drive' },
      );
    }

    return {
      deletedCount: deletedDocs.length,
      deletedFiles: deletedDocs.map((d) => ({
        documentId: d.documentId,
        fileName: d.fileName,
        driveFileId: d.driveFileId,
      })),
    };
  }

  /** High-level ingestion dashboard summary */
  @Get('dashboard')
  @AllowAnonymous()
  async getDashboard() {
    const [total, completed, failed, processing, queued, deleted] = await Promise.all([
      this.ingDocModel.countDocuments(),
      this.ingDocModel.countDocuments({ status: 'completed' }),
      this.ingDocModel.countDocuments({ status: 'failed' }),
      this.ingDocModel.countDocuments({ status: 'processing' }),
      this.ingDocModel.countDocuments({ status: 'queued' }),
      this.ingDocModel.countDocuments({ status: 'deleted' }),
    ]);

    const recent = await this.ingDocModel
      .find()
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return {
      stats: { total, completed, failed, processing, queued, deleted },
      recentDocuments: recent,
    };
  }

  /** Check the ingestion status of a document by its documentId. */
  @Get('status/:documentId')
  @AllowAnonymous()
  async getStatus(@Param('documentId') documentId: string) {
    const doc = await this.ingDocModel.findOne({ documentId }).lean();

    if (!doc) {
      return { found: false };
    }

    return {
      found: true,
      documentId: doc.documentId,
      driveFileId: doc.driveFileId,
      fileName: doc.fileName,
      source: doc.source,
      status: doc.status,
      chunkCount: doc.chunkCount,
      processedChunks: doc.processedChunks,
      attemptCount: doc.attemptCount,
      docType: doc.docType,
      jurisdiction: doc.jurisdiction,
      error: doc.error,
      createdAt: (doc as any).createdAt,
      completedAt: doc.completedAt,
      failedAt: doc.failedAt,
    };
  }
}
