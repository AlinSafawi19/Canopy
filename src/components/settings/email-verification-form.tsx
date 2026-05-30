"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Mail } from "lucide-react";

interface EmailVerificationFormProps {
  email: string;
  emailVerified: boolean;
}

export function EmailVerificationForm({ email, emailVerified: initialVerified }: EmailVerificationFormProps) {
  const router = useRouter();
  const [verified, setVerified] = useState(initialVerified);
  const [code, setCode] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState("");

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setVerifyError("");
    if (!code.trim()) { setVerifyError("Verification code is required."); return; }
    setVerifyLoading(true);
    const res = await apiFetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    setVerifyLoading(false);
    if (res.ok) {
      const data = await res.json();
      setVerified(true);
      if (data.mustChangePassword) {
        router.push("/change-password");
      } else {
        router.refresh();
      }
    } else {
      const data = await res.json();
      setVerifyError(data.error ?? "Verification failed");
    }
  }

  async function handleResend() {
    setResendLoading(true);
    setResendMsg("");
    setVerifyError("");
    setCode("");
    await apiFetch("/api/auth/send-verification", { method: "POST" });
    setResendLoading(false);
    setResendMsg("A new code has been sent to your email.");
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
            <Mail size={16} className="text-slate-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">{email}</p>
            <p className="text-xs text-slate-500 mt-0.5">Account email address</p>
          </div>
        </div>
        {verified ? (
          <Badge variant="success">Verified</Badge>
        ) : (
          <Badge variant="warning">Unverified</Badge>
        )}
      </div>

      {verified ? (
        <div className="flex items-center gap-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3">
          <CheckCircle size={16} className="flex-shrink-0" />
          Your email address has been verified. No further action is needed.
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-500">
            Enter the 6-digit code we sent to your email address to verify your account.
          </p>

          <form onSubmit={handleVerify} className="space-y-4">
            <div className="flex items-end gap-3">
              <div className="w-44">
                <Input
                  label="Verification Code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  placeholder="000000"
                  className="text-center tracking-widest font-mono text-base"
                  required
                />
              </div>
              <Button type="submit" size="sm" loading={verifyLoading}>
                Verify
              </Button>
            </div>
            {verifyError && (
              <p className="text-sm text-red-600">{verifyError}</p>
            )}
          </form>

          <div className="flex items-center gap-2 pt-1">
            <p className="text-sm text-slate-500">Didn&apos;t receive a code?</p>
            {resendMsg ? (
              <span className="text-sm text-emerald-600">{resendMsg}</span>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                loading={resendLoading}
                onClick={handleResend}
                className="h-auto p-0 text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Resend
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
