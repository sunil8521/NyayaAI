"use client";

import { useEffect, useRef } from "react";
import { FiX } from "react-icons/fi";
import { GoLaw } from "react-icons/go";
import { useUIStore } from "@/lib/store";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { SignInView, SignUpView, ForgotPasswordView, VerifyEmailView, PhoneSetupView } from "./auth/AuthViews";

export default function AuthModal() {
  const { isAuthModalOpen, authModalTab, closeAuthModal, openAuthModal, setAuthEmail } = useUIStore();
  const { data: session } = useSession();
  const router = useRouter();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Determine if we need to force the user to setup their phone number or verify email
  const isMissingMobile = session?.user && !(session.user as any).mobile;
  const isUnverifiedEmail = session?.user && !session.user.emailVerified;
  
  const isForcedModal = isMissingMobile || isUnverifiedEmail;

  // Set the global authEmail state when we detect an unverified session
  useEffect(() => {
    if (isUnverifiedEmail && session?.user?.email) {
      setAuthEmail(session.user.email);
    }
  }, [isUnverifiedEmail, session, setAuthEmail]);

  const handleClose = () => {
    closeAuthModal();
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("auth");
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.pathname + (url.search || ""));
    }
  };

  // Handle URL query parameters automatically mapping to the modal
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const authParam = params.get("auth");

    if ((authParam === "signin" || authParam === "signup") && !session?.user) {
      openAuthModal(authParam as "signin" | "signup");
    }
  }, [session, openAuthModal]);

  // If the user logs in and their profile is complete (and verified), redirect to /ask
  useEffect(() => {
    if (isAuthModalOpen && session?.user && !isForcedModal) {
      closeAuthModal();
      router.push("/ask");
    }
  }, [session, isAuthModalOpen, closeAuthModal, router, isForcedModal]);

  // Escape key handler
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isForcedModal) handleClose();
    };
    if (isAuthModalOpen || isForcedModal) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [isAuthModalOpen, isForcedModal]);

  // Only render if the modal is supposed to be open or we have a forced view
  if (!isAuthModalOpen && !isForcedModal) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={(e) => e.target === overlayRef.current && !isForcedModal && handleClose()}
    >
      <div className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm animate-fade-in" />

      <div className="relative bg-white dark:bg-[#141210] rounded-2xl shadow-2xl w-full max-w-md animate-fade-up overflow-hidden border border-[#1A1614]/10 dark:border-[#2A2522]">
        <img
          src="/para.png"
          alt=""
          className="absolute -bottom-4 -right-4 w-28 h-28 object-contain opacity-[0.15] dark:opacity-10 dark:invert dark:brightness-50 pointer-events-none"
        />

        <div className="max-h-[90vh] overflow-y-auto overflow-x-hidden">
          {!isMissingMobile && (
            <button
              type="button"
              onClick={handleClose}
              className="absolute top-4 right-4 md:top-5 md:right-5 text-[#5A5550] dark:text-[#8A8279] hover:text-[#1A1614] dark:hover:text-[#E8E0D4] transition-colors z-10 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              aria-label="Close modal"
            >
              <FiX className="w-5 h-5" />
            </button>
          )}

          <div className="px-6 py-6 md:px-8 md:pt-8 md:pb-8">
            <div className="flex items-center gap-2 mb-6">
              <GoLaw className="w-6 h-6 text-[#1A1614] dark:text-[#E8E0D4]" />
              <span className="text-[#1A1614] dark:text-[#E8E0D4] font-heading text-xl font-normal italic">
                Rocky Legal
              </span>
            </div>

            {/* Modular Views managed by global Zustand State */}
            {isMissingMobile ? (
              <PhoneSetupView />
            ) : isUnverifiedEmail ? (
              <VerifyEmailView />
            ) : authModalTab === "forgot-password" ? (
              <ForgotPasswordView />
            ) : authModalTab === "verify-email-otp" ? (
              <VerifyEmailView />
            ) : authModalTab === "signup" ? (
              <SignUpView />
            ) : (
              <SignInView />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
