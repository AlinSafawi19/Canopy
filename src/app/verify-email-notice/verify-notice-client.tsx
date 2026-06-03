"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  email: string;
  nextHref: string;
}

export function VerifyNoticeClient({ email, nextHref }: Props) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);

  // Auto-send on mount. AbortController ensures Strict Mode's double-invoke
  // cancels the first request so only one email is sent.
  useEffect(() => {
    const controller = new AbortController();
    apiFetch("/api/auth/send-verification", { method: "POST", signal: controller.signal })
      .catch(() => {}); // ignore abort
    return () => controller.abort();
  }, []);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;
    setError("");
    setVerifying(true);
    try {
      const res = await apiFetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Incorrect code. Please try again.");
        return;
      }
      setVerified(true);
      setTimeout(() => router.push(nextHref), 1200);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setError("");
    setCode("");
    setResent(false);
    await apiFetch("/api/auth/send-verification", { method: "POST" });
    setResending(false);
    setResent(true);
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
      <div className="flex justify-center mb-4">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors duration-300 ${verified ? "bg-emerald-50" : "bg-amber-50"}`}>
          {verified
            ? <CheckCircle2 size={28} className="text-emerald-500" />
            : <Mail size={28} className="text-amber-500" />
          }
        </div>
      </div>

      <h2 className="text-lg font-semibold text-slate-900 text-center mb-2">
        {verified ? "Email verified!" : "Verify your email address"}
      </h2>

      {verified ? (
        <p className="text-slate-500 text-sm text-center">
          Redirecting you now…
        </p>
      ) : (
        <>
          <p className="text-slate-500 text-sm text-center mb-3">
            We&apos;ve sent a 6-digit code to{" "}
            <strong className="text-slate-700">{email || "your email"}</strong>.
            Enter it below to confirm you own this address.
          </p>
          <p className="text-xs text-slate-400 text-center mb-3">
            Verifying confirms this address is real and belongs to you, so we can reach you when it matters.
          </p>
          <p className="text-xs text-slate-400 text-center mb-5">
            This is a one-time step. You won&apos;t be asked again unless you change your email address.
          </p>

          <form onSubmit={handleVerify} className="space-y-3">
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => {
                setError("");
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
              }}
              placeholder="000000"
              autoComplete="one-time-code"
              className="w-full text-center text-2xl font-bold tracking-[0.4em] h-14 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
            />

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-center">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              loading={verifying}
              disabled={code.length !== 6}
            >
              Verify email
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-between">
            {resent ? (
              <p className="text-amber-600 text-xs font-medium">New code sent — previous code is now invalid.</p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
              >
                {resending ? "Sending…" : "Resend code"}
              </button>
            )}

            <Link
              href={nextHref}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Skip for now
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
