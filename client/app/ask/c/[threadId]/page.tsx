import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Legal Research Chat | Rocky Legal",
  description: "AI Legal Research Assistant for Advocates and Legal Professionals.",
  robots: {
    index: false,
    follow: false,
  },
};

// Page renders nothing — the layout handles all UI.
// This page only provides SEO metadata for /ask/c/:threadId.
export default function ChatThreadPage() {
  return null;
}
