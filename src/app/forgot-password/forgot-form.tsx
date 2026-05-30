"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, ArrowLeft } from "lucide-react";
import { validateEmail, validatePassword } from "@/lib/validation";

type Step = "email" | "reset" | "done";

export function ForgotForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const emailErr = validateEmail(email);
    if (emailErr) { setError(emailErr); return; }
    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setStep("reset");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!code.trim()) { setError("Verification code is required."); return; }
    const pwErr = validatePassword(password);
    if (pwErr) { setError(pwErr); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setStep("done");
      setTimeout(() => router.push("/login"), 2500);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "done") {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3.5">
          <CheckCircle size={18} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Password updated</p>
            <p className="text-emerald-600 mt-0.5">Your password has been reset. Redirecting you to sign in…</p>
          </div>
        </div>
        <Link href="/login" className="flex justify-center">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft size={14} />
            Back to sign in
          </Button>
        </Link>
      </div>
    );
  }

  if (step === "reset") {
    return (
      <form onSubmit={resetPassword} className="space-y-5">
        <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
          A 6-digit code was sent to <span className="font-medium text-slate-700">{email}</span>. Enter it below along with your new password.
        </div>

        <Input
          label="6-digit code"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
          placeholder="000000"
          className="tracking-widest font-mono text-center text-lg"
          autoFocus
          required
        />

        <Input
          label="New password"
          type="password"
          showToggle
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(""); }}
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          hint="At least 8 characters."
          required
        />

        <Input
          label="Confirm password"
          type="password"
          showToggle
          value={confirmPassword}
          onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
          autoComplete="new-password"
          required
        />

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
            <AlertCircle size={16} className="flex-shrink-0" />
            {error}
          </div>
        )}

        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Reset password
        </Button>

        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => { setStep("email"); setCode(""); setPassword(""); setConfirmPassword(""); setError(""); }}
            className="text-slate-500 hover:text-slate-700 transition-colors"
          >
            Change email
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={async () => {
              setError("");
              setLoading(true);
              await apiFetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
              });
              setLoading(false);
            }}
            className="text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-50 transition-colors"
          >
            Resend code
          </button>
        </div>

        <Link href="/login" className="flex justify-center">
          <Button variant="outline" size="sm" className="gap-1.5 w-full">
            <ArrowLeft size={14} />
            Back to sign in
          </Button>
        </Link>
      </form>
    );
  }

  return (
    <form onSubmit={sendCode} className="space-y-5">
      <p className="text-sm text-slate-500">
        Enter your email address and we&apos;ll send you a 6-digit code to reset your password.
      </p>

      <Input
        label="Email address"
        type="text"
        inputMode="email"
        value={email}
        onChange={(e) => { setEmail(e.target.value); setError(""); }}
        placeholder="you@example.com"
        autoComplete="email"
        required
      />

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
          <AlertCircle size={16} className="flex-shrink-0" />
          {error}
        </div>
      )}

      <Button type="submit" className="w-full" size="lg" loading={loading}>
        Send code
      </Button>

      <Link href="/login" className="flex justify-center">
        <Button variant="outline" size="sm" className="gap-1.5 w-full">
          <ArrowLeft size={14} />
          Back to sign in
        </Button>
      </Link>
    </form>
  );
}
