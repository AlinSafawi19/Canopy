"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, ArrowLeft } from "lucide-react";
import { validatePassword } from "@/lib/validation";

interface ResetFormProps {
  token: string;
  id: string;
  kind: string;
}

export function ResetForm({ token, id, kind }: ResetFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const pwErr = validatePassword(password);
    if (pwErr) { setError(pwErr); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }

    setLoading(true);

    try {
      const res = await apiFetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, id, kind, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3.5">
          <CheckCircle size={18} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Password updated</p>
            <p className="text-emerald-600 mt-0.5">
              Your password has been reset. Redirecting you to sign in…
            </p>
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

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input
        label="New password"
        type="password"
        showToggle
        value={password}
        onChange={(e) => setPassword(e.target.value)}
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
        onChange={(e) => setConfirmPassword(e.target.value)}
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

      <Link href="/login" className="flex justify-center">
        <Button variant="outline" size="sm" className="gap-1.5 w-full">
          <ArrowLeft size={14} />
          Back to sign in
        </Button>
      </Link>
    </form>
  );
}
