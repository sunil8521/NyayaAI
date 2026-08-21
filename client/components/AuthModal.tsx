"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, FieldErrors, UseFormRegisterReturn } from "react-hook-form";
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
      <label className="block text-xs font-semibold text-[#1A1614] dark:text-[#E8E0D4] mb-1.5 uppercase tracking-wider">
        {label}
      </label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

// Reusable submit button
function SubmitButton({
  isSubmitting,
  text,
  icon = <FiArrowRight className="w-4 h-4" />,
}: {
  isSubmitting: boolean;
  text: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={isSubmitting}
      className="w-full py-3.5 mt-2 bg-[#1A1614] dark:bg-[#C7A064] hover:bg-[#2A2522] dark:hover:bg-[#D4B078] text-white dark:text-[#1A1614] font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60 cursor-pointer shadow-xs"
    >
      {isSubmitting ? (
        <FiLoader className="w-4 h-4 animate-spin" />
      ) : (
        <>
          {text} {icon}
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

  const isMissingMobile = !isPhoneCompleted && session?.user && !(session.user as any).mobile;

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

  // Redirect if logged in with complete profile
  useEffect(() => {
    if (isAuthModalOpen && session?.user && (session.user as any).mobile) {
      closeAuthModal();
      router.push("/ask");
    }
  }, [session, isAuthModalOpen, closeAuthModal, router]);

  // Escape key listener
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isMissingMobile) closeAuthModal();
    };
    if (isAuthModalOpen || isMissingMobile) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [isAuthModalOpen, isMissingMobile, closeAuthModal]);

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

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
          closeAuthModal();
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
          closeAuthModal();
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
      closeAuthModal();
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
      onClick={(e) => e.target === overlayRef.current && !isMissingMobile && closeAuthModal()}
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
              onClick={closeAuthModal}
              className="absolute top-4 right-4 md:top-5 md:right-5 text-[#5A5550] dark:text-[#8A8279] hover:text-[#1A1614] dark:hover:text-[#E8E0D4] transition-colors z-10 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              aria-label="Close modal"
            >
              <FiX className="w-5 h-5" />
            </button>
          )}

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
            {isMissingMobile ? (
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
                          placeholder="9876543210"
                          className={`${inputClass} pl-10`}
                        />
                      </div>
                    </div>
                  </FormField>

                  <SubmitButton isSubmitting={isUpdatingPhone || phoneNumber.length < 10} text="Continue to NyayaAI" />
                </form>
              </div>
            ) : authModalTab === "forgot-password" ? (
              /* ═══════════════════ FORGOT PASSWORD TAB ═══════════════════ */
              <div key="forgot-password" className="space-y-6 animate-tab-swap">
                <div>
                  <h2 className="text-2xl font-bold text-[#1A1614] dark:text-[#E8E0D4]">
                    Reset your <span className="font-heading font-normal italic text-[#C7A064]">password</span>
                  </h2>
                  <p className="text-[#5A5550] dark:text-[#8A8279] text-sm mt-1">
                    Enter your email and we'll send you instructions to reset your password.
                  </p>
                </div>

                {forgotSuccess ? (
                  <div className="space-y-5 animate-fade-in">
                    <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 text-sm rounded-xl flex items-start gap-3">
                      <FiCheckCircle className="w-5 h-5 shrink-0 text-green-500 mt-0.5" />
                      <div>
                        <p className="font-semibold text-green-800 dark:text-green-300">Reset link sent!</p>
                        <p className="text-xs mt-1 leading-relaxed">{forgotSuccess}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setAuthModalTab("signin")}
                      className="w-full py-3.5 bg-[#1A1614] dark:bg-[#C7A064] hover:bg-[#2A2522] dark:hover:bg-[#D4B078] text-white dark:text-[#1A1614] font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm cursor-pointer shadow-xs"
                    >
                      Return to Sign In <FiArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotSubmit(onForgotSubmit)} className="space-y-4">
                    <FormField label="Registered Email" error={forgotErrors.email?.message}>
                      <div className="relative">
                        <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5550]/50" />
                        <input
                          type="email"
                          autoFocus
                          {...registerForgot("email", {
                            required: "Email is required",
                            pattern: {
                              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                              message: "Invalid email address",
                            },
                          })}
                          placeholder="you@firm.com"
                          className={`${inputClass} pl-10`}
                        />
                      </div>
                    </FormField>

                    <SubmitButton isSubmitting={isForgotSubmitting} text="Send Reset Link" />

                    <p className="text-center text-[#5A5550] dark:text-[#8A8279] pt-2 text-sm">
                      Remember your password?{" "}
                      <button
                        type="button"
                        onClick={() => setAuthModalTab("signin")}
                        className="font-bold text-[#1A1614] dark:text-[#E8E0D4] underline cursor-pointer hover:text-[#C7A064] transition-colors"
                      >
                        Sign in
                      </button>
                    </p>
                  </form>
                )}
              </div>
            ) : (
              /* ═══════════════════ REGULAR SIGN IN / SIGN UP ═══════════════════ */
              <div key={authModalTab} className="animate-tab-swap">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-[#1A1614] dark:text-[#E8E0D4]">
                    {authModalTab === "signin" ? "Welcome " : "Create your "}
                    <span className="font-heading font-normal italic text-[#C7A064]">
                      {authModalTab === "signin" ? "back" : "account"}
                    </span>
                  </h2>
                  <p className="text-[#5A5550] dark:text-[#8A8279] text-sm mt-1">
                    {authModalTab === "signin"
                      ? "Continue your legal research."
                      : "Join NyayaAI today. It's completely free."}
                  </p>
                </div>

                {/* Google Button */}
                <button
                  type="button"
                  disabled={isAuthSubmitting}
                  onClick={handleGoogleSignIn}
                  className="w-full py-3.5 bg-white dark:bg-[#1A1614]/40 hover:bg-[#F5F5F5] dark:hover:bg-[#1A1614]/60 border border-[#1A1614]/10 dark:border-[#2A2522] text-[#1A1614] dark:text-[#E8E0D4] font-semibold rounded-xl transition-all flex items-center justify-center gap-3 text-sm cursor-pointer disabled:opacity-60 shadow-xs"
                >
                  <FcGoogle className="w-5 h-5" />
                  Continue with Google
                </button>

                {/* Divider */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-[#1A1614]/10 dark:border-[#2A2522]" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white dark:bg-[#141210] px-4 text-[#5A5550] dark:text-[#8A8279] font-bold tracking-wider">
                      Or with email
                    </span>
                  </div>
                </div>

                {/* Main Auth Form */}
                <form onSubmit={handleAuthSubmit(onAuthSubmit)} className="space-y-4">
                  {/* Full Name (Sign Up only) */}
                  {authModalTab === "signup" && (
                    <FormField label="Full Name" error={authErrors.fullName?.message}>
                      <input
                        type="text"
                        {...registerAuth("fullName", {
                          required: authModalTab === "signup" ? "Full name is required" : false,
                        })}
                        placeholder="Adv. John Doe"
                        className={inputClass}
                      />
                    </FormField>
                  )}

                  {/* Email */}
                  <FormField label="Email address" error={authErrors.email?.message}>
                    <input
                      type="email"
                      {...registerAuth("email", {
                        required: "Email address is required",
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: "Invalid email address",
                        },
                      })}
                      placeholder="you@firm.com"
                      className={inputClass}
                    />
                  </FormField>

                  {/* Mobile (Sign Up only) */}
                  {authModalTab === "signup" && (
                    <FormField label="Mobile number" error={authErrors.mobile?.message}>
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
                            {...registerAuth("mobile", {
                              pattern: {
                                value: /^[0-9]{10}$/,
                                message: "Please enter a valid 10-digit number",
                              },
                            })}
                            placeholder="9876543210"
                            className={`${inputClass} pl-10`}
                          />
                        </div>
                      </div>
                    </FormField>
                  )}

                  {/* Password */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-[#1A1614] dark:text-[#E8E0D4] uppercase tracking-wider">
                        Password
                      </label>
                      {authModalTab === "signin" && (
                        <button
                          type="button"
                          onClick={() => setAuthModalTab("forgot-password")}
                          className="text-xs font-semibold text-[#C7A064] hover:text-[#B08930] transition-colors cursor-pointer"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        {...registerAuth("password", {
                          required: "Password is required",
                          minLength: {
                            value: 6,
                            message: "Password must be at least 6 characters",
                          },
                        })}
                        placeholder="••••••••"
                        className={`${inputClass} pr-12`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#5A5550] dark:text-[#8A8279] hover:text-[#1A1614] dark:hover:text-[#E8E0D4] transition-colors cursor-pointer"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                      </button>
                    </div>
                    {authErrors.password && (
                      <p className="text-red-500 text-xs mt-1">{authErrors.password.message}</p>
                    )}
                  </div>

                  <SubmitButton
                    isSubmitting={isAuthSubmitting}
                    text={authModalTab === "signin" ? "Sign in" : "Create Account"}
                  />
                </form>

                {/* Tab Switcher Link */}
                <p className="text-center text-[#5A5550] dark:text-[#8A8279] mt-6 text-sm">
                  {authModalTab === "signin" ? (
                    <>
                      New to NyayaAI?{" "}
                      <button
                        type="button"
                        onClick={() => setAuthModalTab("signup")}
                        className="font-bold text-[#1A1614] dark:text-[#E8E0D4] underline cursor-pointer hover:text-[#C7A064] transition-colors"
                      >
                        Create an account
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => setAuthModalTab("signin")}
                        className="font-bold text-[#1A1614] dark:text-[#E8E0D4] underline cursor-pointer hover:text-[#C7A064] transition-colors"
                      >
                        Sign in
                      </button>
                    </>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
