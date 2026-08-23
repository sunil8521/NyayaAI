"use client";

import { useState } from "react";
import {
  FiMenu,
  FiSend,
  FiAlertCircle,
  FiArrowUpRight,
  FiPlus,
} from "react-icons/fi";
import { GoLaw } from "react-icons/go";
import { useChatMutation } from "@/lib/queries/chat";
import { useSession } from "@/lib/auth-client";
import { ModeToggle } from "@/components/mode-toggle";
import Link from "next/link";

interface ChatAreaProps {
  onOpenSidebar: () => void;
}

const suggestedSearches = [
  "What is the weather in Delhi?",
  "Please send an email to client@lawfirm.com with subject Case Status",
  "Decriminalisation of homosexuality under IPC Section 377",
  "Validity of triple talaq and key Supreme Court guidelines",
  "Passive euthanasia and living will precedent judgments",
];

type Message = {
  role: "user" | "ai";
  content: string;
};

export default function ChatArea({ onOpenSidebar }: ChatAreaProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const { data: session } = useSession();

  const chatMutation = useChatMutation();

  const hasSearched = messages.length > 0;

  const executeSearch = (query: string) => {
    if (!query.trim() || chatMutation.isPending) return;

    const userMessage: Message = { role: "user", content: query };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    // Send query to backend LangGraph chat engine via TanStack Query mutation
    chatMutation.mutate(
      {
        message: query,
        threadId: session?.user?.id || "user-session-1",
      },
      {
        onSuccess: (data) => {
          const aiMessage: Message = {
            role: "ai",
            content: data.response || "No response received from the agent.",
          };
          setMessages((prev) => [...prev, aiMessage]);
        },
        onError: (err) => {
          const errorMessage: Message = {
            role: "ai",
            content: `❌ Error communicating with AI server: ${err.message}`,
          };
          setMessages((prev) => [...prev, errorMessage]);
        },
      }
    );
  };

  const handleSend = () => {
    executeSearch(input);
  };

  const handleNewChat = () => {
    setMessages([]);
    setInput("");
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#FAFAFA] dark:bg-[#0C0A09] transition-colors duration-500 overflow-hidden">
      {/* Top Navbar Bar (Mobile & Desktop) */}
      <header className="flex items-center justify-between px-4 py-3 sm:px-6 border-b border-[#1A1614]/5 dark:border-[#2A2522] bg-[#FAFAFA]/80 dark:bg-[#0C0A09]/80 backdrop-blur-md shrink-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenSidebar}
            className="lg:hidden p-2 -ml-1 text-[#5A5550] dark:text-[#8A8279] hover:text-[#1A1614] dark:hover:text-[#E8E0D4] hover:bg-[#1A1614]/5 dark:hover:bg-[#1A1614]/30 rounded-xl transition-colors cursor-pointer"
            aria-label="Open sidebar"
          >
            <FiMenu className="w-5 h-5" />
          </button>

          <Link href="/" className="flex items-center gap-2">
            <GoLaw className="w-5 h-5 sm:w-6 sm:h-6 text-[#1A1614] dark:text-[#E8E0D4]" />
            <span className="text-[#1A1614] dark:text-[#E8E0D4] font-heading text-lg sm:text-xl font-normal italic">
              Rocky Legal
            </span>
            
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {hasSearched && (
            <button
              onClick={handleNewChat}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#1A1614]/5 dark:bg-[#1A1614]/40 hover:bg-[#1A1614]/10 dark:hover:bg-[#1A1614]/60 text-[#1A1614] dark:text-[#E8E0D4] border border-[#1A1614]/10 dark:border-[#2A2522] transition-colors cursor-pointer"
            >
              <FiPlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Query</span>
            </button>
          )}
          <ModeToggle />
        </div>
      </header>

      {!hasSearched ? (
        /* ================= EMPTY SEARCH STATE ================= */
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center max-w-4xl mx-auto w-full py-8 sm:py-12 animate-in fade-in duration-500">
          {/* Centered Search Input Box */}
          <div className="w-full relative mb-10 sm:mb-14">
            <div className="relative border-b-2 border-[#1A1614]/15 dark:border-white/15 transition-colors focus-within:border-[#C7A064] dark:focus-within:border-[#C7A064] pb-2 sm:pb-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Search judgments or ask legal questions..."
                className="w-full bg-transparent py-2 sm:py-3 pr-12 text-[#1A1614] dark:text-[#E8E0D4] text-base sm:text-xl lg:text-2xl placeholder:text-[#5A5550]/60 dark:placeholder:text-[#8A8279]/60 focus:outline-none font-sans font-normal not-italic tracking-normal"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || chatMutation.isPending}
                className="absolute right-0 top-1/2 -translate-y-1/2 p-2.5 text-[#5A5550] dark:text-[#8A8279] hover:text-[#C7A064] dark:hover:text-[#C7A064] disabled:opacity-20 transition-colors cursor-pointer"
                aria-label="Send query"
              >
                <FiSend className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
          </div>

          {/* Suggested Queries Grid */}
          <div className="w-full max-w-3xl text-left self-start">
            <h2 className="text-[11px] font-bold text-[#5A5550] dark:text-[#8A8279] uppercase tracking-[0.18em] mb-4">
              Suggested Queries
            </h2>
            <div className="space-y-2.5 sm:space-y-3">
              {suggestedSearches.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => executeSearch(item)}
                  disabled={chatMutation.isPending}
                  className="w-full p-3 sm:p-3.5 rounded-xl bg-white dark:bg-[#12100E] border border-[#1A1614]/5 dark:border-[#2A2522] hover:border-[#C7A064]/50 dark:hover:border-[#C7A064]/50 shadow-xs hover:shadow-sm text-left text-xs sm:text-sm text-[#1A1614] dark:text-[#E8E0D4] hover:text-[#C7A064] dark:hover:text-[#C7A064] transition-all flex items-center justify-between gap-3 group cursor-pointer"
                >
                  <span className="font-normal leading-relaxed">{item}</span>
                  <FiArrowUpRight className="w-4 h-4 text-[#C7A064] opacity-80 sm:opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ================= CHAT CONVERSATION STATE ================= */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Chat Messages Transcript */}
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:py-8 lg:py-10 animate-in fade-in duration-500">
            <div className="max-w-3xl mx-auto space-y-8 sm:space-y-10">
              {messages.map((msg, index) =>
                msg.role === "user" ? (
                  <div key={index} className="border-b border-[#1A1614]/10 dark:border-[#2A2522] pb-5">
                    <p className="text-[#C7A064] text-[11px] font-bold uppercase tracking-widest mb-2">
                      Legal Query
                    </p>
                    <p className="text-base sm:text-xl font-semibold text-[#1A1614] dark:text-[#E8E0D4] font-sans not-italic leading-relaxed">
                      {msg.content}
                    </p>
                  </div>
                ) : (
                  <div key={index} className="relative">
                    <div className="space-y-4 animate-in slide-in-from-bottom-2 fade-in duration-500">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-[#1A1614] dark:bg-[#C7A064] text-white dark:text-[#1A1614] flex items-center justify-center shadow-xs">
                          <GoLaw className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest text-[#5A5550] dark:text-[#8A8279]">
                          Rocky Legal Assistant
                        </span>
                      </div>

                      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#12100E] border border-[#1A1614]/10 dark:border-[#2A2522] text-[#1A1614] dark:text-[#E8E0D4] text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-sans shadow-xs">
                        {msg.content}
                      </div>
                    </div>
                  </div>
                )
              )}

              {/* Thinking Indicator */}
              {chatMutation.isPending && (
                <div className="flex items-center gap-3 text-[#5A5550] dark:text-[#8A8279] animate-pulse p-4 rounded-xl bg-white/50 dark:bg-[#12100E]/50 border border-[#1A1614]/5 dark:border-[#2A2522]">
                  <div className="w-6 h-6 rounded-md bg-[#C7A064]/20 flex items-center justify-center">
                    
                  </div>
                  <span className="text-xs sm:text-sm font-medium">
                    Researching Indian case law & analyzing statutes...
                  </span>
                </div>
              )}

              {/* Error Notice */}
              {chatMutation.isError && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs sm:text-sm flex items-center gap-3">
                  <FiAlertCircle className="w-5 h-5 shrink-0" />
                  <span>{chatMutation.error.message}</span>
                </div>
              )}
            </div>
          </div>

          {/* Clean Floating Sticky Input Bar at Bottom */}
          <div className="p-3 sm:p-4 bg-linear-to-t from-[#FAFAFA] via-[#FAFAFA] to-transparent dark:from-[#0C0A09] dark:via-[#0C0A09] dark:to-transparent border-t border-[#1A1614]/5 dark:border-[#2A2522]/40 shrink-0">
            <div className="max-w-3xl mx-auto">
              <div className="relative bg-white dark:bg-[#141210] border border-[#1A1614]/15 dark:border-[#2A2522] shadow-md rounded-2xl sm:rounded-full px-4 py-2 sm:py-2.5 flex items-center gap-3 transition-all focus-within:border-[#C7A064] dark:focus-within:border-[#C7A064] focus-within:ring-2 focus-within:ring-[#C7A064]/15">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a follow-up question or continue legal research..."
                  className="w-full bg-transparent outline-none text-[#1A1614] dark:text-[#E8E0D4] text-sm sm:text-base placeholder:text-[#5A5550]/60 dark:placeholder:text-[#8A8279]/60 font-sans not-italic"
                  disabled={chatMutation.isPending}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || chatMutation.isPending}
                  className="px-4 py-2 bg-[#1A1614] dark:bg-[#C7A064] text-white dark:text-[#1A1614] font-semibold text-xs sm:text-sm rounded-xl sm:rounded-full hover:opacity-90 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                  aria-label="Send message"
                >
                  <span className="hidden sm:inline">Ask AI</span>
                  <FiSend className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
              <p className="text-[10px] text-center text-[#5A5550]/60 dark:text-[#8A8279]/60 pt-2">
                Rocky Legal Assistant for Indian Legal Research. Always verify critical statutory citations.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
