"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  drivePreviewQueryOptions,
  deletedDocumentsQueryOptions,
  ingestionDashboardQueryOptions,
  syncStateQueryOptions,
  useSyncDriveMutation,
  useRetryFailedMutation,
  useSyncDeletionsMutation,
  useCheckStatusMutation,
  useTriggerSyncMutation,
} from "@/lib/queries/ingestion";
import { useIngestionStore } from "@/lib/store/ingestion-store";
import {
  FiPlay,
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiFolder,
  FiFileText,
  FiSearch,
  FiHardDrive,
  FiLayers,
  FiInfo,
  FiChevronLeft,
  FiChevronRight,
  FiTrash2,
  FiDownloadCloud,
  FiLoader,
  FiWifiOff,
  FiRefreshCw,
} from "react-icons/fi";
import { GoLaw } from "react-icons/go";

// ─── Utility Functions ──────────────────────────────────────────
function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return "—";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ─── Skeleton Row ────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="py-4 px-3"><div className="flex items-center gap-2.5"><div className="w-8 h-8 bg-[#5A5550]/10 dark:bg-[#8A8279]/10 rounded-lg shrink-0" /><div className="space-y-2"><div className="w-48 h-3 bg-[#5A5550]/10 dark:bg-[#8A8279]/10 rounded" /><div className="w-24 h-2 bg-[#5A5550]/10 dark:bg-[#8A8279]/10 rounded" /></div></div></td>
      <td className="py-4 px-3"><div className="w-20 h-5 bg-[#5A5550]/10 dark:bg-[#8A8279]/10 rounded-md" /></td>
      <td className="py-4 px-3"><div className="w-24 h-4 bg-[#5A5550]/10 dark:bg-[#8A8279]/10 rounded" /></td>
      <td className="py-4 px-3"><div className="w-12 h-3 bg-[#5A5550]/10 dark:bg-[#8A8279]/10 rounded" /></td>
      <td className="py-4 px-3"><div className="w-16 h-5 bg-[#5A5550]/10 dark:bg-[#8A8279]/10 rounded-full" /></td>
      <td className="py-4 px-3"><div className="w-8 h-3 bg-[#5A5550]/10 dark:bg-[#8A8279]/10 rounded" /></td>
      <td className="py-4 px-4 text-right"><div className="w-16 h-6 bg-[#5A5550]/10 dark:bg-[#8A8279]/10 rounded-lg ml-auto" /></td>
    </tr>
  );
}

export default function IngestionDashboard() {
  // ─── Global State (Zustand) ───────────────────────────────────
  const {
    selectedIds, ingestingIds, statusFilter, searchQuery,
    debouncedSearch, currentPage, deletedPage, pageSize,
    toggleSelect, selectAll, deselectAll, clearSelection,
    setStatusFilter, setSearchQuery, setDebouncedSearch,
    setCurrentPage, setDeletedPage, markIngesting, unmarkIngesting,
  } = useIngestionStore();

  const isDeletedTab = statusFilter === "deleted";
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [pageInput, setPageInput] = useState<string>("");

  // Debounce search input (400ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery, setDebouncedSearch]);

  // ─── Queries ──────────────────────────────────────────────────
  const queryClient = useQueryClient();

  const {
    data: previewData,
    isPending: isPreviewLoading,
    isFetching: isPreviewFetching,
    isError: isPreviewError,
    error: previewError,
    refetch: refetchPreview,
  } = useQuery(
    drivePreviewQueryOptions(currentPage, pageSize, isDeletedTab ? "all" : statusFilter, debouncedSearch),
  );

  const {
    data: deletedData,
    isPending: isDeletedLoading,
    isFetching: isDeletedFetching,
  } = useQuery({
    ...deletedDocumentsQueryOptions(deletedPage, pageSize, debouncedSearch),
    enabled: isDeletedTab,
  });

  const isBackgroundRefreshing = isPreviewFetching || isDeletedFetching;

  const { refetch: refetchDashboard } = useQuery(ingestionDashboardQueryOptions);

  const { data: syncState, refetch: refetchSyncState } = useQuery(syncStateQueryOptions());

  const isSyncRunning = syncState?.isSyncRunning ?? false;

  // Auto-refresh file list when sync completes
  const [wasSyncing, setWasSyncing] = React.useState(false);
  useEffect(() => {
    if (isSyncRunning) {
      setWasSyncing(true);
    } else if (wasSyncing) {
      refetchPreview();
      refetchDashboard();
      setWasSyncing(false);
    }
  }, [isSyncRunning, wasSyncing, refetchPreview, refetchDashboard]);

  // ─── Mutations ────────────────────────────────────────────────
  const syncMutation = useSyncDriveMutation();
  const retryMutation = useRetryFailedMutation();
  const syncDeletionsMutation = useSyncDeletionsMutation();
  const checkStatusMutation = useCheckStatusMutation();
  const triggerSyncMutation = useTriggerSyncMutation();

  const isSyncing = syncMutation.isPending;

  const files = previewData?.files || [];
  const summary = previewData?.summary || {
    totalDriveFiles: 0, newFiles: 0, completed: 0,
    processing: 0, queued: 0, failed: 0, deleted: 0,
  };

  // Auto-refetch every 10s when files are processing/queued
  const hasActiveJobs = (summary.processing + summary.queued) > 0;
  useEffect(() => {
    if (!hasActiveJobs) return;
    const interval = setInterval(() => refetchPreview(), 10_000);
    return () => clearInterval(interval);
  }, [hasActiveJobs, refetchPreview]);

  // ─── Display Logic ────────────────────────────────────────────
  const displayFiles = isDeletedTab ? (deletedData?.files || []) : files;
  const isTableLoading = isDeletedTab ? isDeletedLoading : isPreviewLoading;
  const currentPagination = isDeletedTab ? deletedData?.pagination : previewData?.pagination;

  useEffect(() => {
    if (currentPagination) {
      setPageInput(currentPagination.page.toString());
    }
  }, [currentPagination?.page]);

  const syncableFilteredFiles = displayFiles.filter((f) => f.status !== "deleted");
  const syncableSelectedCount = Array.from(selectedIds).filter((id) => {
    const file = files.find((f) => f.id === id);
    return file && file.status !== "deleted";
  }).length;

  // ─── Handlers ─────────────────────────────────────────────────
 

  const handleLoadFile = async () => {
    try {
      const res = await triggerSyncMutation.mutateAsync();
      if (!res.started) {
        toast.warning(res.message);
        return;
      }
      toast.info("Loading files from Google Drive...", { duration: 5000 });
      refetchSyncState();
    } catch (err: any) {
      toast.error(err?.message || "Failed to start sync. Is the backend running?");
    }
  };

  const handleSyncSelected = () => {
    if (selectedIds.size === 0) return;
    const nonDeletedIds = Array.from(selectedIds).filter((id) => {
      const f = files.find((file) => file.id === id);
      return f && f.status !== "deleted";
    });

    if (nonDeletedIds.length === 0) {
      toast.error("Selected file(s) are deleted and cannot be re-ingested.");
      return;
    }

    markIngesting(nonDeletedIds);
    const toastId = toast.loading(`Queuing ${nonDeletedIds.length} file(s) for ingestion...`);

    syncMutation.mutate(nonDeletedIds, {
      onSuccess: (res) => {
        toast.success(`${res.queued} file(s) queued for ingestion ✓`, { id: toastId });
        unmarkIngesting(nonDeletedIds);
      },
      onError: (err: any) => {
        toast.error(err?.message || "Failed to queue files.", { id: toastId });
        unmarkIngesting(nonDeletedIds);
      },
    });
    clearSelection();
  };

  const handleSyncWithDrive = async () => {
    const toastId = toast.loading("Syncing deletions with Google Drive...");
    try {
      const res = await syncDeletionsMutation.mutateAsync();
      const count = res?.deletedCount ?? 0;
      toast.success(
        count > 0
          ? `Detected & marked ${count} deleted file(s).`
          : "All files up to date!",
        { id: toastId },
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to sync with Drive.", { id: toastId });
    }
  };

  const handleSyncSingle = (fileId: string, fileName: string) => {
    markIngesting([fileId]);
    const toastId = toast.loading(`Queuing "${fileName}"...`);

    syncMutation.mutate([fileId], {
      onSuccess: () => {
        toast.success(`"${fileName}" queued for ingestion ✓`, { id: toastId });
        unmarkIngesting([fileId]);
      },
      onError: (err: any) => {
        toast.error(err?.message || `Failed to queue "${fileName}".`, { id: toastId });
        unmarkIngesting([fileId]);
      },
    });
  };

  const handleRetryFailed = () => {
    const toastId = toast.loading("Retrying failed documents...");
    retryMutation.mutate(undefined, {
      onSuccess: (res) => {
        toast.success(`${res.retriedCount} document(s) requeued ✓`, { id: toastId });
      },
      onError: (err: any) => {
        toast.error(err?.message || "Failed to retry.", { id: toastId });
      },
    });
  };

  const handleCheckStatus = async (documentId: string, fileName: string) => {
    const toastId = toast.loading(`Checking "${fileName}"...`);
    try {
      const res = await checkStatusMutation.mutateAsync(documentId);
      if (res.found) {
        toast.success(`Status: ${res.status} · Chunks: ${res.chunkCount}`, { id: toastId });
      } else {
        toast.error("Document not found.", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to check status.", { id: toastId });
    }
  };

  const prefetchNextPage = () => {
    if (!currentPagination || currentPagination.page >= currentPagination.totalPages) return;
    const nextPage = currentPagination.page + 1;
    if (isDeletedTab) {
      queryClient.prefetchQuery(deletedDocumentsQueryOptions(nextPage, pageSize, debouncedSearch));
    } else {
      queryClient.prefetchQuery(drivePreviewQueryOptions(nextPage, pageSize, statusFilter, debouncedSearch));
    }
  };

  const prefetchPrevPage = () => {
    if (!currentPagination || currentPagination.page <= 1) return;
    const prevPage = currentPagination.page - 1;
    if (isDeletedTab) {
      queryClient.prefetchQuery(deletedDocumentsQueryOptions(prevPage, pageSize, debouncedSearch));
    } else {
      queryClient.prefetchQuery(drivePreviewQueryOptions(prevPage, pageSize, statusFilter, debouncedSearch));
    }
  };

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0C0A09] text-[#1A1614] dark:text-[#E8E0D4] pt-20 sm:pt-24 pb-20 px-4 sm:px-6 lg:px-8 transition-colors duration-500">
      <div className="max-w-7xl mx-auto flex flex-col gap-4">

        {/* ── Backend Error Banner ────────────────────────── */}
        {isPreviewError && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-4 animate-in slide-in-from-top-2">
            <div className="p-3 rounded-xl bg-rose-500/15">
              <FiWifiOff className="w-6 h-6 text-rose-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-rose-600 dark:text-rose-400">Backend Unavailable</h3>
              <p className="text-xs text-rose-500/80 mt-0.5">
                {(previewError as Error)?.message || "Cannot connect to the server."}
              </p>
            </div>
            <button
              onClick={() => refetchPreview()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <FiRefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* ── Sync Progress Banner ───────────────────────── */}
        {isSyncRunning && (
          <div className="p-4 rounded-2xl bg-[#C7A064]/10 border border-[#C7A064]/30 flex items-center gap-4 animate-in slide-in-from-top-2">
            <div className="relative w-10 h-10 shrink-0">
              <div className="absolute inset-0 rounded-full border-[3px] border-[#C7A064]/20" />
              <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[#C7A064] animate-spin" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-[#C7A064]">Loading Files from Google Drive...</h3>
              <p className="text-xs text-[#5A5550] dark:text-[#8A8279] mt-0.5">
                {syncState?.currentSyncProcessed
                  ? `${syncState.currentSyncProcessed.toLocaleString()} files scanned · ${syncState.lastSyncNewFiles ?? 0} new files found`
                  : "Starting scan..."}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C7A064]/15 text-xs font-semibold text-[#C7A064]">
              <FiLoader className="w-3 h-3 animate-spin" />
              Syncing
            </span>
          </div>
        )}

        {/* ── Last Sync Info ─────────────────────────────── */}
        {!isSyncRunning && syncState?.lastSyncCompletedAt && (
          <div className="p-3 rounded-xl bg-[#5A5550]/5 dark:bg-white/5 border border-[#1A1614]/5 dark:border-white/5 flex items-center gap-3">
            <FiCheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
            <p className="text-xs text-[#5A5550] dark:text-[#8A8279] flex-1">
              <span className="font-semibold text-[#1A1614] dark:text-[#E8E0D4]">Last sync: </span>
              {timeAgo(syncState.lastSyncCompletedAt)} — {syncState.lastSyncFileCount.toLocaleString()} files scanned, {syncState.lastSyncNewFiles} new
              {syncState.lastSyncError && (
                <span className="text-rose-500 ml-2">⚠ {syncState.lastSyncError}</span>
              )}
            </p>
          </div>
        )}

        {/* ── Header Section ──────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-3 border-b border-[#1A1614]/10 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#C7A064]/10 text-[#C7A064] border border-[#C7A064]/20 hidden sm:block">
              <GoLaw className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-heading font-semibold tracking-tight text-[#1A1614] dark:text-[#E8E0D4]">
                Google Drive Ingestion & Knowledge Hub
              </h1>
              <p className="text-xs sm:text-sm text-[#5A5550] dark:text-[#8A8279] mt-1">
                Automated recursive syncing, BGE-M3 hybrid vectorization, and Qdrant ingestion
              </p>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/ask"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-[#1A1614] text-[#1A1614] dark:text-[#E8E0D4] border border-[#1A1614]/10 dark:border-white/10 shadow-sm transition-all hover:bg-black/5 dark:hover:bg-white/5 hover:scale-[1.03] active:scale-[0.97]"
            >
              <FiChevronLeft className="w-3.5 h-3.5" />
              Back to GPT
            </Link>

            <button
              onClick={handleLoadFile}
              disabled={isSyncRunning || triggerSyncMutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl bg-linear-to-r from-[#C7A064] to-gold-dark text-white shadow-lg shadow-[#C7A064]/25 transition-all hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[#C7A064]/40"
            >
              {isSyncRunning ? <FiLoader className="w-4 h-4 animate-spin" /> : <FiDownloadCloud className="w-4 h-4" />}
              <span>{isSyncRunning ? "Loading..." : "Load File"}</span>
            </button>

            {summary.failed > 0 && (
              <button
                onClick={handleRetryFailed}
                disabled={retryMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                <FiAlertTriangle className="w-3.5 h-3.5" />
                Retry Failed ({summary.failed})
              </button>
            )}

            {syncableSelectedCount > 0 && (
              <button
                onClick={handleSyncSelected}
                disabled={isSyncing}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg bg-[#C7A064] text-white hover:bg-gold-dark shadow-md shadow-[#C7A064]/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                <FiPlay className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                Sync Selected ({syncableSelectedCount})
              </button>
            )}

            <button
              onClick={handleSyncWithDrive}
              disabled={syncDeletionsMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              {syncDeletionsMutation.isPending ? (
                <div className="w-3.5 h-3.5 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
              ) : (
                <FiHardDrive className="w-3.5 h-3.5" />
              )}
              <span>{syncDeletionsMutation.isPending ? "Syncing..." : "Sync with Drive"}</span>
            </button>
          </div>
        </div>

        {/* 6 KPI Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: "Total Drive Files", value: summary.totalDriveFiles, sub: "Discovered in Drive", color: "text-[#5A5550] dark:text-[#8A8279]", bg: "bg-[#5A5550]/10", border: "border-[#1A1614]/10 dark:border-white/10", icon: FiHardDrive },
            { label: "New / Pending", value: summary.newFiles, sub: "Ready for embedding", color: "text-[#C7A064]", bg: "bg-[#C7A064]/15", border: "border-[#C7A064]/30", icon: FiFileText },
            { label: "Completed", value: summary.completed, sub: "Indexed in Qdrant", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: FiCheckCircle },
            { label: "Processing", value: summary.processing + summary.queued, sub: "In BullMQ queue", color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20", icon: FiClock },
            { label: "Failed", value: summary.failed, sub: "Needs attention", color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20", icon: FiAlertTriangle },
            { label: "Marked Deleted", value: summary.deleted || 0, sub: "Purged from Qdrant", color: "text-zinc-500 dark:text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20", icon: FiTrash2 },
          ].map((card) => (
            <div key={card.label} className={`p-5 rounded-2xl bg-white dark:bg-[#141210] border ${card.border} shadow-sm`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium uppercase tracking-wider ${card.color}`}>{card.label}</span>
                <div className={`p-2 rounded-lg ${card.bg} ${card.color}`}><card.icon className="w-4 h-4" /></div>
              </div>
              <div className={`text-2xl font-bold font-heading mt-3 ${card.color}`}>{card.value}</div>
              <p className="text-xs text-[#5A5550] dark:text-[#8A8279] mt-1">{card.sub}</p>
            </div>
          ))}
        </div>

        {/* Search & Filter Bar */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#141210] border border-[#1A1614]/10 dark:border-white/10 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="relative flex-1 max-w-md flex items-center gap-3">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5550] dark:text-[#8A8279]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by file name..."
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-[#FAFAFA] dark:bg-[#0C0A09] border border-[#1A1614]/10 dark:border-white/10 text-[#1A1614] dark:text-[#E8E0D4] placeholder:text-[#5A5550]/60 focus:outline-none focus:border-[#C7A064] transition-all"
              />
            </div>
            {isBackgroundRefreshing && (
              <div className="flex items-center gap-1.5 text-xs text-[#5A5550] dark:text-[#8A8279] animate-pulse whitespace-nowrap">
                <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden sm:inline">Syncing...</span>
              </div>
            )}
          </div>

          <div 
            className="hide-scrollbar flex flex-nowrap md:flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#FAFAFA] dark:bg-[#0C0A09] border border-[#1A1614]/10 dark:border-white/10 overflow-x-auto w-full md:w-auto"
          >
            {[
              { id: "all", label: "All Files", count: summary.totalDriveFiles },
              { id: "new", label: "New", count: summary.newFiles },
              { id: "completed", label: "Completed", count: summary.completed },
              { id: "processing", label: "Processing", count: summary.processing + summary.queued },
              { id: "failed", label: "Failed", count: summary.failed },
              { id: "deleted", label: "Deleted", count: summary.deleted || 0 },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`shrink-0 whitespace-nowrap px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${statusFilter === tab.id
                    ? "bg-[#C7A064] text-white shadow-sm"
                    : "text-[#5A5550] dark:text-[#8A8279] hover:text-[#1A1614] dark:hover:text-[#E8E0D4]"
                  }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>

        {/* Files Table */}
        <div className="rounded-2xl bg-white dark:bg-[#141210] border border-[#1A1614]/10 dark:border-white/10 shadow-sm overflow-hidden">
          {isTableLoading && !displayFiles.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAFAFA] dark:bg-[#0C0A09] border-b border-[#1A1614]/10 dark:border-white/10 text-[#5A5550] dark:text-[#8A8279] uppercase font-semibold tracking-wider">
                  <tr>
                    <th className="py-4 px-3">Document Name</th>
                    <th className="py-4 px-3">Drive Folder Path</th>
                    <th className="py-4 px-3">Category & Jurisdiction</th>
                    <th className="py-4 px-3">Size</th>
                    <th className="py-4 px-3">Status</th>
                    <th className="py-4 px-3">Chunks</th>
                    <th className="py-4 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A1614]/5 dark:divide-white/5">
                  {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
                </tbody>
              </table>
            </div>
          ) : displayFiles.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-3 px-4">
              <div className="p-4 rounded-2xl bg-[#5A5550]/10 text-[#5A5550] dark:text-[#8A8279]">
                {isDeletedTab ? <FiTrash2 className="w-8 h-8" /> :
                 statusFilter === "failed" ? <FiAlertTriangle className="w-8 h-8" /> :
                 statusFilter === "completed" ? <FiCheckCircle className="w-8 h-8" /> :
                 <FiFolder className="w-8 h-8" />}
              </div>
              <h3 className="text-base font-semibold text-[#1A1614] dark:text-[#E8E0D4]">
                {searchQuery ? "No results" :
                 isDeletedTab ? "No deleted files" :
                 statusFilter === "failed" ? "No failed documents" :
                 statusFilter === "completed" ? "No completed documents" :
                 statusFilter === "processing" ? "No documents processing" :
                 statusFilter === "new" ? "No new documents" :
                 "No files found"}
              </h3>
              <p className="text-xs text-[#5A5550] dark:text-[#8A8279] max-w-sm">
                {searchQuery ? "No documents match your search. Try a different keyword." :
                 isDeletedTab ? "No files have been removed from Drive yet." :
                 statusFilter === "failed" ? "All documents are processing correctly." :
                 statusFilter === "completed" ? "No documents have been ingested yet. Select files and click 'Ingest'." :
                 statusFilter === "processing" ? "No documents are currently in the BullMQ queue." :
                 statusFilter === "new" ? "All synced files have been processed or queued." :
                 summary.totalDriveFiles === 0 ? "Click 'Load File' to scan your Google Drive." :
                 "No files match the current filter."}
              </p>
              {/* Only show Load File on "All Files" tab when there are truly zero files */}
              {!searchQuery && statusFilter === "all" && summary.totalDriveFiles === 0 && (
                <button
                  onClick={handleLoadFile}
                  disabled={isSyncRunning}
                  className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl bg-linear-to-r from-[#C7A064] to-gold-dark text-white shadow-lg shadow-[#C7A064]/25 transition-all hover:scale-[1.03] active:scale-[0.97]"
                >
                  <FiDownloadCloud className="w-4 h-4" />
                  Load File
                </button>
              )}
            </div>

          ) : isDeletedTab ? (
            /* ── Deleted Tab — Card Layout ─────────────────── */
            <div className="p-4 sm:p-6 space-y-3">
              <div className="flex items-center gap-2 pb-3 border-b border-zinc-200 dark:border-zinc-800">
                <FiTrash2 className="w-4 h-4 text-zinc-400" />
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  {displayFiles.length} Deleted File{displayFiles.length !== 1 ? "s" : ""} — Vectors purged from Qdrant
                </p>
              </div>
              {displayFiles.map((file) => (
                <div
                  key={file.id}
                  className="group flex items-center gap-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
                >
                  {/* Icon */}
                  <div className="p-2.5 rounded-lg bg-zinc-200/50 dark:bg-zinc-800 text-zinc-400 shrink-0">
                    <FiTrash2 className="w-5 h-5" />
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 line-through truncate">
                      {file.fileName}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 truncate max-w-[200px]">
                        {file.id}
                      </span>
                      {file.folderPath && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                          <FiFolder className="w-2.5 h-2.5" />
                          {file.folderPath}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Category */}
                  <div className="hidden sm:block">
                    {file.docType && (
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-200/60 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                        {file.docType.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>

                  {/* Chunks */}
                  <div className="text-right shrink-0">
                    <span className="text-xs font-mono text-zinc-400 line-through">{file.chunkCount || 0} chunks</span>
                  </div>

                  {/* Purged badge */}
                  <div className="shrink-0">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/8 text-rose-500/70 dark:text-rose-400/60 border border-rose-500/15 text-[11px] font-semibold">
                      <FiTrash2 className="w-3 h-3" />
                      Purged
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAFAFA] dark:bg-[#0C0A09] border-b border-[#1A1614]/10 dark:border-white/10 text-[#5A5550] dark:text-[#8A8279] uppercase font-semibold tracking-wider">
                  <tr>
                    <th className="py-4 px-3 w-48 sm:w-auto">Document Name</th>
                    <th className="py-4 px-3 hidden lg:table-cell">Drive Folder Path</th>
                    <th className="py-4 px-3 hidden sm:table-cell">Category & Jurisdiction</th>
                    <th className="py-4 px-3 hidden sm:table-cell">Size</th>
                    <th className="py-4 px-3 hidden sm:table-cell">Status</th>
                    <th className="py-4 px-3 hidden sm:table-cell">Chunks</th>
                    <th className="py-4 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A1614]/5 dark:divide-white/5 font-sans">
                  {displayFiles.map((file) => {
                    const isSelected = selectedIds.has(file.id);
                    const isDeleted = file.status === "deleted";
                    const isIngesting = ingestingIds.has(file.id);
                    const isActive = file.status === "processing" || file.status === "queued" || isIngesting;

                    return (
                      <React.Fragment key={file.id}>
                        <tr 
                          onClick={() => setExpandedRowId(expandedRowId === file.id ? null : file.id)}
                          className={`transition-colors ${isDeleted ? "bg-zinc-500/5 hover:bg-zinc-500/10" : "hover:bg-[#FAFAFA]/80 dark:hover:bg-[#1A1614]/40"} cursor-pointer`}
                        >
                          {/* File Name */}
                          <td className="py-4 px-3">
                            <div className="flex items-center gap-2.5">
                              <div className={`p-2 rounded-lg shrink-0 ${isDeleted ? "bg-zinc-500/15 text-zinc-500" : "bg-[#C7A064]/10 text-[#C7A064]"}`}>
                                {isDeleted ? <FiTrash2 className="w-4 h-4" /> : <FiFileText className="w-4 h-4" />}
                              </div>
                              <div>
                                <div className={`font-medium line-clamp-1 max-w-[150px] sm:max-w-xs md:max-w-sm lg:max-w-[250px] xl:max-w-md ${isDeleted ? "text-[#5A5550] line-through" : "text-[#1A1614] dark:text-[#E8E0D4]"}`} title={file.fileName}>
                                  {file.fileName}
                                </div>
                                <span className="text-[10px] text-[#5A5550]/70 font-mono">ID: {file.id}</span>
                              </div>
                            </div>
                          </td>

                          {/* Folder Path */}
                          <td className="py-4 px-3 hidden lg:table-cell">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#5A5550]/5 dark:bg-[#8A8279]/10 text-[#5A5550] dark:text-[#8A8279] text-[11px] font-mono max-w-[150px] xl:max-w-[200px]" title={file.folderPath}>
                              <FiFolder className={`w-3 h-3 shrink-0 ${isDeleted ? "text-zinc-400" : "text-[#C7A064]"}`} />
                              <span className="truncate">{file.folderPath}</span>
                            </div>
                          </td>

                          {/* Category & Jurisdiction */}
                          <td className="py-4 px-3 hidden sm:table-cell">
                            <div className="space-y-1">
                              {file.docType ? (
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-[#C7A064]/10 text-[#C7A064] border border-[#C7A064]/20">
                                  {file.docType.replace(/_/g, " ")}
                                </span>
                              ) : (
                                <span className="text-[11px] text-[#5A5550]/60">Auto-inferred</span>
                              )}
                              {file.jurisdiction && (
                                <div className="text-[10px] text-[#5A5550] dark:text-[#8A8279] font-medium">
                                  🏛️ {file.jurisdiction.replace(/_/g, " ")}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Size */}
                          <td className="py-4 px-3 font-mono text-xs text-[#5A5550] dark:text-[#8A8279] hidden sm:table-cell">
                            {formatBytes(file.fileSizeBytes)}
                          </td>

                          {/* Status Badge */}
                          <td className="py-4 px-3 hidden sm:table-cell">
                            {file.status === "completed" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <FiCheckCircle className="w-3 h-3" /> Completed
                              </span>
                            )}
                            {file.status === "new" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#C7A064]/10 text-[#C7A064] border border-[#C7A064]/20">New</span>
                            )}
                            {file.status === "processing" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                                <FiClock className="w-3 h-3 animate-spin" /> Processing
                              </span>
                            )}
                            {file.status === "queued" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                <FiClock className="w-3 h-3" /> In Queue
                              </span>
                            )}
                            {file.status === "failed" && (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                  <FiAlertTriangle className="w-3 h-3" /> Failed
                                </span>
                                {file.error && <p className="text-[10px] text-rose-500 max-w-xs truncate" title={file.error}>{file.error}</p>}
                              </div>
                            )}
                            {file.status === "deleted" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20">
                                <FiTrash2 className="w-3 h-3" /> Deleted
                              </span>
                            )}
                          </td>

                          {/* Chunks */}
                          <td className="py-4 px-3 font-mono text-xs hidden sm:table-cell">
                            {isDeleted ? (
                              <span className="line-through text-[#5A5550] dark:text-[#8A8279]">{file.chunkCount || 0}</span>
                            ) : file.chunkCount > 0 ? (
                              <div className="inline-flex items-center gap-1 text-[#1A1614] dark:text-[#E8E0D4] font-semibold">
                                <FiLayers className="w-3 h-3 text-[#C7A064]" /> {file.chunkCount}
                              </div>
                            ) : (
                              <span className="text-[#5A5550]/40">—</span>
                            )}
                          </td>

                          {/* Action */}
                          <td className="py-4 px-4 text-right">
                            <div className="flex justify-end items-center gap-2">
                              {isDeleted ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500 font-medium px-2 py-1 rounded-md bg-zinc-500/10 border border-zinc-500/20 whitespace-nowrap">
                                  <FiTrash2 className="w-3 h-3" /> Purged
                                </span>
                              ) : file.status === "completed" ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrap">
                                  Indexed ✨
                                </span>
                              ) : isActive ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] sm:text-xs font-semibold rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 whitespace-nowrap">
                                  <div className="w-3 h-3 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
                                  {file.status === "processing" ? "Processing..." : "In Queue"}
                                </span>
                              ) : file.status === "failed" ? (
                                <div className="flex items-center gap-2">
                                  {file.documentId && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleCheckStatus(file.documentId!, file.fileName); }}
                                      disabled={checkStatusMutation.isPending}
                                      className="hidden sm:inline-flex px-3 py-1.5 text-[10px] sm:text-xs font-semibold rounded-lg bg-[#5A5550]/10 text-[#5A5550] dark:text-[#8A8279] hover:bg-[#5A5550]/20 border border-[#1A1614]/10 dark:border-white/10 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 whitespace-nowrap"
                                    >
                                      Check Status
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleSyncSingle(file.id, file.fileName); }}
                                    disabled={isSyncing}
                                    className="px-4 py-1.5 text-[11px] sm:text-xs font-semibold rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white border border-rose-500/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 whitespace-nowrap"
                                  >
                                    Retry
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleSyncSingle(file.id, file.fileName); }}
                                  disabled={isSyncing}
                                  className="px-4 py-1.5 text-[11px] sm:text-xs font-semibold rounded-lg bg-linear-to-r from-[#C7A064] to-gold-dark text-white hover:shadow-md hover:shadow-[#C7A064]/20 border border-transparent transition-all hover:scale-105 active:scale-95 disabled:opacity-50 whitespace-nowrap"
                                >
                                  Ingest
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded details row for all devices */}
                        {expandedRowId === file.id && (
                          <tr className="bg-[#FAFAFA]/50 dark:bg-[#1A1614]/50 border-b border-[#1A1614]/5 dark:border-white/5">
                            <td colSpan={7} className="px-4 py-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                                <div className="space-y-1 lg:col-span-1">
                                  <span className="text-[#5A5550]/60 font-semibold uppercase text-[10px]">Full Document Name</span>
                                  <div className="text-[#1A1614] dark:text-[#E8E0D4] font-medium break-all bg-white dark:bg-[#141210] p-1.5 rounded-md border border-[#1A1614]/10 dark:border-white/10">
                                    {file.fileName}
                                  </div>
                                </div>
                                <div className="space-y-1 lg:col-span-2">
                                  <span className="text-[#5A5550]/60 font-semibold uppercase text-[10px]">Full Folder Path</span>
                                  <div className="text-[#1A1614] dark:text-[#E8E0D4] font-mono break-all bg-white dark:bg-[#141210] p-1.5 rounded-md border border-[#1A1614]/10 dark:border-white/10">
                                    {file.folderPath}
                                  </div>
                                </div>
                                <div className="sm:hidden space-y-1">
                                  <span className="text-[#5A5550]/60 font-semibold uppercase text-[10px]">Category</span>
                                  <div className="text-[#1A1614] dark:text-[#E8E0D4]">{file.docType?.replace(/_/g, " ") || "Auto-inferred"}</div>
                                </div>
                                <div className="sm:hidden flex items-center justify-between">
                                  <div className="space-y-1">
                                    <span className="text-[#5A5550]/60 font-semibold uppercase text-[10px]">Size</span>
                                    <div className="text-[#1A1614] dark:text-[#E8E0D4] font-mono">{formatBytes(file.fileSizeBytes)}</div>
                                  </div>
                                  <div className="space-y-1">
                                    <span className="text-[#5A5550]/60 font-semibold uppercase text-[10px]">Chunks</span>
                                    <div className="text-[#1A1614] dark:text-[#E8E0D4] font-mono">{file.chunkCount || 0}</div>
                                  </div>
                                  <div className="space-y-1">
                                    <span className="text-[#5A5550]/60 font-semibold uppercase text-[10px]">Status</span>
                                    <div className="text-[#1A1614] dark:text-[#E8E0D4] capitalize">{file.status}</div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {currentPagination && currentPagination.totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-[#141210] border border-[#1A1614]/10 dark:border-white/10 shadow-sm">
            <p className="text-xs text-[#5A5550] dark:text-[#8A8279] text-center sm:text-left">
              Showing{" "}
              <span className="font-semibold text-[#1A1614] dark:text-[#E8E0D4]">
                {(currentPagination.page - 1) * currentPagination.limit + 1}
              </span>–
              <span className="font-semibold text-[#1A1614] dark:text-[#E8E0D4]">
                {Math.min(currentPagination.page * currentPagination.limit, currentPagination.total)}
              </span>{" "}of{" "}
              <span className="font-semibold text-[#1A1614] dark:text-[#E8E0D4]">{currentPagination.total}</span> documents
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => isDeletedTab ? setDeletedPage(Math.max(1, currentPagination.page - 1)) : setCurrentPage(Math.max(1, currentPagination.page - 1))}
                disabled={currentPagination.page <= 1}
                onMouseEnter={prefetchPrevPage}
                onFocus={prefetchPrevPage}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#EFECE6] dark:bg-[#1A1614] text-[#5A5550] dark:text-[#8A8279] border border-[#1A1614]/10 dark:border-white/10 hover:text-[#1A1614] dark:hover:text-[#E8E0D4] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <FiChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              
              <div className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-[#C7A064] bg-[#C7A064]/10 rounded-lg border border-[#C7A064]/20 shrink-0">
                <input
                  type="text"
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const p = parseInt(pageInput, 10);
                      if (!isNaN(p) && p >= 1 && p <= currentPagination.totalPages) {
                        isDeletedTab ? setDeletedPage(p) : setCurrentPage(p);
                      } else {
                        setPageInput(currentPagination.page.toString());
                      }
                    }
                  }}
                  onBlur={() => setPageInput(currentPagination.page.toString())}
                  className="w-8 sm:w-10 text-center bg-transparent border-b border-[#C7A064]/30 focus:border-[#C7A064] focus:outline-none hide-scrollbar text-[#C7A064] transition-colors"
                />
                <span className="text-[#C7A064]/70 shrink-0 whitespace-nowrap">/ {currentPagination.totalPages}</span>
              </div>

              <button
                onClick={() => isDeletedTab ? setDeletedPage(Math.min(currentPagination.totalPages, currentPagination.page + 1)) : setCurrentPage(Math.min(currentPagination.totalPages, currentPagination.page + 1))}
                disabled={currentPagination.page >= currentPagination.totalPages}
                onMouseEnter={prefetchNextPage}
                onFocus={prefetchNextPage}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#EFECE6] dark:bg-[#1A1614] text-[#5A5550] dark:text-[#8A8279] border border-[#1A1614]/10 dark:border-white/10 hover:text-[#1A1614] dark:hover:text-[#E8E0D4] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                Next <FiChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Help Box */}
        <div className="p-4 rounded-xl bg-[#5A5550]/5 dark:bg-white/5 border border-[#1A1614]/5 dark:border-white/5 flex items-start gap-3">
          <FiInfo className="w-4 h-4 text-[#C7A064] shrink-0 mt-0.5" />
          <div className="text-xs text-[#5A5550] dark:text-[#8A8279] leading-relaxed">
            <span className="font-semibold text-[#1A1614] dark:text-[#E8E0D4]">How it works: </span>
            Click <strong>&quot;Load File&quot;</strong> to scan your Google Drive for PDFs. Files are cataloged into the database without downloading. Then select files and click <strong>&quot;Ingest&quot;</strong> to chunk, embed with BGE-M3 vectors, and store them in Qdrant for millisecond hybrid retrieval.
          </div>
        </div>
      </div>
    </div>
  );
}
