"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  drivePreviewQueryOptions,
  ingestionDashboardQueryOptions,
  useSyncDriveMutation,
  useRetryFailedMutation,
} from "@/lib/queries/ingestion";
import { type DriveFileItem } from "@/lib/api/ingestion";
import {
  FiRefreshCw,
  FiPlay,
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiFolder,
  FiFileText,
  FiSearch,
  FiHardDrive,
  FiLayers,
  FiExternalLink,
  FiInfo,
} from "react-icons/fi";
import { GoLaw } from "react-icons/go";

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return "—";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function IngestionDashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 1. Fetch Drive Preview & Database Dashboard with TanStack Query
  const {
    data: previewData,
    isLoading: isPreviewLoading,
    isRefetching: isPreviewRefetching,
    refetch: refetchPreview,
  } = useQuery(drivePreviewQueryOptions);

  const {
    data: dashboardData,
    refetch: refetchDashboard,
  } = useQuery(ingestionDashboardQueryOptions);

  // 2. Mutations
  const syncMutation = useSyncDriveMutation();
  const retryMutation = useRetryFailedMutation();

  const isSyncing = syncMutation.isPending;
  const isRetrying = retryMutation.isPending;

  const files = previewData?.files || [];
  const summary = previewData?.summary || {
    totalDriveFiles: 0,
    newFiles: 0,
    completed: 0,
    processing: 0,
    queued: 0,
    failed: 0,
  };

  // 3. Filtering
  const filteredFiles = files.filter((file) => {
    const matchesSearch =
      file.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.folderPath.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (file.docType && file.docType.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (file.jurisdiction && file.jurisdiction.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === "all" || file.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // 4. Selection handling
  const handleSelectAll = () => {
    if (selectedIds.size === filteredFiles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredFiles.map((f) => f.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleSyncAll = () => {
    syncMutation.mutate(undefined);
  };

  const handleSyncSelected = () => {
    if (selectedIds.size === 0) return;
    syncMutation.mutate(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleSyncSingle = (fileId: string) => {
    syncMutation.mutate([fileId]);
  };

  const handleRetryFailed = () => {
    retryMutation.mutate();
  };

  const handleRefresh = () => {
    refetchPreview();
    refetchDashboard();
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0C0A09] text-[#1A1614] dark:text-[#E8E0D4] pt-28 pb-20 px-4 sm:px-6 lg:px-8 transition-colors duration-500">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-[#1A1614]/10 dark:border-white/10">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#C7A064]/10 text-[#C7A064] border border-[#C7A064]/20">
                <GoLaw className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-3xl font-heading font-semibold tracking-tight text-[#1A1614] dark:text-[#E8E0D4]">
                  Google Drive Ingestion & Knowledge Hub
                </h1>
                <p className="text-sm text-[#5A5550] dark:text-[#8A8279] mt-0.5">
                  Automated recursive syncing, BGE-M3 hybrid vectorization, and Qdrant ingestion
                </p>
              </div>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isPreviewRefetching || isPreviewLoading}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-[#EFECE6] dark:bg-[#1A1614] text-[#5A5550] dark:text-[#8A8279] hover:text-[#1A1614] dark:hover:text-[#E8E0D4] border border-[#1A1614]/10 dark:border-white/10 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              <FiRefreshCw className={`w-3.5 h-3.5 ${isPreviewRefetching ? "animate-spin text-[#C7A064]" : ""}`} />
              <span>Refresh Drive</span>
            </button>

            {summary.failed > 0 && (
              <button
                onClick={handleRetryFailed}
                disabled={isRetrying}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                <FiAlertTriangle className="w-3.5 h-3.5" />
                <span>Retry Failed ({summary.failed})</span>
              </button>
            )}

            {selectedIds.size > 0 ? (
              <button
                onClick={handleSyncSelected}
                disabled={isSyncing}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg bg-[#C7A064] text-white hover:bg-[#B08930] shadow-md shadow-[#C7A064]/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                <FiPlay className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                <span>Sync Selected ({selectedIds.size})</span>
              </button>
            ) : (
              <button
                onClick={handleSyncAll}
                disabled={isSyncing || summary.newFiles === 0}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg bg-[#C7A064] text-white hover:bg-[#B08930] shadow-md shadow-[#C7A064]/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:bg-[#5A5550]/20 disabled:text-[#5A5550] disabled:shadow-none"
              >
                <FiPlay className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                <span>Sync All New PDFs ({summary.newFiles})</span>
              </button>
            )}
          </div>
        </div>

        {/* 5 KPI Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* 1. Total Drive Files */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#141210] border border-[#1A1614]/10 dark:border-white/10 shadow-sm relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-[#5A5550] dark:text-[#8A8279]">
                Total Drive Files
              </span>
              <div className="p-2 rounded-lg bg-[#5A5550]/10 text-[#5A5550] dark:text-[#8A8279]">
                <FiHardDrive className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold font-heading mt-3 text-[#1A1614] dark:text-[#E8E0D4]">
              {summary.totalDriveFiles}
            </div>
            <p className="text-xs text-[#5A5550] dark:text-[#8A8279] mt-1">Discovered in Drive</p>
          </div>

          {/* 2. Ready to Ingest (New) */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#141210] border border-[#C7A064]/30 dark:border-[#C7A064]/30 shadow-sm relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-[#C7A064]">
                New / Pending
              </span>
              <div className="p-2 rounded-lg bg-[#C7A064]/15 text-[#C7A064]">
                <FiFileText className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold font-heading mt-3 text-[#C7A064]">
              {summary.newFiles}
            </div>
            <p className="text-xs text-[#5A5550] dark:text-[#8A8279] mt-1">Ready for embedding</p>
          </div>

          {/* 3. Completed / Ingested */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#141210] border border-emerald-500/20 shadow-sm relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Completed
              </span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                <FiCheckCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold font-heading mt-3 text-emerald-600 dark:text-emerald-400">
              {summary.completed}
            </div>
            <p className="text-xs text-[#5A5550] dark:text-[#8A8279] mt-1">Indexed in Qdrant</p>
          </div>

          {/* 4. Processing / Queued */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#141210] border border-sky-500/20 shadow-sm relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-sky-600 dark:text-sky-400">
                Processing
              </span>
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-500">
                <FiClock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold font-heading mt-3 text-sky-600 dark:text-sky-400">
              {summary.processing + summary.queued}
            </div>
            <p className="text-xs text-[#5A5550] dark:text-[#8A8279] mt-1">In BullMQ queue</p>
          </div>

          {/* 5. Failed */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#141210] border border-rose-500/20 shadow-sm relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Failed
              </span>
              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500">
                <FiAlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold font-heading mt-3 text-rose-600 dark:text-rose-400">
              {summary.failed}
            </div>
            <p className="text-xs text-[#5A5550] dark:text-[#8A8279] mt-1">Needs attention</p>
          </div>
        </div>

        {/* Search, Filter Bar & Controls */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#141210] border border-[#1A1614]/10 dark:border-white/10 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5550] dark:text-[#8A8279]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by file name, folder, court, docType..."
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-[#FAFAFA] dark:bg-[#0C0A09] border border-[#1A1614]/10 dark:border-white/10 text-[#1A1614] dark:text-[#E8E0D4] placeholder:text-[#5A5550]/60 dark:placeholder:text-[#8A8279]/60 focus:outline-none focus:border-[#C7A064] transition-all"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#FAFAFA] dark:bg-[#0C0A09] border border-[#1A1614]/10 dark:border-white/10">
            {[
              { id: "all", label: "All Files", count: files.length },
              { id: "new", label: "New", count: summary.newFiles },
              { id: "completed", label: "Completed", count: summary.completed },
              { id: "processing", label: "Processing", count: summary.processing + summary.queued },
              { id: "failed", label: "Failed", count: summary.failed },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  statusFilter === tab.id
                    ? "bg-[#C7A064] text-white shadow-sm"
                    : "text-[#5A5550] dark:text-[#8A8279] hover:text-[#1A1614] dark:hover:text-[#E8E0D4]"
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>

        {/* Files Table Section */}
        <div className="rounded-2xl bg-white dark:bg-[#141210] border border-[#1A1614]/10 dark:border-white/10 shadow-sm overflow-hidden">
          {isPreviewLoading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-4">
              <div className="w-10 h-10 border-3 border-[#C7A064]/20 border-t-[#C7A064] rounded-full animate-spin" />
              <p className="text-sm text-[#5A5550] dark:text-[#8A8279]">
                Scanning Google Drive recursively...
              </p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-3 px-4">
              <div className="p-4 rounded-2xl bg-[#5A5550]/10 text-[#5A5550] dark:text-[#8A8279]">
                <FiFolder className="w-8 h-8" />
              </div>
              <h3 className="text-base font-semibold text-[#1A1614] dark:text-[#E8E0D4]">
                No files found
              </h3>
              <p className="text-xs text-[#5A5550] dark:text-[#8A8279] max-w-sm">
                {searchQuery
                  ? "No documents match your search query."
                  : "No PDF files found in your configured Google Drive folder. Upload PDFs to your Drive and click 'Refresh Drive'."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAFAFA] dark:bg-[#0C0A09] border-b border-[#1A1614]/10 dark:border-white/10 text-[#5A5550] dark:text-[#8A8279] uppercase font-semibold tracking-wider">
                  <tr>
                    <th className="p-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          selectedIds.size === filteredFiles.length &&
                          filteredFiles.length > 0
                        }
                        onChange={handleSelectAll}
                        className="rounded border-[#1A1614]/20 text-[#C7A064] focus:ring-[#C7A064] cursor-pointer"
                      />
                    </th>
                    <th className="py-4 px-3">Document Name</th>
                    <th className="py-4 px-3">Drive Folder Path</th>
                    <th className="py-4 px-3">Category & Jurisdiction</th>
                    <th className="py-4 px-3">Size</th>
                    <th className="py-4 px-3">Status</th>
                    <th className="py-4 px-3">Chunks</th>
                    <th className="py-4 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A1614]/5 dark:divide-white/5 font-sans">
                  {filteredFiles.map((file) => {
                    const isSelected = selectedIds.has(file.id);

                    return (
                      <tr
                        key={file.id}
                        className={`hover:bg-[#FAFAFA]/80 dark:hover:bg-[#1A1614]/40 transition-colors ${
                          isSelected ? "bg-[#C7A064]/5 dark:bg-[#C7A064]/10" : ""
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="p-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(file.id)}
                            className="rounded border-[#1A1614]/20 text-[#C7A064] focus:ring-[#C7A064] cursor-pointer"
                          />
                        </td>

                        {/* File Name */}
                        <td className="py-4 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-[#C7A064]/10 text-[#C7A064] shrink-0">
                              <FiFileText className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-medium text-[#1A1614] dark:text-[#E8E0D4] line-clamp-1 max-w-xs sm:max-w-md">
                                {file.fileName}
                              </div>
                              <span className="text-[10px] text-[#5A5550]/70 dark:text-[#8A8279]/70 font-mono">
                                ID: {file.id}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Folder Path */}
                        <td className="py-4 px-3">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#5A5550]/5 dark:bg-[#8A8279]/10 text-[#5A5550] dark:text-[#8A8279] text-[11px] font-mono">
                            <FiFolder className="w-3 h-3 text-[#C7A064]" />
                            <span>{file.folderPath}</span>
                          </div>
                        </td>

                        {/* Category & Jurisdiction */}
                        <td className="py-4 px-3">
                          <div className="space-y-1">
                            {file.docType ? (
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-[#C7A064]/10 text-[#C7A064] border border-[#C7A064]/20">
                                {file.docType.replace(/_/g, " ")}
                              </span>
                            ) : (
                              <span className="text-[11px] text-[#5A5550]/60 dark:text-[#8A8279]/60">
                                Auto-inferred on sync
                              </span>
                            )}
                            {file.jurisdiction && (
                              <div className="text-[10px] text-[#5A5550] dark:text-[#8A8279] font-medium">
                                🏛️ {file.jurisdiction.replace(/_/g, " ")}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* File Size */}
                        <td className="py-4 px-3 font-mono text-xs text-[#5A5550] dark:text-[#8A8279]">
                          {formatBytes(file.fileSizeBytes)}
                        </td>

                        {/* Status Badge */}
                        <td className="py-4 px-3">
                          {file.status === "completed" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              <FiCheckCircle className="w-3 h-3" />
                              <span>Completed</span>
                            </span>
                          )}
                          {file.status === "new" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#C7A064]/10 text-[#C7A064] border border-[#C7A064]/20">
                              <span>New</span>
                            </span>
                          )}
                          {file.status === "processing" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                              <FiClock className="w-3 h-3 animate-spin" />
                              <span>Processing</span>
                            </span>
                          )}
                          {file.status === "queued" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              <FiClock className="w-3 h-3" />
                              <span>In Queue</span>
                            </span>
                          )}
                          {file.status === "failed" && (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                <FiAlertTriangle className="w-3 h-3" />
                                <span>Failed</span>
                              </span>
                              {file.error && (
                                <p className="text-[10px] text-rose-500 max-w-xs truncate" title={file.error}>
                                  {file.error}
                                </p>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Chunks */}
                        <td className="py-4 px-3 font-mono text-xs">
                          {file.chunkCount > 0 ? (
                            <div className="inline-flex items-center gap-1 text-[#1A1614] dark:text-[#E8E0D4] font-semibold">
                              <FiLayers className="w-3 h-3 text-[#C7A064]" />
                              <span>{file.chunkCount}</span>
                            </div>
                          ) : (
                            <span className="text-[#5A5550]/40 dark:text-[#8A8279]/40">—</span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="py-4 px-4 text-right">
                          {file.status === "completed" ? (
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                              Indexed ✨
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSyncSingle(file.id)}
                              disabled={isSyncing || file.status === "processing"}
                              className="px-3 py-1 text-xs font-semibold rounded-lg bg-[#C7A064]/10 text-[#C7A064] hover:bg-[#C7A064] hover:text-white border border-[#C7A064]/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                            >
                              Ingest
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Bottom Help Box */}
        <div className="p-4 rounded-xl bg-[#5A5550]/5 dark:bg-white/5 border border-[#1A1614]/5 dark:border-white/5 flex items-start gap-3">
          <FiInfo className="w-4 h-4 text-[#C7A064] shrink-0 mt-0.5" />
          <div className="text-xs text-[#5A5550] dark:text-[#8A8279] leading-relaxed">
            <span className="font-semibold text-[#1A1614] dark:text-[#E8E0D4]">How Drive Sync Works: </span>
            Our ingestion processor streams PDFs directly from Google Drive without loading entire files into RAM. It breaks documents into semantic legal blocks, generates 1024-dimension BGE-M3 vectors (Dense + Sparse), and saves them into Qdrant for millisecond hybrid retrieval.
          </div>
        </div>
      </div>
    </div>
  );
}
