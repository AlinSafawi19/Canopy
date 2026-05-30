"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TwoFactorSection } from "./two-factor-section";
import { validatePassword } from "@/lib/validation";

interface SecurityFormProps {
  apiPath: string;
  twoFactorEnabled: boolean;
}

export function SecurityForm({ apiPath, twoFactorEnabled }: SecurityFormProps) {
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(true);

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
    setMsg(res.ok ? "Password changed." : "Failed to change password.");
    if (res.ok) setPw({ current: "", next: "", confirm: "" });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
          minLength={8}
          maxLength={72}
          hint="At least 8 characters."
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
