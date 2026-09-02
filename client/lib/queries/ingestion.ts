import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchDrivePreview,
  fetchIngestionDashboard,
  syncDrivePdfs,
  retryFailedPdfs,
  syncDriveDeletions,
} from "@/lib/api/ingestion";

// 1. Drive Preview Query Options
export const drivePreviewQueryOptions = queryOptions({
  queryKey: ["ingestion", "drive-preview"],
  queryFn: fetchDrivePreview,
  staleTime: 10 * 1000, // 10 seconds
});

// 2. Ingestion Dashboard Query Options
export const ingestionDashboardQueryOptions = queryOptions({
  queryKey: ["ingestion", "dashboard"],
  queryFn: fetchIngestionDashboard,
  staleTime: 5 * 1000,
});

// 3. Mutation: Sync Drive PDFs (all or specific IDs)
export function useSyncDriveMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (fileIds?: string[]) => syncDrivePdfs(fileIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingestion", "drive-preview"] });
      queryClient.invalidateQueries({ queryKey: ["ingestion", "dashboard"] });
    },
  });
}

// 4. Mutation: Retry Failed Documents
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

// 5. Mutation: Sync Deletions (detect removed Drive files)
export function useSyncDeletionsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: syncDriveDeletions,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingestion", "drive-preview"] });
      queryClient.invalidateQueries({ queryKey: ["ingestion", "dashboard"] });
    },
  });
}
