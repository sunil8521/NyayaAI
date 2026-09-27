import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { GoogleDriveService } from './google-drive.service';
import { IngDoc, IngDocDocument } from './schemas/ingested-document.schema';
import {
  SyncState,
  SyncStateDocument,
  FolderQueueItem,
} from './schemas/sync-state.schema';

const SYNC_KEY = 'drive-sync';
const PAGE_SIZE = 1000;

/** Delay between Drive API calls to respect rate limits (ms) */
const API_COOLDOWN_MS = 200;

/**
 * Background sync worker that catalogs Google Drive files into MongoDB.
 *
 * This is NOT a cron job — it is triggered manually when the user clicks
 * "Load File" in the dashboard. It runs in the background (fire-and-forget)
 * so the API response returns immediately.
 *
 * Architecture:
 * - Uses Drive's native pageToken pagination (1000 files/batch)
 * - Performs bulkWrite upserts into MongoDB ($setOnInsert = won't overwrite active files)
 * - Recursively traverses nested folders via a BFS queue
 * - RESUMABLE: Persists the entire BFS queue + page token to MongoDB after every batch.
 *   If the server crashes or Google times out, the next "Load File" click picks up from
 *   the exact point it stopped — no re-scanning of already-processed folders.
 * - Updates SyncState in MongoDB so the frontend can poll for progress
 */
@Injectable()
export class DriveSyncWorker implements OnApplicationShutdown {
  private readonly logger = new Logger(DriveSyncWorker.name);

  constructor(
    private readonly driveService: GoogleDriveService,
    @InjectModel(IngDoc.name)
    private readonly ingDocModel: Model<IngDocDocument>,
    @InjectModel(SyncState.name)
    private readonly syncStateModel: Model<SyncStateDocument>,
  ) {}

  /**
   * Graceful shutdown hook (like process.on('SIGINT') in Express).
   * Ensures the sync flag is cleanly turned off when you press Ctrl+C
   * or the server restarts.
   */
  async onApplicationShutdown(signal?: string) {
    await this.syncStateModel.updateOne(
      { key: SYNC_KEY },
      { $set: { isSyncRunning: false } },
    );
    this.logger.log(`🛑 Graceful shutdown (${signal}): Cleared sync state`);
  }

  /**
   * Returns the current sync state. Creates the singleton doc if it doesn't exist.
   */
  async getSyncState(): Promise<SyncState & { updatedAt?: Date }> {
    let state = await this.syncStateModel.findOne({ key: SYNC_KEY }).lean();
    if (!state) {
      state = await this.syncStateModel.create({ key: SYNC_KEY });
    }
    return state as any;
  }

  /**
   * Starts or RESUMES the Drive → MongoDB sync.
   * - If a bookmark exists (from a previous crash/timeout), it resumes from that point.
   * - If no bookmark exists, it starts a fresh scan from the root folder.
   * - Returns immediately if a sync is already running.
   */
  async startSync(): Promise<{ started: boolean; message: string }> {
    const state = await this.getSyncState();

    if (state.isSyncRunning) {
      return {
        started: false,
        message: 'A sync is already running. Please wait for it to complete.',
      };
    }

    const hasBookmark =
      (state.folderQueue && state.folderQueue.length > 0) ||
      state.currentFolder != null;

    // Mark sync as started — preserve counters if resuming
    await this.syncStateModel.updateOne(
      { key: SYNC_KEY },
      {
        $set: {
          isSyncRunning: true,
          lastSyncStartedAt: new Date(),
          lastSyncError: null,
          // Only reset counters for a completely fresh scan
          ...(hasBookmark
            ? {}
            : { currentSyncProcessed: 0, lastSyncNewFiles: 0 }),
        },
      },
      { upsert: true },
    );

    // Fire-and-forget — run the sync in the background
    this.runSync().catch((err) => {
      this.logger.error(`Sync crashed unexpectedly: ${err.message}`);
    });

    return {
      started: true,
      message: hasBookmark
        ? `Resuming sync from saved bookmark (${state.currentSyncProcessed} files already processed)...`
        : 'Starting fresh sync from the beginning.',
    };
  }

  /**
   * Forces a completely fresh scan by clearing all bookmarks,
   * then starting the sync from page 1 of the root folder.
   */
  async startFreshSync(): Promise<{ started: boolean; message: string }> {
    const state = await this.getSyncState();

    if (state.isSyncRunning) {
      return {
        started: false,
        message: 'A sync is already running. Please wait for it to complete.',
      };
    }

    // Clear everything — bookmarks, counters, errors
    await this.syncStateModel.updateOne(
      { key: SYNC_KEY },
      {
        $set: {
          isSyncRunning: true,
          lastSyncStartedAt: new Date(),
          lastSyncError: null,
          currentSyncProcessed: 0,
          lastSyncNewFiles: 0,
          folderQueue: [],
          currentFolder: null,
          currentFolderPageToken: null,
        },
      },
      { upsert: true },
    );

    this.runSync().catch((err) => {
      this.logger.error(`Fresh sync crashed unexpectedly: ${err.message}`);
    });

    return {
      started: true,
      message: 'Starting fresh sync — all bookmarks cleared.',
    };
  }

  /**
   * The actual sync logic — resumable BFS traversal of all Drive folders.
   *
   * On every batch, the full BFS state (queue + page token + counters)
   * is persisted to MongoDB. This makes the sync crash-safe:
   *
   *   Crash at file 81,354 → restart → resume from file 81,354
   *
   * No wasted API calls, no re-scanning of already-processed folders.
   */
  private async runSync(): Promise<void> {
    const rootFolderId = this.driveService.getRootFolderId();
    if (!rootFolderId) {
      await this.markSyncComplete(0, 0, 'No GDRIVE_FOLDER_ID configured');
      return;
    }

    // ── Load saved state (resume) or initialize fresh ──────────────
    const state = await this.getSyncState();

    let totalFilesProcessed = state.currentSyncProcessed || 0;
    let newFilesAdded = state.lastSyncNewFiles || 0;

    // Restore BFS queue from MongoDB, or start fresh
    const folderQueue: FolderQueueItem[] =
      state.folderQueue && state.folderQueue.length > 0
        ? [...state.folderQueue]
        : [];

    // If we have a currentFolder (was mid-scan when crashed), push it to front
    let currentFolder: FolderQueueItem | null = state.currentFolder || null;
    let pageToken: string | undefined =
      state.currentFolderPageToken || undefined;

    // Fresh start: seed the queue with root folder
    if (!currentFolder && folderQueue.length === 0) {
      currentFolder = { id: rootFolderId, path: '' };
      this.logger.log('🔄 Starting Drive → MongoDB sync (fresh start)...');
    } else {
      this.logger.log(
        `🔄 Resuming Drive → MongoDB sync from bookmark ` +
          `(${totalFilesProcessed} files already processed, ` +
          `${folderQueue.length} folders remaining in queue)...`,
      );
    }

    try {
      // ── BFS loop: process currentFolder, then pop from queue ────
      while (currentFolder) {
        // Paginate through all items in this folder
        do {
          const page = await this.driveService.getPdfsPage(
            currentFolder.id,
            PAGE_SIZE,
            pageToken,
          );

          pageToken = page.nextPageToken;

          // Queue discovered subfolders for traversal
          for (const sub of page.folders) {
            const subPath = currentFolder.path
              ? `${currentFolder.path}/${sub.name}`
              : sub.name;
            folderQueue.push({ id: sub.id, path: subPath });
          }

          // Process PDFs in this batch
          if (page.files.length > 0) {
            const filesWithPaths = page.files.map((f) => ({
              ...f,
              folderPath: currentFolder!.path || '/',
            }));

            const bulkOps = filesWithPaths.map((df) => ({
              updateOne: {
                filter: { driveFileId: df.id },
                update: {
                  $setOnInsert: {
                    documentId: randomUUID(),
                    driveFileId: df.id,
                    fileName: df.name,
                    folderPath: df.folderPath,
                    fileSizeBytes: df.fileSizeBytes,
                    driveModifiedTime: df.modifiedTime
                      ? new Date(df.modifiedTime)
                      : undefined,
                    source: 'drive' as const,
                    status: 'new' as const,
                    chunkCount: 0,
                    processedChunks: 0,
                    attemptCount: 0,
                  },
                },
                upsert: true,
              },
            }));

            const result = await this.ingDocModel.bulkWrite(bulkOps);
            newFilesAdded += result.upsertedCount;
            totalFilesProcessed += page.files.length;
          }

          // ── PERSIST BOOKMARK after every batch ──────────────────
          // This is the critical line that makes sync resumable.
          // If the process dies RIGHT HERE, the next run will:
          //   1. Read currentFolder + pageToken from MongoDB
          //   2. Resume pagination within this exact folder
          //   3. Continue with the remaining folderQueue
          await this.syncStateModel.updateOne(
            { key: SYNC_KEY },
            {
              $set: {
                currentSyncProcessed: totalFilesProcessed,
                lastSyncNewFiles: newFilesAdded,
                currentFolder: currentFolder,
                currentFolderPageToken: pageToken || null,
                folderQueue: folderQueue,
              },
            },
          );

          this.logger.log(
            `📦 Synced batch: ${page.files.length} files from ` +
              `"${currentFolder.path || '/'}" ` +
              `(${newFilesAdded} new, ${totalFilesProcessed} total scanned)`,
          );

          // Respect Google API rate limits
          if (pageToken) {
            await new Promise((r) => setTimeout(r, API_COOLDOWN_MS));
          }
        } while (pageToken);

        // Done with this folder — move to next in queue
        pageToken = undefined;
        currentFolder =
          folderQueue.length > 0 ? folderQueue.shift()! : null;

        // Save the queue advancement
        await this.syncStateModel.updateOne(
          { key: SYNC_KEY },
          {
            $set: {
              currentFolder: currentFolder,
              currentFolderPageToken: null,
              folderQueue: folderQueue,
            },
          },
        );
      }

      // ── Successfully finished entire scan ──────────────────────
      await this.markSyncComplete(totalFilesProcessed, newFilesAdded);
      this.logger.log(
        `✅ Drive sync completed: ${totalFilesProcessed} files scanned, ` +
          `${newFilesAdded} new files added`,
      );
    } catch (err: any) {
      this.logger.error(`❌ Drive sync failed: ${err.message}`);

      // Mark as NOT running, but KEEP the bookmark intact for resume!
      // The folderQueue + currentFolder + pageToken are already saved
      // from the last successful batch — next click resumes from there.
      await this.syncStateModel.updateOne(
        { key: SYNC_KEY },
        {
          $set: {
            isSyncRunning: false,
            lastSyncError: err.message?.slice(0, 500),
          },
        },
      );
    }
  }

  /** Mark sync as fully complete — clears all bookmarks */
  private async markSyncComplete(
    fileCount: number,
    newFiles: number,
    error?: string,
  ): Promise<void> {
    await this.syncStateModel.updateOne(
      { key: SYNC_KEY },
      {
        $set: {
          isSyncRunning: false,
          lastSyncCompletedAt: new Date(),
          lastSyncFileCount: fileCount,
          lastSyncNewFiles: newFiles,
          currentSyncProcessed: fileCount,
          lastSyncError: error || null,
          // Clear all bookmarks — scan is done
          folderQueue: [],
          currentFolder: null,
          currentFolderPageToken: null,
        },
      },
    );
  }
}
