"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TwoFactorSection } from "./two-factor-section";
import { validatePassword } from "@/lib/validation";
import { AlertCircle } from "lucide-react";

interface SecurityFormProps {
  apiPath: string;
  twoFactorEnabled: boolean;
}

export function SecurityForm({ apiPath, twoFactorEnabled }: SecurityFormProps) {
  const router = useRouter();
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(true);
  const [showWarning, setShowWarning] = useState(true);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pw.current) { setMsgOk(false); setMsg("Current password is required."); return; }
    const pwErr = validatePassword(pw.next);
    if (pwErr) { setMsgOk(false); setMsg(pwErr); return; }
    if (pw.next !== pw.confirm) { setMsgOk(false); setMsg("Passwords do not match."); return; }
    setLoading(true);
    setMsg("");
    const res = await apiFetch(apiPath, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.next }),
    });
    setLoading(false);
    setMsgOk(res.ok);
    setMsg(
      res.ok
        ? "Password changed successfully. You'll be logged out in a few seconds..."
        : "Failed to change password."
    );
    if (res.ok) {
      setPw({ current: "", next: "", confirm: "" });
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {showWarning && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900">
              Important: Changing your password will log you out
            </p>
            <p className="text-sm text-amber-800 mt-0.5">
              You'll be logged out of all sessions and need to sign in again.
            </p>
            <button
              type="button"
              onClick={() => setShowWarning(false)}
              className="text-xs text-amber-700 hover:text-amber-900 mt-2 underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      <Input
        label="Current password"
        type="password"
        showToggle
        value={pw.current}
        onChange={(e) => setPw((f) => ({ ...f, current: e.target.value }))}
        autoComplete="current-password"
        required
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="New password"
          type="password"
          showToggle
          value={pw.next}
          onChange={(e) => setPw((f) => ({ ...f, next: e.target.value }))}
          autoComplete="new-password"
          hint="At least 8 characters. Cannot reuse recent passwords."
          required
        />
        <Input
          label="Confirm password"
          type="password"
          showToggle
          value={pw.confirm}
          onChange={(e) => setPw((f) => ({ ...f, confirm: e.target.value }))}
          autoComplete="new-password"
          required
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" loading={loading}>Change password</Button>
        {msg && (
          <span className={`text-sm ${msgOk ? "text-emerald-600" : "text-red-600"}`}>{msg}</span>
        )}
      </div>
      <TwoFactorSection twoFactorEnabled={twoFactorEnabled} />
    </form>
  );
}
