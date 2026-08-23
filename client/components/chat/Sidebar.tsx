"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  FiMessageSquare,
  FiPlus,
  FiX,
  FiSettings,
  FiLogOut,
  FiTrash2,
  FiPhone,
  FiMail,
  FiLoader,
} from "react-icons/fi";
import { GoLaw } from "react-icons/go";
import Link from "next/link";
import { useSession, signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { chatsQueryOptions, useDeleteChatMutation } from "@/lib/queries/chat";
import type { ChatSession } from "@/lib/api/chat";

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  activeThreadId?: string;
}

function groupChatsByDate(chats: ChatSession[]) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const last7DaysStart = todayStart - 7 * 86400000;

  const groups = [
    { title: "Today", chats: [] as ChatSession[] },
    { title: "Yesterday", chats: [] as ChatSession[] },
    { title: "Previous 7 Days", chats: [] as ChatSession[] },
    { title: "Older", chats: [] as ChatSession[] },
  ];

  for (const chat of chats) {
    const time = new Date(chat.updatedAt || chat.createdAt).getTime();
    if (time >= todayStart) {
      groups[0].chats.push(chat);
    } else if (time >= yesterdayStart) {
      groups[1].chats.push(chat);
    } else if (time >= last7DaysStart) {
      groups[2].chats.push(chat);
    } else {
      groups[3].chats.push(chat);
    }
  }

  return groups.filter((g) => g.chats.length > 0);
}

export default function Sidebar({ isOpen, setIsOpen, activeThreadId }: SidebarProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [threadToDelete, setThreadToDelete] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Fetch real chats from MongoDB via TanStack Query
  const { data: chats = [], isLoading } = useQuery(chatsQueryOptions);
  const deleteChatMutation = useDeleteChatMutation();

  const groupedChats = useMemo(() => groupChatsByDate(chats), [chats]);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    if (isProfileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isProfileMenuOpen]);

  // Keyboard shortcut for New Chat (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        router.push("/ask");
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, setIsOpen]);

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleLogout = async () => {
    await signOut();
    router.push("/");
    router.refresh();
  };

  const handleNewChat = () => {
    router.push("/ask");
    setIsOpen(false);
  };

  const promptDeleteChat = (e: React.MouseEvent, threadId: string) => {
    e.stopPropagation();
    e.preventDefault();
    setThreadToDelete(threadId);
  };

  const handleConfirmDelete = () => {
    if (!threadToDelete) return;
    const targetId = threadToDelete;
    setThreadToDelete(null);

    deleteChatMutation.mutate(targetId, {
      onSuccess: () => {
        setToastMessage({ text: "Chat is deleted", isError: false });
        if (activeThreadId === targetId) {
          router.push("/ask");
        }
      },
      onError: () => {
        setToastMessage({ text: "Failed to delete chat", isError: true });
      },
    });
  };

  const user = session?.user;
  const userInitial = user?.name ? user.name[0].toUpperCase() : "A";
  const userMobile = (user as any)?.mobile;

  return (
    <>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-70 animate-in slide-in-from-top-2 fade-in duration-300">
          <div
            className={`px-4 py-2.5 rounded-xl shadow-lg border text-xs sm:text-sm font-medium transition-all ${toastMessage.isError
                ? "bg-red-500/10 dark:bg-red-950/40 border-red-500/30 text-red-600 dark:text-red-400"
                : "bg-white dark:bg-[#181512] border-[#1A1614]/15 dark:border-[#2A2522] text-[#1A1614] dark:text-[#E8E0D4]"
              }`}
          >
            {toastMessage.text}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {threadToDelete && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
          onClick={() => !deleteChatMutation.isPending && setThreadToDelete(null)}
        >
          <div
            className="bg-white dark:bg-[#181512] border border-[#1A1614]/15 dark:border-[#2A2522] rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-5 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-base font-semibold text-[#1A1614] dark:text-[#E8E0D4] text-center">
              Do you want to delete?
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={deleteChatMutation.isPending}
                onClick={() => setThreadToDelete(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[#1A1614]/15 dark:border-[#2A2522] text-sm font-medium text-[#1A1614] dark:text-[#E8E0D4] hover:bg-[#1A1614]/5 dark:hover:bg-[#1A1614]/30 disabled:opacity-40 transition-colors cursor-pointer"
              >
                No
              </button>
              <button
                type="button"
                disabled={deleteChatMutation.isPending}
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-40 transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-2"
              >
                {deleteChatMutation.isPending ? (
                  <>
                    <FiLoader className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Yes</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#FAFAFA] dark:bg-[#12100E] border-r border-[#1A1614]/5 dark:border-[#2A2522] transform transition-transform duration-300 flex flex-col ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0 lg:static"
          }`}
      >
        {/* Header (Logo & Close button) */}
        <div className="p-4 flex items-center justify-between">
          <Link href="/ask" className="flex items-center gap-2">
            <GoLaw className="w-6 h-6 text-[#1A1614] dark:text-[#E8E0D4]" />
            <span className="text-[#1A1614] dark:text-[#E8E0D4] font-heading text-xl font-normal italic">
              Rocky Legal
            </span>
          </Link>
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-2 text-[#5A5550] dark:text-[#8A8279] hover:bg-[#1A1614]/5 dark:hover:bg-[#1A1614]/30 rounded-lg cursor-pointer"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="px-4 pb-4">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-white dark:bg-[#1A1614]/30 border border-[#1A1614]/10 dark:border-[#2A2522] hover:border-[#C7A064] dark:hover:border-[#C7A064] rounded-xl text-[#1A1614] dark:text-[#E8E0D4] font-medium transition-colors shadow-xs cursor-pointer group"
          >
            <span className="flex items-center gap-2">
              <FiPlus className="w-5 h-5 text-[#C7A064]" />
              New Chat
            </span>
            <span className="text-[11px] text-[#5A5550] dark:text-[#8A8279] border border-[#1A1614]/10 dark:border-[#2A2522] px-1.5 py-0.5 rounded">
              Ctrl K
            </span>
          </button>
        </div>

        {/* Dynamic Chat History List */}
        <div className="flex-1 overflow-y-auto px-3 space-y-6">
          {isLoading ? (
            <div className="p-4 space-y-3">
              <div className="h-4 bg-[#1A1614]/5 dark:bg-[#2A2522] rounded w-20 animate-pulse" />
              <div className="h-8 bg-[#1A1614]/5 dark:bg-[#2A2522] rounded-lg animate-pulse" />
              <div className="h-8 bg-[#1A1614]/5 dark:bg-[#2A2522] rounded-lg animate-pulse" />
            </div>
          ) : groupedChats.length === 0 ? (
            <div className="text-center py-10 px-3 text-[#5A5550]/70 dark:text-[#8A8279]/70 text-xs">
              No chat history yet. Start a new legal research query!
            </div>
          ) : (
            groupedChats.map((group) => (
              <div key={group.title}>
                <h3 className="px-3 text-[11px] font-bold text-[#5A5550] dark:text-[#8A8279] uppercase tracking-wider mb-2">
                  {group.title}
                </h3>
                <div className="space-y-1">
                  {group.chats.map((chat) => {
                    const isActive = chat.threadId === activeThreadId;
                    const isDeletingThis =
                      deleteChatMutation.isPending &&
                      deleteChatMutation.variables === chat.threadId;

                    return (
                      <Link
                        key={chat._id || chat.threadId}
                        href={`/ask/c/${chat.threadId}`}
                        onClick={() => setIsOpen(false)}
                        className={`w-full text-left px-3 py-2 text-sm rounded-lg truncate transition-colors flex items-center justify-between gap-2 group cursor-pointer ${isActive
                            ? "bg-[#C7A064]/15 dark:bg-[#C7A064]/20 text-[#C7A064] font-medium"
                            : "text-[#1A1614] dark:text-[#E8E0D4] hover:bg-[#1A1614]/5 dark:hover:bg-[#1A1614]/30"
                          }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <FiMessageSquare
                            className={`w-4 h-4 shrink-0 ${isActive
                                ? "text-[#C7A064]"
                                : "text-[#5A5550] dark:text-[#8A8279]"
                              }`}
                          />
                          <span className="truncate">{chat.title || "New Chat"}</span>
                        </div>

                        {isDeletingThis ? (
                          <div className="p-1.5 text-[#C7A064] shrink-0" title="Deleting...">
                            <FiLoader className="w-3.5 h-3.5 animate-spin" />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => promptDeleteChat(e, chat.threadId)}
                            className="p-1.5 text-[#5A5550]/70 dark:text-[#8A8279]/70 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all shrink-0"
                            title="Delete chat"
                          >
                            <FiTrash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer (Profile & Settings Popover) */}
        <div ref={profileMenuRef} className="p-3 border-t border-[#1A1614]/5 dark:border-[#2A2522] relative">
          {/* Profile Dropdown Menu */}
          {isProfileMenuOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-2 bg-white dark:bg-[#181512] border border-[#1A1614]/10 dark:border-[#2A2522] rounded-2xl shadow-xl p-3 animate-fade-up z-50 space-y-3">
              {/* User Profile Header */}
              <div className="flex items-center gap-3 pb-3 border-b border-[#1A1614]/5 dark:border-[#2A2522]">
                {user?.image ? (
                  <Image
                    src={user.image}
                    alt={user.name || "User"}
                    width={40}
                    height={40}
                    className="rounded-full shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#C7A064]/20 text-[#C7A064] font-bold flex items-center justify-center shrink-0">
                    {userInitial}
                  </div>
                )}
                <div className="overflow-hidden flex-1">
                  <p className="text-sm font-bold text-[#1A1614] dark:text-[#E8E0D4] truncate">
                    {user?.name || "Advocate User"}
                  </p>
                  <p className="text-xs text-[#5A5550] dark:text-[#8A8279] truncate flex items-center gap-1 mt-0.5">
                    <FiMail className="w-3 h-3 shrink-0" /> {user?.email || "No email"}
                  </p>
                  {userMobile && (
                    <p className="text-xs text-[#5A5550] dark:text-[#8A8279] truncate flex items-center gap-1 mt-0.5">
                      <FiPhone className="w-3 h-3 shrink-0" /> {userMobile}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                >
                  <FiLogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}

          {/* Profile Bar Button */}
          <div
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="flex items-center justify-between p-2 hover:bg-[#1A1614]/5 dark:hover:bg-[#1A1614]/30 rounded-xl transition-colors cursor-pointer group/profile"
          >
            <div className="flex items-center gap-3 overflow-hidden">
              {user?.image ? (
                <Image
                  src={user.image}
                  alt={user.name || "User"}
                  width={36}
                  height={36}
                  className="rounded-full shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-linear-to-tr from-[#C7A064] to-[#E8D0A4] flex items-center justify-center text-white font-bold shrink-0 shadow-xs">
                  {userInitial}
                </div>
              )}
              <div className="truncate">
                <p className="text-sm font-semibold text-[#1A1614] dark:text-[#E8E0D4] truncate">
                  {user?.name || "Advocate User"}
                </p>
                <p className="text-xs text-[#5A5550] dark:text-[#8A8279] truncate">
                  Settings & Profile
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <div
                className={`p-2 rounded-lg transition-colors ${isProfileMenuOpen
                    ? "bg-[#1A1614]/10 dark:bg-[#1A1614]/50 text-[#C7A064]"
                    : "text-[#5A5550] dark:text-[#8A8279] hover:text-[#1A1614] dark:hover:text-[#E8E0D4]"
                  }`}
              >
                <FiSettings className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
