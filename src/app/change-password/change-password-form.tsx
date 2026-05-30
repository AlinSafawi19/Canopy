"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { validatePassword } from "@/lib/validation";

export function ChangePasswordForm({ nextHref }: { nextHref: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const pwErr = validatePassword(password);
    if (pwErr) { setError(pwErr); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }

    setLoading(true);
    const res = await apiFetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);

    if (res.ok) {
      router.push(nextHref);
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to update password.");
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
      <div className="flex justify-center mb-4">
        <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center">
          <KeyRound size={28} className="text-indigo-500" />
        </div>
      </div>
      <h2 className="text-lg font-semibold text-slate-900 text-center mb-1">
        Create your password
      </h2>
      <p className="text-slate-500 text-sm text-center mb-6">
        Your account was created with a temporary password. Set a new one to secure your account.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
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
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
        />

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" loading={loading}>
          Set password
        </Button>
      </form>

      <button
        type="button"
        onClick={() => router.push(nextHref)}
        className="block w-full text-center text-sm text-slate-400 hover:text-slate-600 transition-colors mt-4"
      >
        Skip for now
      </button>
    </div>
  );
}
