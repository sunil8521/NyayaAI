"use client";

import ReactMarkdown from "react-markdown";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import {
  FiMenu,
  FiSend,
  FiAlertCircle,
  FiArrowUpRight,
  FiPlus,
  FiUser,
  FiCopy,
  FiCheck,
  FiFileText,
  FiChevronDown,
  FiDatabase,
} from "react-icons/fi";
import { GoLaw } from "react-icons/go";
import {
  chatHistoryQueryOptions,
  useCreateChatMutation,
  useStreamMessage,
} from "@/lib/queries/chat";
import { useQuery } from "@tanstack/react-query";
import { ModeToggle } from "@/components/mode-toggle";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChatMessage } from "@/lib/api/chat";
import { useSession } from "@/lib/auth-client";

interface ChatAreaProps {
  threadId?: string;
  onOpenSidebar: () => void;
}

const suggestedSearches = [
  "Was there any horizontal overlap between Tata Chemicals and Wyoming 1?",
  "Did the ultimate control over IVRCL AHL change after the proposed combination?",
  "Which two companies were involved in combination C-2011/10/07?",
  "How many companies were involved in the Akzo Nobel amalgamation?",
  "Did the CCI impose penalty proceedings against GS Mace Holdings Ltd?",
];

// Removed HighlightedText as per user feedback to rely on LLM markdown rendering

export default function ChatArea({ threadId, onOpenSidebar }: ChatAreaProps) {
  const router = useRouter();
  const { data: session } = useSession();

  const adminEmailsStr = process.env.NEXT_PUBLIC_ADMIN_EMAILS || "";
  const adminEmails = adminEmailsStr.split(",").map((e) => e.trim().toLowerCase());
  const isAdmin = session?.user?.email && adminEmails.includes(session.user.email.toLowerCase());

  const { register, handleSubmit, reset } = useForm<{ query: string }>();

  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isExecutingRef = useRef(false);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => {
      setCopiedIndex((prev) => (prev === index ? null : prev));
    }, 2000);
  };

  const createChatMutation = useCreateChatMutation();
  const { send: streamSend, isStreaming: isStreamingMessage, error: streamError } = useStreamMessage();

  // Fetch real chat history if threadId is provided.
  // CRITICAL: Disable all automatic refetching while streaming to prevent duplicates.
  // The optimistic cache is the source of truth during a stream.
  const { data: serverMessages = [], isLoading: isLoadingHistory } = useQuery({
    ...chatHistoryQueryOptions(threadId),
    staleTime: isStreamingMessage ? Infinity : 30_000,
    refetchOnWindowFocus: !isStreamingMessage,
    refetchOnReconnect: !isStreamingMessage,
  });

  // When inside a thread, serverMessages has all messages including optimistic ones from onMutate!
  // When on /ask, show pendingPrompt while the new thread is being initialized.
  const allMessages: ChatMessage[] = threadId
    ? serverMessages
    : pendingPrompt
      ? [{ role: "user", content: pendingPrompt }]
      : [];

  const hasMessages = allMessages.length > 0 || !!threadId;
  const isGenerating = createChatMutation.isPending || isStreamingMessage;

  // Clear pending prompt on thread change
  useEffect(() => {
    setPendingPrompt(null);
  }, [threadId]);

  // Execute pending query from landing page search
  useEffect(() => {
    const pendingQuery = sessionStorage.getItem("pendingQuery");
    if (pendingQuery && !threadId) {
      sessionStorage.removeItem("pendingQuery");
      executeSearch(pendingQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages, isGenerating]);

  const executeSearch = async (query: string) => {
    if (!query || !query.trim() || isGenerating || isExecutingRef.current) return;

    isExecutingRef.current = true;
    const userText = query.trim();
    
    reset();
    const textareas = document.querySelectorAll('textarea');
    textareas.forEach(ta => { ta.style.height = 'auto'; });

    try {
      if (!threadId) {
        // 1. On /ask (New Chat) -> Show query immediately and create thread
        setPendingPrompt(userText);
        const createRes = await createChatMutation.mutateAsync();
        const newThreadId = createRes.threadId;

        if (newThreadId) {
          // 2. Change URL to /ask/c/:threadId
          router.push(`/ask/c/${newThreadId}`);

          // 3. Send message — will optimistically append the user message to cache and stream response
          streamSend(newThreadId, userText);
        }
      } else {
        // Already inside a thread -> optimistically append user message immediately to cache and stream!
        streamSend(threadId, userText);
      }
    } catch (err: any) {
      console.error("Failed to execute search:", err);
      setPendingPrompt(null);
    } finally {
      // Release the execution lock after a short debounce to prevent double clicks
      setTimeout(() => {
        isExecutingRef.current = false;
      }, 300);
    }
  };

  const onFormSubmit = (data: { query: string }) => {
    executeSearch(data.query);
  };

  const handleNewChat = () => {
    router.push("/ask");
  };

  return (
    <div className="flex flex-col h-dvh w-full bg-[#FAFAFA] dark:bg-[#0C0A09] transition-colors duration-500 overflow-hidden">
      {/* Top Navbar Bar */}
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
          {isAdmin && (
            <Link
              href="/internal/ingestion"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#C7A064]/10 dark:bg-[#C7A064]/20 text-[#C7A064] hover:bg-[#C7A064]/20 dark:hover:bg-[#C7A064]/30 border border-[#C7A064]/30 transition-colors cursor-pointer"
              title="Drive Ingest"
            >
              <FiDatabase className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Drive Ingest</span>
            </Link>
          )}
          {hasMessages && (
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

      {!hasMessages ? (
        /* ================= EMPTY SEARCH STATE ================= */
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center max-w-4xl mx-auto w-full py-8 sm:py-12 animate-in fade-in duration-500">
          {/* Centered Search Input Box */}
          <div className="w-full relative mb-10 sm:mb-14">
            <form onSubmit={handleSubmit(onFormSubmit)} className="relative border-b-2 border-[#1A1614]/15 dark:border-white/15 transition-colors focus-within:border-[#C7A064] dark:focus-within:border-[#C7A064] pb-2 sm:pb-3">
              <textarea
                {...register("query")}
                onChange={(e) => {
                  register("query").onChange(e);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                }}
                rows={1}
                placeholder="Ask a legal question..."
                className="w-full bg-transparent py-2 sm:py-3 pr-12 text-[#1A1614] dark:text-[#E8E0D4] text-base sm:text-xl lg:text-2xl placeholder:text-[#5A5550]/60 dark:placeholder:text-[#8A8279]/60 focus:outline-none font-sans font-normal not-italic tracking-normal resize-none overflow-y-auto scrollbar-thin [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#1A1614]/20 dark:[&::-webkit-scrollbar-thumb]:bg-[#E8E0D4]/20 [&::-webkit-scrollbar-thumb]:rounded-full"
                style={{ minHeight: '44px' }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(onFormSubmit)();
                  }
                }}
              />
              <button
                type="submit"
                disabled={isGenerating}
                className="absolute right-0 bottom-1 sm:bottom-2 p-2.5 text-[#5A5550] dark:text-[#8A8279] hover:text-[#C7A064] dark:hover:text-[#C7A064] disabled:opacity-20 transition-colors cursor-pointer"
                aria-label="Send query"
              >
                <FiSend className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </form>
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
                  disabled={isGenerating}
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
              {isLoadingHistory ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-6 bg-[#1A1614]/5 dark:bg-[#2A2522] rounded w-1/3" />
                  <div className="h-20 bg-[#1A1614]/5 dark:bg-[#2A2522] rounded-2xl" />
                </div>
              ) : (
                allMessages.map((msg, index) => {
                  return msg.role === "user" ? (
                    <div
                      key={index}
                      className="flex justify-end animate-in slide-in-from-bottom-2 fade-in duration-300"
                    >
                      <div className="max-w-[88%] sm:max-w-[78%] px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl rounded-tr-xs bg-[#F4ECE1] dark:bg-[#1A1714] text-[#1A1614] dark:text-[#F3EDE2] border border-[#E0D5C3] dark:border-[#332A22] shadow-xs">
                        <p className="text-sm sm:text-base font-normal leading-relaxed whitespace-pre-wrap font-sans">
                          {msg.content}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div key={index} className="relative group">
                      <div className="space-y-3 animate-in slide-in-from-bottom-2 fade-in duration-500">
                        {/* Assistant Header Row */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <GoLaw className="w-4 h-4 text-[#1A1614] dark:text-white shrink-0" />
                            <span className="text-xs font-bold uppercase tracking-widest text-[#1A1614] dark:text-white">
                              Rocky Legal
                            </span>
                          </div>

                          <button
                            onClick={() => handleCopy(msg.content, index)}
                            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-[#5A5550] dark:text-[#8A8279] hover:text-[#1A1614] dark:hover:text-white hover:bg-[#1A1614]/5 dark:hover:bg-[#2A2522] rounded-md transition-all cursor-pointer"
                            title="Copy response"
                          >
                            {copiedIndex === index ? (
                              <>
                                <FiCheck className="w-3.5 h-3.5 text-emerald-500" />
                                <span className="text-[11px] font-medium text-emerald-500">Copied</span>
                              </>
                            ) : (
                              <>
                                <FiCopy className="w-3.5 h-3.5" />
                                <span className="text-[11px] font-medium hidden sm:inline">Copy</span>
                              </>
                            )}
                          </button>
                        </div>

                        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#12100E] border border-[#1A1614]/10 dark:border-[#26211D] text-[#1A1614] dark:text-[#E8E0D4] text-sm sm:text-base leading-relaxed font-sans shadow-xs [&>p]:mb-2 last:[&>p]:mb-0 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-2 [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:mb-2 [&>h3]:font-bold [&>h3]:text-lg [&>h3]:mb-2 [&>h1]:font-bold [&>h1]:text-xl [&>h2]:font-bold [&>h2]:text-lg [&>blockquote]:border-l-4 [&>blockquote]:border-[#C7A064] [&>blockquote]:pl-4 [&>blockquote]:italic [&>strong]:font-bold [&>strong]:text-[#C7A064]">
                          {msg.content ? (
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          ) : isGenerating ? (
                            <div className="flex items-center gap-3 text-[#5A5550] dark:text-[#8A8279] py-1">
                            
                              <span className="text-sm font-medium animate-pulse">
                                Searching legal documents...
                              </span>
                            </div>
                          ) : null}
                        </div>

                        {/* Sources Section */} 
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="mt-2 animate-in fade-in duration-500">
                            <details className="group border border-[#1A1614]/10 dark:border-[#26211D] rounded-xl overflow-hidden bg-white/50 dark:bg-[#12100E]/50">
                              <summary className="flex items-center gap-2 p-3 text-xs sm:text-sm font-semibold text-[#5A5550] dark:text-[#8A8279] cursor-pointer hover:bg-[#1A1614]/5 dark:hover:bg-white/5 transition-colors select-none">
                                <FiFileText className="w-4 h-4 text-[#C7A064]" />
                                <span>Sources ({msg.sources.length})</span>
                                <FiChevronDown className="w-4 h-4 ml-auto transition-transform group-open:rotate-180" />
                              </summary>
                              <div className="p-3 border-t border-[#1A1614]/5 dark:border-[#26211D] space-y-3 bg-white/30 dark:bg-transparent">
                                {msg.sources.map((src, i) => (
                                  <div key={i} className="flex gap-3 text-sm">
                                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#1A1614]/5 dark:bg-white/10 flex items-center justify-center text-xs font-bold text-[#C7A064]">
                                      {i + 1}
                                    </div>
                                    <div className="flex-1 space-y-1">
                                      <div className="font-semibold text-[#1A1614] dark:text-[#E8E0D4] break-all">
                                        {src.fileName}
                                      </div>
                                      <div className="text-xs text-[#5A5550] dark:text-[#8A8279]">
                                        Page {src.pageStart === src.pageEnd ? src.pageStart : `${src.pageStart}-${src.pageEnd}`} • Chunk {src.chunkIndex}
                                      </div>
                                      {src.excerpt && (
                                        <div className="text-xs italic text-[#5A5550] dark:text-[#8A8279] mt-1 border-l-2 border-[#C7A064] pl-2">
                                          "{src.excerpt.trim()}..."
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </details>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Error Notice */}
              {streamError && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs sm:text-sm flex items-center gap-3">
                  <FiAlertCircle className="w-5 h-5 shrink-0" />
                  <span>{streamError}</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Floating Sticky Input Bar at Bottom */}
          <div className="p-3 sm:p-4 bg-linear-to-t from-[#FAFAFA] via-[#FAFAFA] to-transparent dark:from-[#0C0A09] dark:via-[#0C0A09] dark:to-transparent border-t border-[#1A1614]/5 dark:border-[#2A2522]/40 shrink-0">
            <div className="max-w-3xl mx-auto">
              <form onSubmit={handleSubmit(onFormSubmit)} className="relative bg-white dark:bg-[#141210] border border-[#1A1614]/15 dark:border-[#2A2522] shadow-md rounded-2xl sm:rounded-3xl px-4 py-2 sm:py-2.5 flex items-end gap-3 transition-all focus-within:border-[#C7A064] dark:focus-within:border-[#C7A064] focus-within:ring-2 focus-within:ring-[#C7A064]/15">
                <textarea
                  {...register("query")}
                  onChange={(e) => {
                    register("query").onChange(e);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
                  }}
                  rows={1}
                  placeholder="Message Rocky Legal..."
                  className="w-full bg-transparent outline-none text-[#1A1614] dark:text-[#E8E0D4] text-sm sm:text-base placeholder:text-[#5A5550]/60 dark:placeholder:text-[#8A8279]/60 font-sans not-italic resize-none overflow-y-auto py-1 sm:py-1.5 scrollbar-thin [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#1A1614]/20 dark:[&::-webkit-scrollbar-thumb]:bg-[#E8E0D4]/20 [&::-webkit-scrollbar-thumb]:rounded-full"
                  style={{ minHeight: '36px' }}
                  disabled={isGenerating}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(onFormSubmit)();
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={isGenerating}
                  className="px-4 py-2 bg-[#1A1614] dark:bg-[#C7A064] text-white dark:text-[#1A1614] font-semibold text-xs sm:text-sm rounded-xl sm:rounded-full hover:opacity-90 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs mb-0.5"
                  aria-label="Send message"
                >
                  <span className="hidden sm:inline">Ask AI</span>
                  <FiSend className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </form>
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
