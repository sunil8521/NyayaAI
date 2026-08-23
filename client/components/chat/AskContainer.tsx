"use client";

import { useState } from "react";
import Sidebar from "@/components/chat/Sidebar";
import ChatArea from "@/components/chat/ChatArea";

interface AskContainerProps {
  threadId?: string;
}

export default function AskContainer({ threadId }: AskContainerProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-[#0C0A09]">
      {/* Sidebar with dynamic chats */}
      <Sidebar
        isOpen={isSidebarOpen}  
        setIsOpen={setIsSidebarOpen}
        activeThreadId={threadId}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative">
        <ChatArea
          threadId={threadId}
          onOpenSidebar={() => setIsSidebarOpen(true)}
        />
      </div>
    </div>
  );
}
