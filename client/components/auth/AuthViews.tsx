"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { FiArrowRight, FiEye, FiEyeOff, FiPhone, FiLoader, FiUser, FiCheckCircle, FiMail } from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";
import { useUIStore } from "@/lib/store";
import { signIn, signUp, updateUser, authClient, useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Image from "next/image";

// ═══════════════════ SHARED COMPONENTS & UTILS ═══════════════════

export const inputClass =
  "w-full px-4 py-3 rounded-xl border border-[#1A1614]/10 dark:border-[#2A2522] bg-[#FAFAFA] dark:bg-[#1A1614]/30 text-[#1A1614] dark:text-[#E8E0D4] text-sm focus:outline-none focus:ring-2 focus:ring-[#C7A064]/40 transition-all placeholder:text-[#5A5550]/50";

export function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
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

export function SubmitButton({ isSubmitting, disabled, text, icon = <FiArrowRight className="w-4 h-4" /> }: { isSubmitting: boolean; disabled?: boolean; text: string; icon?: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={isSubmitting || disabled}
      className="w-full py-3.5 mt-2 bg-[#1A1614] dark:bg-[#C7A064] hover:bg-[#2A2522] dark:hover:bg-[#D4B078] text-white dark:text-[#1A1614] font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60 cursor-pointer shadow-xs"
    >
      {isSubmitting ? <FiLoader className="w-4 h-4 animate-spin" /> : <>{text} {icon}</>}
    </button>
  );
}

export function ErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs rounded-xl animate-fade-in">
      {error}
    </div>
  );
}

export function SuccessBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="mb-4 p-4 bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 text-sm rounded-xl flex items-center gap-2">
      <FiCheckCircle className="w-5 h-5 shrink-0" />
      <p className="font-bold">{message}</p>
    </div>
  );
}

export function GoogleButton({ setAuthError }: { setAuthError: (e: string | null) => void }) {
  const origin = typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL;
  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signIn.social({
        provider: "google",
        callbackURL: `${origin}/ask`,
        errorCallbackURL: `${origin}/?auth=signin&error=cancelled`,
      });
    } catch (err: any) {
      setAuthError(err?.message || "Google sign-in failed.");
    }
  };

  return (
    <button
      type="button"
      onClick={handleGoogleSignIn}
      className="w-full py-3.5 mb-6 bg-white dark:bg-[#1A1614]/40 hover:bg-[#F5F5F5] dark:hover:bg-[#1A1614]/60 border border-[#1A1614]/10 dark:border-[#2A2522] text-[#1A1614] dark:text-[#E8E0D4] font-semibold rounded-xl transition-all flex items-center justify-center gap-3 text-sm cursor-pointer shadow-xs"
    >
      <FcGoogle className="w-5 h-5" />
      Continue with Google
    </button>
  );
}

// ═══════════════════ SIGN IN VIEW ═══════════════════

export function SignInView() {
  const { setAuthModalTab } = useUIStore();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
  const { register, handleSubmit, formState: { isSubmitting, errors } } = useForm();
  
  const origin = typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL;

  const onSubmit = async (data: any) => {
    setAuthError(null);
    try {
      const res = await signIn.email({ email: data.email, password: data.password, callbackURL: `${origin}/ask` });
      if (res?.error) setAuthError(res.error.message || "Invalid email or password");
      else {
        useUIStore.getState().closeAuthModal();
        router.push("/ask");
      }
    } catch (err: any) {
      setAuthError(err?.message || "An unexpected error occurred.");
    }
  };

  return (
    <div className="animate-tab-swap">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[#1A1614] dark:text-[#E8E0D4]">
          Welcome <span className="font-heading font-normal italic text-[#C7A064]">back</span>
        </h2>
        <p className="text-[#5A5550] dark:text-[#8A8279] text-sm mt-1">Continue your legal research.</p>
      </div>

      <ErrorBanner error={authError} />
      <GoogleButton setAuthError={setAuthError} />

      <div className="relative my-6 flex justify-center text-xs uppercase">
        <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-[#1A1614]/10 dark:border-[#2A2522]" />
        <span className="relative bg-white dark:bg-[#141210] px-4 text-[#5A5550] dark:text-[#8A8279] font-bold tracking-wider">
          Or with email
        </span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField label="Email address" error={errors.email?.message as string}>
          <input
            type="email"
            {...register("email", { required: "Email is required", pattern: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i })}
            placeholder="you@firm.com"
            className={inputClass}
          />
        </FormField>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-[#1A1614] dark:text-[#E8E0D4] uppercase tracking-wider">Password</label>
            <button type="button" onClick={() => setAuthModalTab("forgot-password")} className="text-xs font-semibold text-[#C7A064] hover:text-[#B08930] cursor-pointer">
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <input type={showPassword ? "text" : "password"} {...register("password", { required: "Password is required" })} placeholder="••••••••" className={`${inputClass} pr-12`} />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#5A5550] hover:text-[#1A1614] dark:text-[#8A8279] dark:hover:text-[#E8E0D4]">
              {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message as string}</p>}
        </div>

        <SubmitButton isSubmitting={isSubmitting} text="Sign in" />
      </form>

      <p className="text-center text-[#5A5550] dark:text-[#8A8279] mt-6 text-sm">
        New to Rocky Legal? <button type="button" onClick={() => setAuthModalTab("signup")} className="font-bold text-[#1A1614] dark:text-[#E8E0D4] underline cursor-pointer hover:text-[#C7A064]">Create an account</button>
      </p>
    </div>
  );
}

// ═══════════════════ SIGN UP VIEW ═══════════════════

export function SignUpView() {
  const { setAuthModalTab, setAuthEmail } = useUIStore();
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
  const { register, handleSubmit, formState: { isSubmitting, errors } } = useForm();
  
  const origin = typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL;

  const onSubmit = async (data: any) => {
    setAuthError(null);
    try {
      const res = await signUp.email({
        email: data.email,
        password: data.password,
        name: data.fullName,
        fullName: data.fullName,
        mobile: data.mobile ? `+91${data.mobile}` : undefined,
      } as any);

      if (res?.error) {
        setAuthError(res.error.message || "Failed to create account.");
      } else {
        // Switch to OTP verify flow instead of signing in!
        setAuthEmail(data.email);
        setAuthModalTab("verify-email-otp");
      }
    } catch (err: any) {
      setAuthError(err?.message || "An unexpected error occurred.");
    }
  };

  return (
    <div className="animate-tab-swap">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[#1A1614] dark:text-[#E8E0D4]">
          Create your <span className="font-heading font-normal italic text-[#C7A064]">account</span>
        </h2>
        <p className="text-[#5A5550] dark:text-[#8A8279] text-sm mt-1">Join Rocky Legal today. It's completely free.</p>
      </div>

      <ErrorBanner error={authError} />
      <GoogleButton setAuthError={setAuthError} />

      <div className="relative my-6 flex justify-center text-xs uppercase">
        <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-[#1A1614]/10 dark:border-[#2A2522]" />
        <span className="relative bg-white dark:bg-[#141210] px-4 text-[#5A5550] dark:text-[#8A8279] font-bold tracking-wider">
          Or with email
        </span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField label="Full Name" error={errors.fullName?.message as string}>
          <input type="text" {...register("fullName", { required: "Name is required" })} placeholder="Adv. John Doe" className={inputClass} />
        </FormField>

        <FormField label="Email address" error={errors.email?.message as string}>
          <input type="email" {...register("email", { required: "Email is required", pattern: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i })} placeholder="you@firm.com" className={inputClass} />
        </FormField>

        <FormField label="Mobile number" error={errors.mobile?.message as string}>
          <div className="flex gap-2">
            <div className="flex items-center gap-2 px-3 py-3 rounded-xl border border-[#1A1614]/10 dark:border-[#2A2522] bg-[#FAFAFA] dark:bg-[#1A1614]/30 text-sm text-[#1A1614] dark:text-[#E8E0D4] shrink-0">
              <span>🇮🇳</span><span className="font-semibold">+91</span>
            </div>
            <div className="relative flex-1">
              <FiPhone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5550]/50" />
              <input type="tel" maxLength={10} {...register("mobile", { pattern: { value: /^[0-9]{10}$/, message: "Valid 10-digit number required" } })} placeholder="0000000000" className={`${inputClass} pl-10`} />
            </div>
          </div>
        </FormField>

        <FormField label="Password" error={errors.password?.message as string}>
          <div className="relative">
            <input type={showPassword ? "text" : "password"} {...register("password", { required: "Password is required", minLength: 6 })} placeholder="••••••••" className={`${inputClass} pr-12`} />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#5A5550] hover:text-[#1A1614] dark:text-[#8A8279] dark:hover:text-[#E8E0D4]">
              {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
            </button>
          </div>
        </FormField>

        <SubmitButton isSubmitting={isSubmitting} text="Create Account" />
      </form>

      <p className="text-center text-[#5A5550] dark:text-[#8A8279] mt-6 text-sm">
        Already have an account? <button type="button" onClick={() => setAuthModalTab("signin")} className="font-bold text-[#1A1614] dark:text-[#E8E0D4] underline cursor-pointer hover:text-[#C7A064]">Sign in</button>
      </p>
    </div>
  );
}

// ═══════════════════ VERIFY EMAIL (SIGNUP) VIEW ═══════════════════

export function VerifyEmailView() {
  const { authEmail, setAuthModalTab, closeAuthModal } = useUIStore();
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 4) return setError("OTP must be 4 digits");
    
    setIsVerifying(true);
    setError(null);
    try {
      const res = await (authClient as any).emailOtp.verifyEmail({ email: authEmail, otp });
      if (res?.error) setError(res.error.message || "Invalid OTP.");
      else {
        closeAuthModal();
        router.push("/ask");
      }
    } catch (err: any) {
      setError("Failed to verify OTP.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="animate-tab-swap space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#1A1614] dark:text-[#E8E0D4]">
          Verify your <span className="font-heading font-normal italic text-[#C7A064]">Email</span>
        </h2>
        <p className="text-[#5A5550] dark:text-[#8A8279] text-sm mt-1">We sent a 4-digit code to your email.</p>
      </div>

      <div className="flex items-center gap-3 p-3 bg-[#FAFAFA] dark:bg-[#1A1614]/40 rounded-xl border border-[#1A1614]/10 dark:border-[#2A2522]">
        <div className="w-10 h-10 rounded-full bg-[#C7A064]/20 text-[#C7A064] flex items-center justify-center font-bold shrink-0">
          <FiMail className="w-5 h-5" />
        </div>
        <div className="overflow-hidden">
          <p className="text-xs text-[#5A5550] flex items-center gap-1"><FiCheckCircle className="text-[#C7A064] w-3.5 h-3.5" /> OTP sent to</p>
          <p className="text-sm font-bold text-[#1A1614] dark:text-[#E8E0D4] truncate">{authEmail}</p>
        </div>
      </div>

      <ErrorBanner error={error} />
      <form onSubmit={onVerify} className="space-y-4">
        <FormField label="4-Digit OTP">
          <input type="text" autoFocus maxLength={4} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="0000" className={`${inputClass} text-center font-bold tracking-widest text-lg`} />
        </FormField>
        <SubmitButton isSubmitting={isVerifying} disabled={otp.length !== 4} text="Verify & Continue" />
      </form>
    </div>
  );
}

// ═══════════════════ FORGOT PASSWORD VIEW ═══════════════════

export function ForgotPasswordView() {
  const { setAuthModalTab } = useUIStore();
  const [step, setStep] = useState<"request" | "verify">("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const res = await (authClient as any).emailOtp.sendVerificationOtp({ email, type: "forget-password" });
      if (res?.error) {
        setError(res.error.message || "Failed to send OTP.");
      } else {
        setStep("verify");
        setSuccess(`We sent a 4-digit OTP to ${email}`);
      }
    } catch (err) {
      setError("Failed to send OTP.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 4 || newPassword.length < 6) return setError("Invalid OTP or short password.");
    
    setIsLoading(true);
    setError(null);
    try {
      const res = await (authClient as any).emailOtp.resetPassword({ email, otp, password: newPassword });
      if (res?.error) setError(res.error.message || "Invalid OTP.");
      else {
        setSuccess("Password reset successfully! You can now sign in.");
        setTimeout(() => setAuthModalTab("signin"), 2000);
      }
    } catch (err) {
      setError("Error resetting password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="animate-tab-swap space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#1A1614] dark:text-[#E8E0D4]">
          Reset your <span className="font-heading font-normal italic text-[#C7A064]">password</span>
        </h2>
        <p className="text-[#5A5550] dark:text-[#8A8279] text-sm mt-1">
          {step === "request" ? "Enter your email to receive a 4-digit OTP." : "Enter the 4-digit code and choose a new password."}
        </p>
      </div>

      {step === "verify" && (
        <div className="flex items-center gap-3 p-3 bg-[#FAFAFA] dark:bg-[#1A1614]/40 rounded-xl border border-[#1A1614]/10 dark:border-[#2A2522]">
          <div className="w-10 h-10 rounded-full bg-[#C7A064]/20 text-[#C7A064] flex items-center justify-center font-bold shrink-0">
            <FiMail className="w-5 h-5" />
          </div>
          <div className="overflow-hidden">
            <p className="text-xs text-[#5A5550] flex items-center gap-1"><FiCheckCircle className="text-[#C7A064] w-3.5 h-3.5" /> OTP sent to</p>
            <p className="text-sm font-bold text-[#1A1614] dark:text-[#E8E0D4] truncate">{email}</p>
          </div>
        </div>
      )}

      <ErrorBanner error={error} />
      <SuccessBanner message={success} />

      {step === "request" ? (
        <form onSubmit={handleRequest} className="space-y-4">
          <FormField label="Registered Email">
            <div className="relative">
              <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5550]/50" />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@firm.com" className={`${inputClass} pl-10`} />
            </div>
          </FormField>
          <SubmitButton isSubmitting={isLoading} text="Send OTP" />
          <p className="text-center text-[#5A5550] dark:text-[#8A8279] pt-2 text-sm">
            Remember your password? <button type="button" onClick={() => setAuthModalTab("signin")} className="font-bold text-[#1A1614] dark:text-[#E8E0D4] underline hover:text-[#C7A064]">Sign in</button>
          </p>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-4">
          <FormField label="4-Digit OTP">
            <input type="text" maxLength={4} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="0000" className={`${inputClass} text-center font-bold tracking-widest text-lg`} />
          </FormField>
          <FormField label="New Password">
            <div className="relative">
              <input type={showPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" className={`${inputClass} pr-12`} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#5A5550] hover:text-[#1A1614] dark:text-[#8A8279] dark:hover:text-[#E8E0D4]">
                {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
              </button>
            </div>
          </FormField>
          <SubmitButton isSubmitting={isLoading} disabled={otp.length !== 4 || newPassword.length < 6} text="Reset Password" />
          <p className="text-center text-[#5A5550] dark:text-[#8A8279] pt-2 text-sm">
            Didn't receive it? <button type="button" onClick={() => setStep("request")} className="font-bold text-[#1A1614] dark:text-[#E8E0D4] underline hover:text-[#C7A064]">Try again</button>
          </p>
        </form>
      )}
    </div>
  );
}

// ═══════════════════ PHONE SETUP VIEW ═══════════════════

export function PhoneSetupView() {
  const { data: session } = useSession();
  const { closeAuthModal } = useUIStore();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneNumber.length < 10) return setError("Valid 10-digit number required");
    setIsLoading(true);
    setError(null);
    try {
      const formatted = `+91${phoneNumber}`;
      const res = await fetch("/api/users/mobile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mobile: formatted }) });
      if (!res.ok) await updateUser({ mobile: formatted } as any);
      closeAuthModal();
      window.location.href = "/ask";
    } catch (err: any) {
      setError("Failed to save phone number.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!session?.user) return null;

  return (
    <div className="animate-tab-swap space-y-6">
      <div className="flex items-center gap-3 p-3 bg-[#FAFAFA] dark:bg-[#1A1614]/40 rounded-xl border border-[#1A1614]/10 dark:border-[#2A2522]">
        {session.user.image ? (
          <Image src={session.user.image} alt={session.user.name || "User"} width={40} height={40} className="rounded-full" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-[#C7A064]/20 text-[#C7A064] flex items-center justify-center font-bold">
            {session.user.name ? session.user.name[0].toUpperCase() : <FiUser />}
          </div>
        )}
        <div className="overflow-hidden">
          <p className="text-xs text-[#5A5550] flex items-center gap-1"><FiCheckCircle className="text-green-500 w-3.5 h-3.5" /> Google account linked</p>
          <p className="text-sm font-bold text-[#1A1614] dark:text-[#E8E0D4] truncate">{session.user.name}</p>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-[#1A1614] dark:text-[#E8E0D4]">One last <span className="font-heading font-normal italic text-[#C7A064]">step</span></h2>
        <p className="text-[#5A5550] text-sm mt-1">Enter your mobile number to complete your profile.</p>
      </div>

      <ErrorBanner error={error} />

      <form onSubmit={onSubmit} className="space-y-4">
        <FormField label="Mobile Number">
          <div className="flex gap-2">
            <div className="flex items-center gap-2 px-3 py-3 rounded-xl border border-[#1A1614]/10 dark:border-[#2A2522] bg-[#FAFAFA] dark:bg-[#1A1614]/30 text-sm text-[#1A1614] dark:text-[#E8E0D4] shrink-0">
              <span>🇮🇳</span><span className="font-semibold">+91</span>
            </div>
            <div className="relative flex-1">
              <FiPhone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5550]/50" />
              <input type="tel" maxLength={10} required value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))} placeholder="0000000000" className={`${inputClass} pl-10`} />
            </div>
          </div>
        </FormField>
        <SubmitButton isSubmitting={isLoading} disabled={phoneNumber.length < 10} text="Continue to Rocky Legal" />
      </form>
    </div>
  );
}
