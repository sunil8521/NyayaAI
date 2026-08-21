import type { Metadata } from "next";
import AskContainer from "@/components/chat/AskContainer";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://nyayaai.in";

export const metadata: Metadata = {
  title: "Ask AI — Legal Research Assistant",
  description:
    "Ask legal queries, summarize Supreme Court and High Court judgments, draft legal notices, and research Bharatiya Nyaya Sanhita (BNS) statutes in real-time with NyayaAI.",
  alternates: {
    canonical: "/ask",
  },
  openGraph: {
    title: "Ask AI — Real-Time Indian Legal Assistant | NyayaAI",
    description:
      "Ask legal questions, find Supreme Court precedents, and analyze case law instantly. 100% Free for Advocates.",
    url: `${siteUrl}/ask`,
    siteName: "NyayaAI",
    images: [
      {
        url: "/heroimg.png",
        width: 1200,
        height: 630,
        alt: "NyayaAI Legal Research Chat",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ask AI — Legal Research Assistant | NyayaAI",
    description:
      "Real-time Indian case law research, Supreme Court judgment analysis, and statute references.",
    images: ["/heroimg.png"],
  },
};

export default function AskPage() {
  return <AskContainer />;
}
