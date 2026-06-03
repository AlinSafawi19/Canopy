"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-fetch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export function InviteForm({ token }: { token: string }) {
  const router = useRouter();
  const submittingRef = useRef(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setError("");
    setLoading(true);
    submittingRef.current = true;
    try {
      const res = await apiFetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }
      router.push(data.redirectTo);
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Password"
        type="password"
        showToggle
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
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
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
          <AlertCircle size={16} className="flex-shrink-0" />
          {error}
        </div>
      )}
      <Button type="submit" className="w-full" size="lg" loading={loading}>
        Activate account
      </Button>
    </form>
  );
}
