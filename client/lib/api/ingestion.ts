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
  deletedAt?: string;
}

export interface DrivePreviewSummary {
  totalDriveFiles: number;
  newFiles: number;
  completed: number;
  processing: number;
  queued: number;
  failed: number;
  deleted: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DrivePreviewResponse {
  summary: DrivePreviewSummary;
  files: DriveFileItem[];
  pagination: Pagination;
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

export interface SyncStateResponse {
  key: string;
  isSyncRunning: boolean;
  lastSyncStartedAt?: string;
  lastSyncCompletedAt?: string;
  lastSyncFileCount: number;
  lastSyncNewFiles: number;
  currentSyncProcessed: number;
  lastSyncError?: string;
}

export interface TriggerSyncResponse {
  started: boolean;
  message: string;
}

/**
 * Shared fetch wrapper that throws user-friendly errors when the backend
 * is unreachable (network error) or returns a non-OK status.
 */
async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch (err: any) {
    // Network error — backend is completely down
    throw new Error(
      "Cannot connect to backend server. Please check if the server is running."
    );
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Request failed (${res.status} ${res.statusText})`
    );
  }

  return res.json();
}

// 1. Fetch Drive preview (paginated, server-side filtered)
export async function fetchDrivePreview(
  page = 1,
  limit = 50,
  status = "all",
  search = "",
): Promise<DrivePreviewResponse> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (status && status !== "all") params.set("status", status);
  if (search) params.set("search", search);

  return apiFetch(`/api/ingestion/drive-preview?${params.toString()}`);
}

// 2. Fetch dashboard statistics
export async function fetchIngestionDashboard(): Promise<IngestionDashboardResponse> {
  return apiFetch("/api/ingestion/dashboard");
}

// 3. Trigger Drive Sync (All new files or specific fileIds)
export async function syncDrivePdfs(fileIds?: string[]): Promise<SyncResponse> {
  return apiFetch("/api/ingestion/sync", {
    method: "POST",
    body: JSON.stringify(fileIds && fileIds.length > 0 ? { fileIds } : {}),
  });
}

// 4. Retry failed documents
export async function retryFailedPdfs(): Promise<{ retriedCount: number }> {
  return apiFetch("/api/ingestion/retry-failed", { method: "POST" });
}

// 5. Sync deletions — detect files removed from Drive and soft-delete
export async function syncDriveDeletions(): Promise<{
  deletedCount: number;
  deletedFiles: Array<{ documentId: string; fileName: string; driveFileId: string }>;
}> {
  return apiFetch("/api/ingestion/sync-deletions", { method: "POST" });
}

export interface DeletedDocumentsResponse {
  files: DriveFileItem[];
  pagination: Pagination;
}

// 6. Fetch soft-deleted documents (paginated, on-demand)
export async function fetchDeletedDocuments(
  page = 1,
  limit = 50,
  search = "",
): Promise<DeletedDocumentsResponse> {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (search) query.set("search", search);

  return apiFetch(`/api/ingestion/deleted-documents?${query.toString()}`);
}

// 7. Check status of a single document
export async function fetchDocumentStatus(documentId: string): Promise<any> {
  return apiFetch(`/api/ingestion/status/${documentId}`);
}

// 8. Trigger Drive → MongoDB background sync (manual "Load File" button)
export async function triggerDriveSync(): Promise<TriggerSyncResponse> {
  return apiFetch("/api/ingestion/trigger-sync", { method: "POST" });
}

// 9. Get current sync state (for progress banner polling)
export async function fetchSyncState(): Promise<SyncStateResponse> {
  return apiFetch("/api/ingestion/sync-state");
}
