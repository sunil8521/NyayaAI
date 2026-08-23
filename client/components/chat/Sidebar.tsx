"use client";

import { useState, useRef, useEffect } from "react";
import {
  FiMessageSquare,
  FiPlus,
  FiX,
  FiSettings,
  FiLogOut,
  FiUser,
  FiPhone,
  FiMail,
} from "react-icons/fi";
import { GoLaw } from "react-icons/go";
import Link from "next/link";
import { useSession, signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const dummyHistory = [
  { id: 1, title: "Drafting Bail Application for Section 439", date: "Today" },
  { id: 2, title: "Precedents on Triple Talaq", date: "Yesterday" },
  { id: 3, title: "Contract Breach Damages Clause", date: "Previous 7 Days" },
  { id: 4, title: "Consumer Protection Act 2019 Summary", date: "Previous 7 Days" },
  { id: 5, title: "Latest Supreme Court Guidelines on Arrest", date: "Previous 30 Days" },
];

export default function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

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

  const handleLogout = async () => {
    await signOut();
    router.push("/");
    router.refresh();
  };

  const user = session?.user;
  const userInitial = user?.name ? user.name[0].toUpperCase() : "A";
  const userMobile = (user as any)?.mobile;

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#FAFAFA] dark:bg-[#12100E] border-r border-[#1A1614]/5 dark:border-[#2A2522] transform transition-transform duration-300 flex flex-col ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0 lg:static"
        }`}
      >
        {/* Header (Logo & New Chat) */}
        <div className="p-4 flex items-center justify-between">
          <Link href="/ask" className="flex items-center gap-2">
            <GoLaw className="w-6 h-6 text-[#1A1614] dark:text-[#E8E0D4]" />
            <span className="text-[#1A1614] dark:text-[#E8E0D4] font-heading text-xl font-normal italic">
              Rocky Legal
            </span>
            
          </Link>
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-2 text-[#5A5550] dark:text-[#8A8279] hover:bg-[#1A1614]/5 dark:hover:bg-[#1A1614]/30 rounded-lg"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="px-4 pb-4">
          <button className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-white dark:bg-[#1A1614]/30 border border-[#1A1614]/10 dark:border-[#2A2522] hover:border-[#C7A064] dark:hover:border-[#C7A064] rounded-xl text-[#1A1614] dark:text-[#E8E0D4] font-medium transition-colors shadow-sm cursor-pointer">
            <span className="flex items-center gap-2">
              <FiPlus className="w-5 h-5" />
              New Chat
            </span>
            <span className="text-xs text-[#5A5550] dark:text-[#8A8279] border border-[#1A1614]/10 dark:border-[#2A2522] px-1.5 py-0.5 rounded">
              Ctrl K
            </span>
          </button>
        </div>

        {/* Chat History List */}
        <div className="flex-1 overflow-y-auto px-3 space-y-6">
          {/* Group: Today */}
          <div>
            <h3 className="px-3 text-xs font-semibold text-[#5A5550] dark:text-[#8A8279] uppercase tracking-wider mb-2">
              Today
            </h3>
            <div className="space-y-1">
              {dummyHistory
                .filter((h) => h.date === "Today")
                .map((chat) => (
                  <button
                    key={chat.id}
                    className="w-full text-left px-3 py-2 text-sm text-[#1A1614] dark:text-[#E8E0D4] hover:bg-[#1A1614]/5 dark:hover:bg-[#1A1614]/30 rounded-lg truncate transition-colors flex items-center gap-3 cursor-pointer"
                  >
                    <FiMessageSquare className="w-4 h-4 shrink-0 text-[#5A5550] dark:text-[#8A8279]" />
                    <span className="truncate">{chat.title}</span>
                  </button>
                ))}
            </div>
          </div>

          {/* Group: Yesterday */}
          <div>
            <h3 className="px-3 text-xs font-semibold text-[#5A5550] dark:text-[#8A8279] uppercase tracking-wider mb-2">
              Yesterday
            </h3>
            <div className="space-y-1">
              {dummyHistory
                .filter((h) => h.date === "Yesterday")
                .map((chat) => (
                  <button
                    key={chat.id}
                    className="w-full text-left px-3 py-2 text-sm text-[#1A1614] dark:text-[#E8E0D4] hover:bg-[#1A1614]/5 dark:hover:bg-[#1A1614]/30 rounded-lg truncate transition-colors flex items-center gap-3 cursor-pointer"
                  >
                    <FiMessageSquare className="w-4 h-4 shrink-0 text-[#5A5550] dark:text-[#8A8279]" />
                    <span className="truncate">{chat.title}</span>
                  </button>
                ))}
            </div>
          </div>

          {/* Group: Previous 7 Days */}
          <div>
            <h3 className="px-3 text-xs font-semibold text-[#5A5550] dark:text-[#8A8279] uppercase tracking-wider mb-2">
              Previous 7 Days
            </h3>
            <div className="space-y-1">
              {dummyHistory
                .filter((h) => h.date === "Previous 7 Days")
                .map((chat) => (
                  <button
                    key={chat.id}
                    className="w-full text-left px-3 py-2 text-sm text-[#5A5550] dark:text-[#8A8279] hover:bg-[#1A1614]/5 dark:hover:bg-[#1A1614]/30 rounded-lg truncate transition-colors flex items-center gap-3 cursor-pointer"
                  >
                    <FiMessageSquare className="w-4 h-4 shrink-0" />
                    <span className="truncate">{chat.title}</span>
                  </button>
                ))}
            </div>
          </div>
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
                <div className="w-9 h-9 rounded-full bg-linear-to-tr from-[#C7A064] to-[#E8D0A4] flex items-center justify-center text-white font-bold shrink-0 shadow-sm">
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
                className={`p-2 rounded-lg transition-colors ${
                  isProfileMenuOpen
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
