"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import {
  FiX,
  FiArrowRight,
  FiEye,
  FiEyeOff,
  FiPhone,
  FiLoader,
  FiUser,
  FiCheckCircle,
  FiMail,
} from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";
import { GoLaw } from "react-icons/go";
import { useUIStore } from "@/lib/store";
import { signIn, signUp, useSession, updateUser, authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface AuthFormData {
  fullName?: string;
  email: string;
  mobile?: string;
  password: string;
}

interface ForgotPasswordFormData {
  email: string;
}

const ERROR_MAP: Record<string, string> = {
  state_mismatch: "Sign-in session expired or mismatch. Please try signing in again.",
  state_security_mismatch: "Security verification mismatch. Please try signing in again.",
  state_invalid: "Authentication state was invalid or corrupted. Please try again.",
  state_generation_error: "Unable to create authentication session. Please try again.",
  request_expired: "Sign-in request expired. Please sign in again.",
  access_denied: "Google sign-in was cancelled.",
  cancelled: "Google sign-in was cancelled.",
};

// Reusable clean Form Field
function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-[#5A5550] dark:text-[#8A8279] mb-1.5">
        {label}
      </label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

// Reusable Submit Button
function SubmitButton({
  isSubmitting,
  text,
  loadingText,
}: {
  isSubmitting: boolean;
  text: string;
  loadingText: string;
}) {
  return (
    <button
      type="submit"
      disabled={isSubmitting}
      className="btn-3d w-full py-3.5 px-6 rounded-xl font-medium text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
    >
      {isSubmitting ? (
        <>
          <FiLoader className="w-4 h-4 animate-spin" />
          <span>{loadingText}</span>
        </>
      ) : (
        <>
          <span>{text}</span>
          <FiArrowRight className="w-4 h-4" />
        </>
      )}
    </button>
  );
}

export default function AuthModal() {
  const { isAuthModalOpen, authModalTab, closeAuthModal, setAuthModalTab, openAuthModal } = useUIStore();
  const { data: session } = useSession();
  const router = useRouter();
  const overlayRef = useRef<HTMLDivElement>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isUpdatingPhone, setIsUpdatingPhone] = useState(false);
  const [isPhoneCompleted, setIsPhoneCompleted] = useState(false);

  // Forms
  const {
    register: registerAuth,
    handleSubmit: handleAuthSubmit,
    reset: resetAuth,
    formState: { isSubmitting: isAuthSubmitting, errors: authErrors },
  } = useForm<AuthFormData>();

  const {
    register: registerForgot,
    handleSubmit: handleForgotSubmit,
    reset: resetForgot,
    formState: { isSubmitting: isForgotSubmitting, errors: forgotErrors },
  } = useForm<ForgotPasswordFormData>();

  const handleClose = () => {
    closeAuthModal();
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("auth");
      url.searchParams.delete("error");
      const newQuery = url.search ? url.search : "";
      window.history.replaceState({}, "", url.pathname + newQuery);
    }
  };

  // Reset states on tab change
  useEffect(() => {
    setAuthError(null);
    setForgotSuccess(null);
    resetAuth();
    resetForgot();
  }, [authModalTab, resetAuth, resetForgot]);

  // URL query params handling
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const authParam = params.get("auth");
    const errorParam = params.get("error");

    if (errorParam) {
      setAuthError(ERROR_MAP[errorParam] || `Sign-in error: ${errorParam.replace(/_/g, " ")}. Please try again.`);
      openAuthModal("signin");
    } else if ((authParam === "signin" || authParam === "signup") && !session?.user) {
      openAuthModal(authParam as "signin" | "signup");
    }
  }, [session, openAuthModal]);

  // Escape key listener
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    if (isAuthModalOpen) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [isAuthModalOpen]);

  // ONLY render when user explicitly clicked login/signup
  if (!isAuthModalOpen) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");

  const isMissingMobile = !isPhoneCompleted && Boolean(session?.user && !(session.user as any).mobile);

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signIn.social({
        provider: "google",
        callbackURL: `${origin}/ask`,
        errorCallbackURL: `${origin}/?auth=signin&error=cancelled`,
      });
    } catch (err: any) {
      setAuthError(err?.message || "Google sign-in failed. Please try again.");
    }
  };

  const onAuthSubmit = async (data: AuthFormData) => {
    setAuthError(null);
    try {
      if (authModalTab === "signin") {
        const res = await signIn.email({ email: data.email, password: data.password, callbackURL: `${origin}/ask` });
        if (res?.error) setAuthError(res.error.message || "Invalid email or password");
        else {
          handleClose();
          router.push("/ask");
        }
      } else {
        const res = await signUp.email({
          email: data.email,
          password: data.password,
          name: data.fullName || "",
          fullName: data.fullName || "",
          mobile: data.mobile ? `+91${data.mobile}` : undefined,
          callbackURL: `${origin}/ask`,
        } as any);

        if (res?.error) {
          const msg = (res.error.message || "").toLowerCase();
          if (
            msg.includes("already exists") ||
            msg.includes("already in use") ||
            (res.error as any).code === "USER_ALREADY_EXISTS" ||
            res.error.status === 422
          ) {
            setAuthError("An account with this email already exists. Please sign in instead.");
          } else {
            setAuthError(res.error.message || "Failed to create account. Please try again.");
          }
        } else {
          handleClose();
          router.push("/ask");
        }
      }
    } catch (err: any) {
      setAuthError(err?.message || "An unexpected error occurred.");
    }
  };

  const onForgotSubmit = async (data: ForgotPasswordFormData) => {
    setAuthError(null);
    setForgotSuccess(null);
    try {
      if (typeof (authClient as any).forgetPassword === "function") {
        await (authClient as any).forgetPassword({
          email: data.email,
          redirectTo: `${origin}/?auth=reset-password`,
        });
      }
      setForgotSuccess(`We have sent a password reset link to ${data.email}. Please check your inbox.`);
    } catch (err: any) {
      setAuthError(err?.message || "Failed to send reset link. Please try again.");
    }
  };

  const handleSavePhoneNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber || phoneNumber.length < 10) {
      setAuthError("Please enter a valid 10-digit mobile number");
      return;
    }

    setIsUpdatingPhone(true);
    setAuthError(null);
    const formattedMobile = `+91${phoneNumber.trim()}`;

    try {
      const res = await fetch("/api/users/mobile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: formattedMobile }),
      });

      if (!res.ok) {
        await updateUser({ mobile: formattedMobile } as any);
      }

      setIsPhoneCompleted(true);
      handleClose();
      window.location.href = "/ask";
    } catch (err: any) {
      setAuthError(err?.message || "Failed to save phone number. Please try again.");
    } finally {
      setIsUpdatingPhone(false);
    }
  };

  const inputClass =
    "w-full px-4 py-3 rounded-xl border border-[#1A1614]/10 dark:border-[#2A2522] bg-[#FAFAFA] dark:bg-[#1A1614]/30 text-[#1A1614] dark:text-[#E8E0D4] text-sm focus:outline-none focus:ring-2 focus:ring-[#C7A064]/40 transition-all placeholder:text-[#5A5550]/50";

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={(e) => e.target === overlayRef.current && handleClose()}
    >
      <div className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm animate-fade-in" />

      <div className="relative bg-white dark:bg-[#141210] rounded-2xl shadow-2xl w-full max-w-md animate-fade-up overflow-hidden border border-[#1A1614]/10 dark:border-[#2A2522]">
        <img
          src="/para.png"
          alt=""
          className="absolute -bottom-4 -right-4 w-28 h-28 object-contain opacity-[0.15] dark:opacity-10 dark:invert dark:brightness-50 pointer-events-none"
        />

        <div className="max-h-[90vh] overflow-y-auto overflow-x-hidden">
          {/* Close button is ALWAYS visible */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 md:top-5 md:right-5 text-[#5A5550] dark:text-[#8A8279] hover:text-[#1A1614] dark:hover:text-[#E8E0D4] transition-colors z-10 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            aria-label="Close modal"
          >
            <FiX className="w-5 h-5" />
          </button>

          <div className="px-6 py-6 md:px-8 md:pt-8 md:pb-8">
            {/* Header Brand */}
            <div className="flex items-center gap-2 mb-6">
              <GoLaw className="w-6 h-6 text-[#1A1614] dark:text-[#E8E0D4]" />
              <span className="text-[#1A1614] dark:text-[#E8E0D4] font-heading text-xl font-normal italic">
                NyayaAI
              </span>
              <span className="text-[#C7A064] text-sm">✦</span>
            </div>

            {/* Error Banner */}
            {authError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs rounded-xl animate-fade-in">
                {authError}
              </div>
            )}

            {/* ═══════════════════ GOOGLE LOGGED IN: PHONE SETUP ═══════════════════ */}
            {isMissingMobile && session?.user ? (
              <div className="space-y-6 animate-tab-swap">
                <div className="flex items-center gap-3 p-3 bg-[#FAFAFA] dark:bg-[#1A1614]/40 rounded-xl border border-[#1A1614]/10 dark:border-[#2A2522]">
                  {session.user.image ? (
                    <Image
                      src={session.user.image}
                      alt={session.user.name || "User"}
                      width={40}
                      height={40}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#C7A064]/20 text-[#C7A064] flex items-center justify-center font-bold">
                      {session.user.name ? session.user.name[0].toUpperCase() : <FiUser />}
                    </div>
                  )}
                  <div className="overflow-hidden">
                    <p className="text-xs text-[#5A5550] dark:text-[#8A8279] flex items-center gap-1">
                      <FiCheckCircle className="text-green-500 w-3.5 h-3.5" /> Google account linked
                    </p>
                    <p className="text-sm font-bold text-[#1A1614] dark:text-[#E8E0D4] truncate">
                      {session.user.name}
                    </p>
                  </div>
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-[#1A1614] dark:text-[#E8E0D4]">
                    One last <span className="font-heading font-normal italic text-[#C7A064]">step</span>
                  </h2>
                  <p className="text-[#5A5550] dark:text-[#8A8279] text-sm mt-1">
                    Enter your mobile number to complete your profile.
                  </p>
                </div>

                <form onSubmit={handleSavePhoneNumber} className="space-y-4">
                  <FormField label="Mobile Number">
                    <div className="flex gap-2">
                      <div className="flex items-center gap-2 px-3 py-3 rounded-xl border border-[#1A1614]/10 dark:border-[#2A2522] bg-[#FAFAFA] dark:bg-[#1A1614]/30 text-sm text-[#1A1614] dark:text-[#E8E0D4] shrink-0">
                        <span>🇮🇳</span>
                        <span className="font-semibold">+91</span>
                      </div>
                      <div className="relative flex-1">
                        <FiPhone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5550]/50" />
                        <input
                          type="tel"
                          required
                          autoFocus
                          maxLength={10}
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                          placeholder="98765 43210"
                          className={`${inputClass} pl-10`}
                        />
                      </div>
                    </div>
                  </FormField>

                  <button
                    type="submit"
                    disabled={isUpdatingPhone || phoneNumber.length < 10}
                    className="btn-3d w-full py-3.5 px-6 rounded-xl font-medium text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
                  >
                    {isUpdatingPhone ? (
                      <>
                        <FiLoader className="w-4 h-4 animate-spin" />
                        <span>Saving profile...</span>
                      </>
                    ) : (
                      <>
                        <span>Complete Setup</span>
                        <FiArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsPhoneCompleted(true);
                      handleClose();
                      router.push("/ask");
                    }}
                    className="w-full text-center text-xs text-[#5A5550] dark:text-[#8A8279] hover:text-[#C7A064] transition-colors py-2 cursor-pointer"
                  >
                    Skip for now →
                  </button>
                </form>
              </div>
            ) : authModalTab === "forgot-password" ? (
              /* ═══════════════════ FORGOT PASSWORD TAB ═══════════════════ */
              <div className="space-y-6 animate-tab-swap">
                <div>
                  <h2 className="text-2xl font-bold text-[#1A1614] dark:text-[#E8E0D4]">
                    Reset <span className="font-heading font-normal italic text-[#C7A064]">Password</span>
                  </h2>
                  <p className="text-[#5A5550] dark:text-[#8A8279] text-sm mt-1">
                    Enter your email to receive a password reset link.
                  </p>
                </div>

                {forgotSuccess ? (
                  <div className="p-4 bg-[#C7A064]/10 border border-[#C7A064]/20 rounded-xl text-center space-y-3 animate-fade-in">
                    <FiCheckCircle className="w-8 h-8 text-[#C7A064] mx-auto" />
                    <p className="text-sm text-[#1A1614] dark:text-[#E8E0D4]">{forgotSuccess}</p>
                    <button
                      type="button"
                      onClick={() => setAuthModalTab("signin")}
                      className="text-xs text-[#C7A064] hover:underline font-semibold cursor-pointer"
                    >
                      Back to Sign In
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotSubmit(onForgotSubmit)} className="space-y-4">
                    <FormField label="Email Address" error={forgotErrors.email?.message}>
                      <div className="relative">
                        <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5550]/50" />
                        <input
                          type="email"
                          placeholder="advocate@nyayaai.in"
                          className={`${inputClass} pl-10`}
                          {...registerForgot("email", {
                            required: "Email is required",
                            pattern: {
                              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                              message: "Invalid email address",
                            },
                          })}
                        />
                      </div>
                    </FormField>

                    <SubmitButton
                      isSubmitting={isForgotSubmitting}
                      text="Send Reset Link"
                      loadingText="Sending Link..."
                    />

                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={() => setAuthModalTab("signin")}
                        className="text-xs text-[#5A5550] dark:text-[#8A8279] hover:text-[#C7A064] transition-colors cursor-pointer"
                      >
                        ← Back to Sign In
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              /* ═══════════════════ SIGN IN / SIGN UP TABS ═══════════════════ */
              <div className="space-y-6 animate-tab-swap">
                <div>
                  <h2 className="text-2xl font-bold text-[#1A1614] dark:text-[#E8E0D4]">
                    {authModalTab === "signin" ? "Welcome" : "Create"}{" "}
                    <span className="font-heading font-normal italic text-[#C7A064]">
                      {authModalTab === "signin" ? "back" : "account"}
                    </span>
                  </h2>
                  <p className="text-[#5A5550] dark:text-[#8A8279] text-sm mt-1">
                    {authModalTab === "signin"
                      ? "Access your saved legal research & citations"
                      : "Start researching Indian law for free"}
                  </p>
                </div>

                {/* Google Sign-In Button */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-[#1A1614]/10 dark:border-[#2A2522] bg-[#FAFAFA] dark:bg-[#1A1614]/30 hover:bg-black/5 dark:hover:bg-white/5 transition-all text-[#1A1614] dark:text-[#E8E0D4] font-medium text-sm cursor-pointer shadow-sm"
                >
                  <FcGoogle className="w-5 h-5" />
                  <span>Continue with Google</span>
                </button>

                {/* Divider */}
                <div className="relative flex items-center justify-center">
                  <div className="border-t border-[#1A1614]/10 dark:border-[#2A2522] w-full" />
                  <span className="bg-white dark:bg-[#141210] px-3 text-xs uppercase text-[#5A5550] dark:text-[#8A8279] font-semibold tracking-wider relative">
                    or
                  </span>
                </div>

                {/* Email / Password Form */}
                <form onSubmit={handleAuthSubmit(onAuthSubmit)} className="space-y-4">
                  {authModalTab === "signup" && (
                    <FormField label="Full Name" error={authErrors.fullName?.message}>
                      <div className="relative">
                        <FiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5550]/50" />
                        <input
                          type="text"
                          placeholder="Adv. Rajesh Sharma"
                          className={`${inputClass} pl-10`}
                          {...registerAuth("fullName", { required: "Full name is required" })}
                        />
                      </div>
                    </FormField>
                  )}

                  <FormField label="Email Address" error={authErrors.email?.message}>
                    <div className="relative">
                      <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5550]/50" />
                      <input
                        type="email"
                        placeholder="advocate@nyayaai.in"
                        className={`${inputClass} pl-10`}
                        {...registerAuth("email", {
                          required: "Email is required",
                          pattern: {
                            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                            message: "Invalid email address",
                          },
                        })}
                      />
                    </div>
                  </FormField>

                  {authModalTab === "signup" && (
                    <FormField label="Mobile Number" error={authErrors.mobile?.message}>
                      <div className="flex gap-2">
                        <div className="flex items-center gap-2 px-3 py-3 rounded-xl border border-[#1A1614]/10 dark:border-[#2A2522] bg-[#FAFAFA] dark:bg-[#1A1614]/30 text-sm text-[#1A1614] dark:text-[#E8E0D4] shrink-0">
                          <span>🇮🇳</span>
                          <span className="font-semibold">+91</span>
                        </div>
                        <div className="relative flex-1">
                          <FiPhone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5550]/50" />
                          <input
                            type="tel"
                            maxLength={10}
                            placeholder="98765 43210"
                            className={`${inputClass} pl-10`}
                            {...registerAuth("mobile", {
                              required: "Mobile number is required",
                              pattern: {
                                value: /^[6-9]\d{9}$/,
                                message: "Enter a valid 10-digit Indian mobile number",
                              },
                            })}
                          />
                        </div>
                      </div>
                    </FormField>
                  )}

                  <FormField label="Password" error={authErrors.password?.message}>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className={`${inputClass} pr-10`}
                        {...registerAuth("password", {
                          required: "Password is required",
                          minLength: { value: 8, message: "Password must be at least 8 characters" },
                        })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A5550] hover:text-[#1A1614] dark:hover:text-[#E8E0D4] p-1 cursor-pointer"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                      </button>
                    </div>
                  </FormField>

                  {authModalTab === "signin" && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setAuthModalTab("forgot-password")}
                        className="text-xs text-[#C7A064] hover:underline font-medium cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}

                  <SubmitButton
                    isSubmitting={isAuthSubmitting}
                    text={authModalTab === "signin" ? "Sign In" : "Create Free Account"}
                    loadingText={authModalTab === "signin" ? "Signing In..." : "Creating Account..."}
                  />
                </form>

                {/* Tab Switch Footer */}
                <div className="text-center pt-2 text-xs text-[#5A5550] dark:text-[#8A8279]">
                  {authModalTab === "signin" ? (
                    <p>
                      Don&apos;t have an account?{" "}
                      <button
                        type="button"
                        onClick={() => setAuthModalTab("signup")}
                        className="text-[#C7A064] font-semibold hover:underline cursor-pointer ml-1"
                      >
                        Sign Up Free
                      </button>
                    </p>
                  ) : (
                    <p>
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => setAuthModalTab("signin")}
                        className="text-[#C7A064] font-semibold hover:underline cursor-pointer ml-1"
                      >
                        Sign In
                      </button>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
