import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchDrivePreview,
  fetchIngestionDashboard,
  syncDrivePdfs,
  retryFailedPdfs,
  syncDriveDeletions,
  fetchDeletedDocuments,
  fetchDocumentStatus,
  triggerDriveSync,
  fetchSyncState,
} from "@/lib/api/ingestion";

// 1. Drive Preview Query Options (paginated, server-side filtered)
export function drivePreviewQueryOptions(
  page = 1,
  limit = 50,
  status = "all",
  search = "",
) {
  return queryOptions({
    queryKey: ["ingestion", "drive-preview", page, limit, status, search],
    queryFn: () => fetchDrivePreview(page, limit, status, search),
    staleTime: 60 * 1000, // 1 min fresh cache
    gcTime: 10 * 60 * 1000, // 10 min cache retention in RAM
    // Only keep previous data if we are paginating or searching within the SAME tab
    placeholderData: (previousData, previousQuery) => {
      const prevStatus = previousQuery?.queryKey?.[4];
      if (prevStatus === status) {
        return previousData;
      }
      return undefined; // Show skeletons on tab change
    },
    retry: 2,
  });
}

// 2. Deleted Documents Query Options (lazy on-demand caching)
export function deletedDocumentsQueryOptions(page = 1, limit = 50, search = "") {
  return queryOptions({
    queryKey: ["ingestion", "deleted-documents", page, limit, search],
    queryFn: () => fetchDeletedDocuments(page, limit, search),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    retry: 2,
  });
}

// 3. Ingestion Dashboard Query Options
export const ingestionDashboardQueryOptions = queryOptions({
  queryKey: ["ingestion", "dashboard"],
  queryFn: fetchIngestionDashboard,
  staleTime: 30 * 1000,
  gcTime: 5 * 60 * 1000,
  retry: 2,
});

// 4. Sync State Query Options (polls every 3s while sync is running)
export function syncStateQueryOptions(enabled = true) {
  return queryOptions({
    queryKey: ["ingestion", "sync-state"],
    queryFn: fetchSyncState,
    refetchInterval: (query) => {
      // Poll every 3 seconds while sync is running, stop when idle
      const data = query.state.data;
      return data?.isSyncRunning ? 3000 : false;
    },
    staleTime: 2000,
    gcTime: 60 * 1000,
    enabled,
    retry: 1,
  });
}

// 5. Mutation: Sync Drive PDFs (all or specific IDs) — queue for ingestion
export function useSyncDriveMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (fileIds?: string[]) => syncDrivePdfs(fileIds),
    onMutate: async (fileIds) => {
      // Cancel in-flight refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["ingestion", "drive-preview"] });

      // Snapshot the previous value for rollback
      const previousQueries = queryClient.getQueriesData({ queryKey: ["ingestion", "drive-preview"] });

      // Optimistically update: set matched files' status to 'queued'
      if (fileIds && fileIds.length > 0) {
        const idsSet = new Set(fileIds);
        queryClient.setQueriesData(
          { queryKey: ["ingestion", "drive-preview"] },
          (old: any) => {
            if (!old?.files) return old;
            return {
              ...old,
              files: old.files.map((f: any) =>
                idsSet.has(f.id) ? { ...f, status: "queued" } : f,
              ),
            };
          },
        );
      }

      return { previousQueries };
    },
    onError: (_err, _fileIds, context) => {
      // Rollback on error
      if (context?.previousQueries) {
        for (const [key, data] of context.previousQueries) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      // Refetch after settled to get accurate server state
      queryClient.invalidateQueries({ queryKey: ["ingestion", "drive-preview"] });
      queryClient.invalidateQueries({ queryKey: ["ingestion", "dashboard"] });
    },
  });
}

// 6. Mutation: Retry Failed Documents
export function useRetryFailedMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: retryFailedPdfs,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingestion", "drive-preview"] });
      queryClient.invalidateQueries({ queryKey: ["ingestion", "dashboard"] });
    },
  });
}

// 7. Mutation: Sync Deletions (detect removed Drive files)
export function useSyncDeletionsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: syncDriveDeletions,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingestion", "drive-preview"] });
      queryClient.invalidateQueries({ queryKey: ["ingestion", "dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["ingestion", "deleted-documents"] });
    },
  });
}

// 8. Mutation: Check Status
export function useCheckStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) => fetchDocumentStatus(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingestion", "drive-preview"] });
      queryClient.invalidateQueries({ queryKey: ["ingestion", "dashboard"] });
    },
  });
}

// 9. Mutation: Trigger Drive → MongoDB sync ("Load File" button)
export function useTriggerSyncMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: triggerDriveSync,
    onSuccess: () => {
      // Start polling sync state
      queryClient.invalidateQueries({ queryKey: ["ingestion", "sync-state"] });
    },
  });
}
