import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bullmq';
import { Model } from 'mongoose';
import { GoogleDriveService } from './google-drive.service';
import { QdrantService } from '../qdrant/qdrant.service';
import { IngDoc, IngDocDocument } from './schemas/ingested-document.schema';
import { DriveSyncWorker } from './drive-sync.worker';

/** Shared BullMQ job options: 3 retries with exponential backoff (5s → 25s → 125s) */
const JOB_RETRY_OPTS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
};

@Controller('ingestion')
export class IngestionController {
  constructor(
    @InjectQueue('document-ingestion') private readonly queue: Queue,
    @InjectModel(IngDoc.name) private readonly ingDocModel: Model<IngDocDocument>,
    private readonly driveService: GoogleDriveService,
    private readonly qdrantService: QdrantService,
    private readonly driveSyncWorker: DriveSyncWorker,
  ) { }

  /**
   * Preview all synced files from MongoDB (NO live Google Drive calls).
   * Supports pagination, server-side status filtering, and text search.
   *
   * After the production refactor, this reads exclusively from MongoDB.
   * Files appear here only after clicking "Load File" (trigger-sync).
   */
  @Get('drive-preview')
  async previewDrive(
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
    @Query('status') statusFilter?: string,
    @Query('search') search?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitStr || '50', 10) || 50));
    const offset = (page - 1) * limit;

    // Build the query filter
    const query: Record<string, any> = { status: { $ne: 'deleted' } };
    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'processing') {
        query.status = { $in: ['processing', 'queued'] };
      } else {
        query.status = statusFilter;
      }
    }
    if (search && search.trim()) {
      query.fileName = { $regex: search.trim(), $options: 'i' };
    }

    // Status sort priority: new → processing → queued → failed → completed
    const statusPriority: Record<string, number> = {
      new: 0, processing: 1, queued: 2, failed: 3, completed: 4,
    };

    // Execute all queries in parallel for maximum speed
    const [files, total, summaryCounts] = await Promise.all([
      // 1. Paginated find with index-backed sort
      this.ingDocModel
        .find(query)
        .sort({ status: 1, driveModifiedTime: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),

      // 2. Total for pagination
      this.ingDocModel.countDocuments(query),

      // 3. Fast status breakdown for KPI cards
      this.ingDocModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    // Map aggregation result to clean summary object
    const summary = summaryCounts.reduce(
      (acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      },
      { new: 0, queued: 0, processing: 0, completed: 0, failed: 0, deleted: 0 } as Record<string, number>,
    );

    const totalPages = Math.ceil(total / limit);

    // Map MongoDB docs to the frontend-expected shape
    const mappedFiles = files.map((doc: any) => ({
      id: doc.driveFileId,
      driveFileId: doc.driveFileId,
      fileName: doc.fileName,
      folderPath: doc.folderPath || '/',
      fileSizeBytes: doc.fileSizeBytes,
      modifiedTime: doc.driveModifiedTime
        ? new Date(doc.driveModifiedTime).toISOString()
        : undefined,
      status: doc.status,
      chunkCount: doc.chunkCount || 0,
      processedChunks: doc.processedChunks || 0,
      attemptCount: doc.attemptCount || 0,
      docType: doc.docType,
      jurisdiction: doc.jurisdiction,
      error: doc.error,
    }));

    return {
      summary: {
        totalDriveFiles: (summary.new || 0) + (summary.queued || 0) + (summary.processing || 0) +
          (summary.completed || 0) + (summary.failed || 0),
        newFiles: summary.new || 0,
        completed: summary.completed || 0,
        processing: summary.processing || 0,
        queued: summary.queued || 0,
        failed: summary.failed || 0,
        deleted: summary.deleted || 0,
      },
      files: mappedFiles,
      pagination: { page, limit, total, totalPages },
    };
  }

  /**
   * Manually trigger a Drive → MongoDB background sync.
   * RESUMABLE: If a previous sync crashed, this picks up from the saved bookmark.
   * Returns immediately — the sync runs in the background.
   * Frontend polls /ingestion/sync-state for real-time progress.
   */
  @Post('trigger-sync')
  async triggerSync() {
    return this.driveSyncWorker.startSync();
  }

  /**
   * Force a completely fresh scan — clears all bookmarks and starts from page 1.
   * Use this when you want to catch newly added files that the bookmark might skip.
   */
  @Post('fresh-sync')
  async freshSync() {
    return this.driveSyncWorker.startFreshSync();
  }

  /** Returns current sync state for the frontend progress banner. */
  @Get('sync-state')
  async getSyncState() {
    const state = await this.driveSyncWorker.getSyncState();
    return {
      ...state,
      hasBookmark:
        ((state as any).folderQueue?.length > 0) ||
        (state as any).currentFolder != null,
    };
  }

  /**
   * Dedicated endpoint to fetch soft-deleted documents on demand.
   * Called lazily ONLY when the user opens the "Marked Deleted" tab.
   */
  @Get('deleted-documents')
  async getDeletedDocuments(
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
    @Query('search') search?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitStr || '50', 10) || 50));

    const filter: any = { status: 'deleted' };
    if (search && search.trim()) {
      filter.fileName = { $regex: search.trim(), $options: 'i' };
    }

    const [total, docs] = await Promise.all([
      this.ingDocModel.countDocuments(filter),
      this.ingDocModel
        .find(filter)
        .sort({ deletedAt: -1, updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    const totalPages = Math.ceil(total / limit);

    const files = docs.map((d) => ({
      id: d.driveFileId,
      driveFileId: d.driveFileId,
      fileName: d.fileName,
      folderPath: '/',
      fileSizeBytes: d.fileSizeBytes,
      modifiedTime: d.driveModifiedTime ? new Date(d.driveModifiedTime).toISOString() : undefined,
      status: 'deleted' as const,
      chunkCount: d.chunkCount,
      processedChunks: d.processedChunks,
      attemptCount: d.attemptCount,
      docType: d.docType,
      jurisdiction: d.jurisdiction,
      error: d.error,
      deletedAt: d.deletedAt ? new Date(d.deletedAt).toISOString() : undefined,
    }));

    return {
      files,
      pagination: { page, limit, total, totalPages },
    };
  }


  @Post('sync')
  async syncFromDrive(@Body() body?: { fileIds?: string[] }) {
    // syncDeletions is now called separately via its own "Sync with Drive" button

    const existingDocs = await this.ingDocModel
      .find({ source: 'drive' }, { driveFileId: 1, status: 1, fileName: 1 })
      .lean();

    // Map: driveFileId → MongoDB doc (for lookup)
    const driveFileIdToDoc = new Map<string, any>();
    for (const d of existingDocs) {
      if (d.driveFileId) driveFileIdToDoc.set(d.driveFileId, d);
    }

    let filesToQueue: { id: string; name: string }[] = [];

    if (body?.fileIds && body.fileIds.length > 0) {
      // Selective sync — queue specific files from MongoDB (no Drive API call needed)
      const requestedDocs = await this.ingDocModel
        .find({ driveFileId: { $in: body.fileIds } }, { driveFileId: 1, fileName: 1 })
        .lean();
      filesToQueue = requestedDocs
        .filter((d) => d.driveFileId)
        .map((d) => ({ id: d.driveFileId!, name: d.fileName }));
    } else {
      // Full sync — only new files (files in MongoDB with status 'new')
      const newDocs = await this.ingDocModel
        .find({ source: 'drive', status: 'new' }, { driveFileId: 1, fileName: 1 })
        .lean();
      filesToQueue = newDocs
        .filter((d) => d.driveFileId)
        .map((d) => ({ id: d.driveFileId!, name: d.fileName }));
    }

    for (const file of filesToQueue) {
      // Check if this driveFileId already has a MongoDB doc
      const existingDoc = driveFileIdToDoc.get(file.id);

      if (existingDoc) {
        await this.ingDocModel.updateOne(
          { driveFileId: file.id },
          {
            $set: {
              fileName: file.name || 'unknown.pdf',
              status: 'queued',
              error: null,
              processedChunks: 0,
            },
            $unset: {
              deletedAt: 1,
            },
          },
        );
      } else {
        await this.ingDocModel.create({
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
        },
        { jobId: `drive-${file.id}-${Date.now()}`, ...JOB_RETRY_OPTS },
      );
    }

    return { queued: filesToQueue.length, fileNames: filesToQueue.map((f) => f.name) };
  }

  /**
   * Retry all failed documents.
   * Qdrant cleanup happens inside the processor (Step 0).
   */
  @Post('retry-failed')
  async retryFailed() {
    const failedDocs = await this.ingDocModel.find({ status: 'failed' }).lean();

    for (const doc of failedDocs) {
      await this.ingDocModel.updateOne(
        { driveFileId: doc.driveFileId },
        { status: 'queued', error: null, processedChunks: 0 },
      );

      await this.queue.add(
        'process-document',
        {
          source: doc.source,
          driveFileId: doc.driveFileId,
          fileName: doc.fileName,
        },
        { jobId: `retry-${doc.driveFileId}-${Date.now()}`, ...JOB_RETRY_OPTS },
      );
    }

    return { retriedCount: failedDocs.length };
  }

  /**
   * Detect PDFs deleted from Google Drive and soft-delete them.
   * Sets status='deleted' in MongoDB and removes their chunks from Qdrant.
   */
  @Post('sync-deletions')  //fetch doument form db what is not in drive 
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
        await this.qdrantService.deleteByDriveFileId(doc.driveFileId);
      } catch (e: any) {
        // Log but don't fail — the MongoDB status change is more important
      }

      // Mark as deleted in MongoDB (soft delete — keep the record)
      await this.ingDocModel.updateOne(
        { driveFileId: doc.driveFileId },
        { status: 'deleted', error: 'File removed from Google Drive', deletedAt: new Date() },
      );
    }

    return {
      deletedCount: deletedDocs.length,
      deletedFiles: deletedDocs.map((d) => ({
        id: d.driveFileId,
        driveFileId: d.driveFileId,
        fileName: d.fileName,
      })),
    };
  }

  /** High-level ingestion dashboard summary */
  @Get('dashboard')
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

  /** Check the ingestion status of a document by its driveFileId. */
  @Get('status/:id')
  async getStatus(@Param('id') id: string) {
    const doc = await this.ingDocModel.findOne({ driveFileId: id }).lean();

    if (!doc) {
      return { found: false };
    }

    return {
      found: true,
      id: doc.driveFileId,
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
      deletedAt: doc.deletedAt,
    };
  }
}
