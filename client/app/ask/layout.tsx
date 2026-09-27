"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Sidebar from "@/components/chat/Sidebar";
import ChatArea from "@/components/chat/ChatArea";

export default function AskLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // Read threadId from URL params — auto-updates on navigation.
  // On /ask → params is {} (no threadId). On /ask/c/abc → params.threadId = "abc".
  const params = useParams<{ threadId?: string }>();
  const threadId = params?.threadId;

  return (
    <div className="flex h-dvh overflow-hidden bg-white dark:bg-[#0C0A09]">
      {/* Sidebar with dynamic chats */}
      <Sidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        activeThreadId={threadId}
      />

      {/* Main Chat Area — same instance stays mounted across /ask ↔ /ask/c/:id */}
      <div className="flex-1 flex flex-col h-full relative">
        <ChatArea
          threadId={threadId}
          onOpenSidebar={() => setIsSidebarOpen(true)}
        />
      </div>

      {/* children is the page content (null for both routes) — needed by Next.js layout contract */}
      {children}
    </div>
  );
}
