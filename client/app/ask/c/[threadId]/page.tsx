import type { Metadata } from "next";
import AskContainer from "@/components/chat/AskContainer";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://rocky.legal";

export const metadata: Metadata = {
  title: "Legal Research Chat | Rocky Legal",
  description: "AI Legal Research Assistant for Advocates and Legal Professionals.",
  robots: {
    index: false,
    follow: false,
  },
};

interface PageProps {
  params: Promise<{ threadId: string }>;
}

export default async function ChatThreadPage({ params }: PageProps) {
  const { threadId } = await params;
  return <AskContainer threadId={threadId} />;
}
