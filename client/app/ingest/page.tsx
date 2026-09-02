import type { Metadata } from "next";
import IngestionDashboard from "@/components/ingestion/IngestionDashboard";

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
