import { create } from "zustand";

interface IngestionState {
  /** Currently selected file IDs for bulk actions */
  selectedIds: Set<string>;
  /** File IDs currently being ingested (for per-row spinners) */
  ingestingIds: Set<string>;
  /** Current status filter tab */
  statusFilter: string;
  /** Current search input (raw) */
  searchQuery: string;
  /** Debounced search (used for API calls) */
  debouncedSearch: string;
  /** Current page for main file list */
  currentPage: number;
  /** Current page for deleted files tab */
  deletedPage: number;
  /** Page size */
  pageSize: number;

  // Actions
  toggleSelect: (id: string) => void;
  selectAll: (ids: string[]) => void;
  deselectAll: (ids: string[]) => void;
  clearSelection: () => void;
  setStatusFilter: (filter: string) => void;
  setSearchQuery: (query: string) => void;
  setDebouncedSearch: (query: string) => void;
  setCurrentPage: (page: number) => void;
  setDeletedPage: (page: number) => void;
  markIngesting: (ids: string[]) => void;
  unmarkIngesting: (ids: string[]) => void;
}

export const useIngestionStore = create<IngestionState>((set) => ({
  selectedIds: new Set(),
  ingestingIds: new Set(),
  statusFilter: "all",
  searchQuery: "",
  debouncedSearch: "",
  currentPage: 1,
  deletedPage: 1,
  pageSize: 50,

  toggleSelect: (id) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    }),

  selectAll: (ids) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      ids.forEach((id) => next.add(id));
      return { selectedIds: next };
    }),

  deselectAll: (ids) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      ids.forEach((id) => next.delete(id));
      return { selectedIds: next };
    }),

  clearSelection: () => set({ selectedIds: new Set() }),

  setStatusFilter: (filter) =>
    set({ statusFilter: filter, selectedIds: new Set(), currentPage: 1 }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setDebouncedSearch: (query) => set({ debouncedSearch: query, currentPage: 1 }),

  setCurrentPage: (page) => set({ currentPage: page }),

  setDeletedPage: (page) => set({ deletedPage: page }),

  markIngesting: (ids) =>
    set((s) => {
      const next = new Set(s.ingestingIds);
      ids.forEach((id) => next.add(id));
      return { ingestingIds: next };
    }),

  unmarkIngesting: (ids) =>
    set((s) => {
      const next = new Set(s.ingestingIds);
      ids.forEach((id) => next.delete(id));
      return { ingestingIds: next };
    }),
}));
