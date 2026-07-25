"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { useSignIn } from "@clerk/nextjs/legacy";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import {
  RESET_SENT_MESSAGE,
  isEnumerationSafeClerkError,
  isRateLimitClerkError,
  mapResetSubmitError,
  validateNewPasswordInput,
} from "@/lib/auth/forgot-password";

type Step = "request" | "reset";

function ForgotPasswordInner() {
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { isLoaded, signIn, setActive } = useSignIn();
  const { signOut } = useClerk();
  const searchParams = useSearchParams();
  const startOnReset = searchParams.get("step") === "reset";

  const [step, setStep] = useState<Step>(startOnReset ? "reset" : "request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [info, setInfo] = useState(startOnReset ? RESET_SENT_MESSAGE : "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authLoaded && isSignedIn) {
      window.location.assign("/dashboard");
    }
  }, [authLoaded, isSignedIn]);

  async function onRequestCode(e: FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signIn || loading) return;
    setLoading(true);
    setError("");
    setInfo("");

    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: email.trim().toLowerCase(),
      });
      setInfo(RESET_SENT_MESSAGE);
      setStep("reset");
    } catch (err) {
      if (isRateLimitClerkError(err)) {
        setError(mapResetSubmitError(err));
      } else if (isEnumerationSafeClerkError(err)) {
        setInfo(RESET_SENT_MESSAGE);
        setStep("reset");
      } else if (typeof navigator !== "undefined" && !navigator.onLine) {
        setError("Network error. Check your connection and try again.");
      } else {
        const msg = mapResetSubmitError(err).toLowerCase();
        if (msg.includes("identifier") || msg.includes("email") || msg.includes("account")) {
          setInfo(RESET_SENT_MESSAGE);
          setStep("reset");
        } else {
          setError(mapResetSubmitError(err));
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function onResetPassword(e: FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signIn || loading) return;

    const validation = validateNewPasswordInput(password, confirmPassword);
    if (validation) {
      setError(validation);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code: code.trim(),
        password,
      });

      if (result.status === "complete") {
        if (result.createdSessionId) {
          await setActive({ session: result.createdSessionId });
        }
        await signOut({ redirectUrl: "/login?reset=1" });
        return;
      }

      if (result.status === "needs_second_factor") {
        setError("Additional verification is required. Contact support.");
      } else {
        setError("Unable to reset password. Please try again.");
      }
    } catch (err) {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setError("Network error. Check your connection and try again.");
      } else {
        setError(mapResetSubmitError(err));
      }
    } finally {
      setLoading(false);
    }
  }

  if (!authLoaded || !isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  if (isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-slate-500">Redirecting to dashboard…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Logo className="justify-center" />
          <h1 className="mt-6 text-2xl font-bold text-slate-900 dark:text-white">Forgot password?</h1>
          <p className="mt-2 text-sm text-slate-500">忘记密码？重置你的登录密码</p>
        </div>

        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          {step === "request" ? (
            <form onSubmit={onRequestCode} className="space-y-4" data-testid="forgot-request-form">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  disabled={loading}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {info && <p className="text-sm text-slate-600 dark:text-slate-300">{info}</p>}
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending…" : "Send reset code"}
              </Button>
            </form>
          ) : (
            <form onSubmit={onResetPassword} className="space-y-4" data-testid="forgot-reset-form">
              {info && <p className="text-sm text-slate-600 dark:text-slate-300">{info}</p>}
              <div>
                <Label htmlFor="code">Verification code</Label>
                <Input
                  id="code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={code}
                  disabled={loading}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  disabled={loading}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  disabled={loading}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Resetting…" : "Reset password"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                disabled={loading}
                onClick={() => {
                  setStep("request");
                  setCode("");
                  setPassword("");
                  setConfirmPassword("");
                  setError("");
                  setInfo("");
                }}
              >
                Back
              </Button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Remembered your password?{" "}
          <Link href="/login" className="text-blue-900 dark:text-blue-400">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center px-4">
          <p className="text-sm text-slate-500">Loading…</p>
        </div>
      }
    >
      <ForgotPasswordInner />
    </Suspense>
  );
}
