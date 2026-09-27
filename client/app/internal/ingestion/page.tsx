import type { Metadata } from "next";
import dynamic from "next/dynamic";

const IngestionDashboard = dynamic(
  () => import("@/components/ingestion/IngestionDashboard"),
  {
    loading: () => (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0C0A09] pt-28 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-8 animate-pulse">
          {/* Header skeleton */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#C7A064]/10" />
            <div className="space-y-2">
              <div className="w-80 h-7 rounded bg-[#5A5550]/10 dark:bg-[#8A8279]/10" />
              <div className="w-60 h-4 rounded bg-[#5A5550]/10 dark:bg-[#8A8279]/10" />
            </div>
          </div>
          {/* KPI cards skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-5 rounded-2xl bg-white dark:bg-[#141210] border border-[#1A1614]/10 dark:border-white/10">
                <div className="w-20 h-3 rounded bg-[#5A5550]/10 dark:bg-[#8A8279]/10 mb-3" />
                <div className="w-12 h-7 rounded bg-[#5A5550]/10 dark:bg-[#8A8279]/10" />
              </div>
            ))}
          </div>
          {/* Table skeleton */}
          <div className="rounded-2xl bg-white dark:bg-[#141210] border border-[#1A1614]/10 dark:border-white/10 p-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-4 border-b border-[#1A1614]/5 dark:border-white/5 last:border-0">
                <div className="w-4 h-4 rounded bg-[#5A5550]/10 dark:bg-[#8A8279]/10" />
                <div className="w-8 h-8 rounded-lg bg-[#5A5550]/10 dark:bg-[#8A8279]/10" />
                <div className="flex-1 space-y-2">
                  <div className="w-48 h-3 rounded bg-[#5A5550]/10 dark:bg-[#8A8279]/10" />
                  <div className="w-24 h-2 rounded bg-[#5A5550]/10 dark:bg-[#8A8279]/10" />
                </div>
                <div className="w-16 h-5 rounded-full bg-[#5A5550]/10 dark:bg-[#8A8279]/10" />
                <div className="w-16 h-6 rounded-lg bg-[#5A5550]/10 dark:bg-[#8A8279]/10" />
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
);

export const metadata: Metadata = {
  title: "Drive Ingestion & Knowledge Hub | Rocky Legal",
  description:
    "Manage, preview, and synchronize Google Drive legal PDF documents with the BGE-M3 hybrid vector database.",
  alternates: {
    canonical: "/ingest",
  },
};

export default function IngestionPage() {
  return <IngestionDashboard />;
}
