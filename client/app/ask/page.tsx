import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL!

export const metadata: Metadata = {
  title: "Ask AI | Legal Research Assistant",
  description:
    "Ask legal queries, summarize Supreme Court and High Court judgments, draft legal notices, and research Bharatiya Nyaya Sanhita (BNS) statutes in real-time with Rocky Legal.",
  alternates: {
    canonical: "/ask",
  },
  openGraph: {
    title: "Ask AI | Real-Time Indian Legal Assistant | Rocky Legal",
    description:
      "Ask legal questions, find Supreme Court precedents, and analyze case law instantly. 100% Free for Advocates.",
    url: `${siteUrl}/ask`,
    siteName: "Rocky Legal",
    images: [
      {
        url: "/heroimg.png",
        width: 1200,
        height: 630,
        alt: "Rocky Legal Legal Research Chat",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ask AI | Legal Research Assistant | Rocky Legal",
    description:
      "Real-time Indian case law research, Supreme Court judgment analysis, and statute references.",
    images: ["/heroimg.png"],
  },
};

// Page renders nothing — the layout handles all UI.
// This page only provides SEO metadata for /ask.
export default function AskPage() {
  return null;
}
