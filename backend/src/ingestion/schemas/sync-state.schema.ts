import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document as MongooseDoc } from 'mongoose';

export type SyncStateDocument = SyncState & MongooseDoc;

/** Shape of a folder in the BFS traversal queue */
export interface FolderQueueItem {
  id: string;
  path: string;
}

/**
 * Singleton document that tracks the state of the background Drive → MongoDB sync.
 * There is only ever ONE document in this collection (key = 'drive-sync').
 *
 * Bookmark fields (folderQueue, currentFolder, currentFolderPageToken) make the
 * sync fully resumable — if the server crashes or the Google API times out,
 * clicking "Load File" again picks up from the exact file it stopped at.
 */
@Schema({ timestamps: true, collection: 'sync_state' })
export class SyncState {
  /** Fixed key — always 'drive-sync' to ensure singleton behavior */
  @Prop({ required: true, unique: true, default: 'drive-sync' })
  key: string;

  /** Whether a sync is currently running */
  @Prop({ default: false })
  isSyncRunning: boolean;

  /** When the current/last sync started */
  @Prop()
  lastSyncStartedAt?: Date;

  /** When the last sync completed successfully */
  @Prop()
  lastSyncCompletedAt?: Date;

  /** Total files discovered during the last sync */
  @Prop({ default: 0 })
  lastSyncFileCount: number;

  /** Number of NEW files added during the last sync */
  @Prop({ default: 0 })
  lastSyncNewFiles: number;

  /** Running count of files processed so far in the CURRENT sync (for progress) */
  @Prop({ default: 0 })
  currentSyncProcessed: number;

  /** Error message if the last sync failed */
  @Prop()
  lastSyncError?: string;

  // ═══════════════════════════════════════════════════════════════
  // BOOKMARK FIELDS — make sync resumable across crashes/timeouts
  // ═══════════════════════════════════════════════════════════════

  /**
   * Remaining folders to traverse in the BFS queue.
   * Saved after every batch so the sync can resume from exactly where it stopped.
   */
  @Prop({ type: [{ id: String, path: String }], default: [] })
  folderQueue: FolderQueueItem[];

  /**
   * The folder currently being scanned when the last batch was saved.
   * On resume, we continue scanning this folder before popping the next from the queue.
   */
  @Prop({ type: { id: String, path: String }, default: null })
  currentFolder: FolderQueueItem | null;

  /**
   * Google Drive's page token within the current folder.
   * Allows resuming pagination mid-folder (e.g., folder has 5,000 PDFs,
   * we crashed at page 3 — this token jumps straight to page 4).
   */
  @Prop({ type: String, default: null })
  currentFolderPageToken: string | null;
}

export const SyncStateSchema = SchemaFactory.createForClass(SyncState);
