export interface DriveFileItem {
  id: string;
  documentId?: string;
  fileName: string;
  folderPath: string;
  fileSizeBytes?: number;
  modifiedTime?: string;
  status: "new" | "queued" | "processing" | "completed" | "failed" | "deleted";
  chunkCount: number;
  processedChunks: number;
  attemptCount: number;
  docType?: string;
  jurisdiction?: string;
  error?: string;
}

export interface DrivePreviewSummary {
  totalDriveFiles: number;
  newFiles: number;
  completed: number;
  processing: number;
  queued: number;
  failed: number;
}

export interface DrivePreviewResponse {
  summary: DrivePreviewSummary;
  files: DriveFileItem[];
}

export interface IngestionDashboardResponse {
  stats: {
    total: number;
    completed: number;
    failed: number;
    processing: number;
    queued: number;
  };
  recentDocuments: any[];
}

export interface SyncResponse {
  queued: number;
  fileNames: string[];
}

// 1. Fetch Drive preview and status of all files
export async function fetchDrivePreview(): Promise<DrivePreviewResponse> {
  const res = await fetch("/api/ingestion/drive-preview", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch drive preview (${res.status})`
    );
  }

  return res.json();
}

// 2. Fetch dashboard statistics
export async function fetchIngestionDashboard(): Promise<IngestionDashboardResponse> {
  const res = await fetch("/api/ingestion/dashboard", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch dashboard (${res.status})`
    );
  }

  return res.json();
}

// 3. Trigger Drive Sync (All new files or specific fileIds)
export async function syncDrivePdfs(fileIds?: string[]): Promise<SyncResponse> {
  const res = await fetch("/api/ingestion/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fileIds && fileIds.length > 0 ? { fileIds } : {}),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to sync Drive (${res.status})`);
  }

  return res.json();
}

// 4. Retry failed documents
export async function retryFailedPdfs(): Promise<{ retriedCount: number }> {
  const res = await fetch("/api/ingestion/retry-failed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to retry failed files (${res.status})`
    );
  }

  return res.json();
}

// 5. Sync deletions — detect files removed from Drive and soft-delete
export async function syncDriveDeletions(): Promise<{
  deletedCount: number;
  deletedFiles: Array<{ documentId: string; fileName: string; driveFileId: string }>;
}> {
  const res = await fetch("/api/ingestion/sync-deletions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to sync deletions (${res.status})`
    );
  }

  return res.json();
}
