"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function TwoFactorForm({ displayName }: { displayName: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [useBackup, setUseBackup] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!code.trim()) { setError("Code is required."); return; }
    setLoading(true);

    const res = await apiFetch("/api/auth/two-factor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim() }),
    });
    setLoading(false);

    if (res.ok) {
      const { redirectTo } = await res.json();
      router.push(redirectTo);
    } else {
      const data = await res.json();
      setError(data.error ?? "Invalid code");
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
      <div className="flex justify-center mb-4">
        <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center">
          <ShieldCheck size={28} className="text-indigo-500" />
        </div>
      </div>
      <h2 className="text-lg font-semibold text-slate-900 text-center mb-1">
        Verify your identity
      </h2>
      <p className="text-slate-500 text-sm text-center mb-6">
        Welcome back, <strong className="text-slate-700">{displayName}</strong>.{" "}
        {useBackup
          ? "Enter one of your backup codes."
          : "Enter the 6-digit code from your authenticator app."}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={useBackup ? "Backup Code" : "Authenticator Code"}
          value={code}
          onChange={(e) => setCode(useBackup ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder={useBackup ? "XXXX-XXXX" : "000000"}
          inputMode={useBackup ? "text" : "numeric"}
          className={useBackup ? "font-mono tracking-widest" : "text-center tracking-widest font-mono text-lg"}
          autoComplete="one-time-code"
          autoFocus
          required
        />

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" loading={loading}>
          Verify
        </Button>
      </form>

      <button
        type="button"
        onClick={() => { setUseBackup((v) => !v); setCode(""); setError(""); }}
        className="block w-full text-center text-sm text-slate-400 hover:text-slate-600 transition-colors mt-4"
      >
        {useBackup ? "Use authenticator app instead" : "Use a backup code instead"}
      </button>
    </div>
  );
}
