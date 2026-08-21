"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/lib/store";
import { useEffect, useState } from "react";
import { FiMenu, FiX, FiLogOut, FiUser } from "react-icons/fi";
import { ModeToggle } from "@/components/mode-toggle";
import { GoLaw } from "react-icons/go";
import { useSession, signOut } from "@/lib/auth-client";
import Image from "next/image";

export default function Navbar() {
  const {
    isMobileMenuOpen,
    toggleMobileMenu,
    closeMobileMenu,
    activeNav,
    setActiveNav,
    openAuthModal,
  } = useUIStore();
  const { data: session } = useSession();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleAskAIClick = (e: React.MouseEvent) => {
    if (!session?.user) {
      e.preventDefault();
      openAuthModal("signin");
    } else {
      setActiveNav("Ask AI");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-[#FAFAFA]/90 dark:bg-[#0C0A09]/90 backdrop-blur-md shadow-sm dark:shadow-white/5 border-b border-[#1A1614]/5 dark:border-white/5"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 transition-all">
          {/* Logo */}
          <Link
            href="/"
            className="shrink-0 flex items-center gap-2"
            onClick={() => setActiveNav("Home")}
          >
            <GoLaw className="w-8 h-8 text-[#1A1614] dark:text-[#E8E0D4]" />
            <span className="text-[#1A1614] dark:text-[#E8E0D4] font-heading text-3xl font-normal italic">
              NyayaAI
            </span>
            <span className="text-[#C7A064] ml-1 text-xl">✦</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-10">
            <Link
              href="/ask"
              onClick={handleAskAIClick}
              className={`relative py-1 text-base font-semibold tracking-wide transition-colors duration-300 group ${
                activeNav === "Ask AI"
                  ? "text-[#C7A064]"
                  : "text-[#5A5550] dark:text-[#8A8279] hover:text-[#1A1614] dark:hover:text-[#E8E0D4]"
              }`}
            >
              <span>Ask AI</span>
              <span
                className={`absolute -bottom-1 left-0 h-0.5 bg-[#C7A064] rounded-full transition-all duration-300 ${
                  activeNav === "Ask AI" ? "w-full" : "w-0 group-hover:w-full"
                }`}
              />
            </Link>

            <Link
              href="#about"
              onClick={() => setActiveNav("About")}
              className={`relative py-1 text-base font-semibold tracking-wide transition-colors duration-300 group ${
                activeNav === "About"
                  ? "text-[#C7A064]"
                  : "text-[#5A5550] dark:text-[#8A8279] hover:text-[#1A1614] dark:hover:text-[#E8E0D4]"
              }`}
            >
              <span>About</span>
              <span
                className={`absolute -bottom-1 left-0 h-0.5 bg-[#C7A064] rounded-full transition-all duration-300 ${
                  activeNav === "About" ? "w-full" : "w-0 group-hover:w-full"
                }`}
              />
            </Link>

            <Link
              href="#features"
              onClick={() => setActiveNav("Features")}
              className={`relative py-1 text-base font-semibold tracking-wide transition-colors duration-300 group ${
                activeNav === "Features"
                  ? "text-[#C7A064]"
                  : "text-[#5A5550] dark:text-[#8A8279] hover:text-[#1A1614] dark:hover:text-[#E8E0D4]"
              }`}
            >
              <span>Features</span>
              <span
                className={`absolute -bottom-1 left-0 h-0.5 bg-[#C7A064] rounded-full transition-all duration-300 ${
                  activeNav === "Features" ? "w-full" : "w-0 group-hover:w-full"
                }`}
              />
            </Link>

            {/* Auth Buttons */}
            {session?.user ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1A1614]/5 dark:bg-white/5 border border-[#1A1614]/10 dark:border-white/10">
                  {session.user.image ? (
                    <Image
                      src={session.user.image}
                      alt={session.user.name || "User"}
                      width={28}
                      height={28}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-[#C7A064]/20 text-[#C7A064] flex items-center justify-center font-bold text-xs">
                      {session.user.name ? session.user.name[0].toUpperCase() : <FiUser className="w-3.5 h-3.5" />}
                    </div>
                  )}
                  <span className="text-sm font-medium text-[#1A1614] dark:text-[#E8E0D4] max-w-[120px] truncate">
                    {session.user.name || session.user.email}
                  </span>
                </div>

                <button
                  onClick={handleSignOut}
                  title="Sign out"
                  className="p-2.5 rounded-full hover:bg-red-500/10 text-[#5A5550] hover:text-red-600 transition-colors"
                >
                  <FiLogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => openAuthModal("signup")}
                className="px-7 py-2.5 text-base font-semibold rounded-full bg-white dark:bg-[#12100E] text-[#1A1614] dark:text-[#E8E0D4] border border-[#C7A064] shadow-[0_0_0_0_#C7A064] hover:-translate-y-1 hover:-translate-x-0.5 hover:shadow-[2px_5px_0_0_#C7A064] active:translate-y-0.5 active:translate-x-0.5 active:shadow-[0_0_0_0_#C7A064] transition-all duration-300 ease-in-out cursor-pointer"
              >
                Get Started
              </button>
            )}

            <div className="pl-4 border-l border-[#1A1614]/10 dark:border-[#2A2522]">
              <ModeToggle />
            </div>
          </nav>

          {/* Mobile Toggle Button */}
          <div className="flex items-center gap-3 lg:hidden">
            <ModeToggle />
            <button
              className="text-[#1A1614] dark:text-[#E8E0D4] p-2 rounded-xl hover:bg-[#1A1614]/5 dark:hover:bg-white/5 transition-colors duration-200 cursor-pointer"
              onClick={toggleMobileMenu}
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? (
                <FiX className="w-6 h-6 text-[#C7A064]" />
              ) : (
                <FiMenu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Slide-down Navigation Menu */}
      <div
        className={`lg:hidden bg-[#FAFAFA]/95 dark:bg-[#0C0A09]/95 backdrop-blur-md border-b border-[#1A1614]/10 dark:border-[#2A2522] absolute top-full left-0 w-full shadow-2xl transition-all duration-300 ease-in-out transform origin-top ${
          isMobileMenuOpen
            ? "max-h-[500px] opacity-100 translate-y-0 visible"
            : "max-h-0 opacity-0 -translate-y-2 invisible overflow-hidden"
        }`}
      >
        <div className="px-6 py-5 space-y-2 border-t border-[#1A1614]/5 dark:border-white/5">
          <Link
            href="/ask"
            onClick={(e) => {
              closeMobileMenu();
              handleAskAIClick(e);
            }}
            className="block py-3 text-[#1A1614]/80 dark:text-[#E8E0D4]/80 text-base hover:text-[#C7A064] dark:hover:text-[#C7A064] font-medium transition-colors"
          >
            Ask AI
          </Link>
          <Link
            href="#about"
            onClick={() => {
              setActiveNav("About");
              closeMobileMenu();
            }}
            className="block py-3 text-[#1A1614]/80 dark:text-[#E8E0D4]/80 text-base hover:text-[#C7A064] dark:hover:text-[#C7A064] font-medium transition-colors"
          >
            About
          </Link>
          <Link
            href="#features"
            onClick={() => {
              setActiveNav("Features");
              closeMobileMenu();
            }}
            className="block py-3 text-[#1A1614]/80 dark:text-[#E8E0D4]/80 text-base hover:text-[#C7A064] dark:hover:text-[#C7A064] font-medium transition-colors"
          >
            Features
          </Link>

          {session?.user ? (
            <div className="pt-4 mt-2 border-t border-[#1A1614]/10 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#C7A064]/20 text-[#C7A064] flex items-center justify-center font-bold text-xs">
                  {session.user.name ? session.user.name[0].toUpperCase() : <FiUser className="w-4 h-4" />}
                </div>
                <span className="text-sm font-medium text-[#1A1614] dark:text-[#E8E0D4]">
                  {session.user.name || session.user.email}
                </span>
              </div>
              <button
                onClick={handleSignOut}
                className="px-3.5 py-1.5 text-xs text-red-500 font-semibold border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-colors"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                openAuthModal("signup");
                closeMobileMenu();
              }}
              className="block w-full mt-4 px-5 py-3 rounded-xl bg-white dark:bg-[#12100E] text-[#1A1614] dark:text-[#E8E0D4] border border-[#C7A064] shadow-[0_0_0_0_#C7A064] hover:-translate-y-1 hover:-translate-x-0.5 hover:shadow-[2px_5px_0_0_#C7A064] active:translate-y-0.5 active:translate-x-0.5 active:shadow-[0_0_0_0_#C7A064] text-center text-base font-semibold transition-all duration-300 ease-in-out cursor-pointer"
            >
              Get Started
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
