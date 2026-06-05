"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { validateDisplayName, validateEmail, validatePassword, firstError } from "@/lib/validation";

interface Client { id: string; displayName: string; email: string; username: string }

export function ClientSettingsForm({ client }: { client: Client }) {
  const router = useRouter();
  const [form, setForm] = useState({ displayName: client.displayName, email: client.email });
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(true);
  const [pwMsg, setPwMsg] = useState("");
  const [pwMsgOk, setPwMsgOk] = useState(true);

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg("");
    const err = firstError(validateDisplayName(form.displayName), validateEmail(form.email));
    if (err) { setMsgOk(false); setMsg(err); return; }
    setLoading(true);
    const res = await apiFetch("/api/client/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setLoading(false);
    setMsgOk(res.ok);
    setMsg(res.ok ? "Profile updated." : "Failed to update.");
    if (res.ok) router.refresh();
  }

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pw.current) { setPwMsgOk(false); setPwMsg("Current password is required."); return; }
    const pwErr = validatePassword(pw.next);
    if (pwErr) { setPwMsgOk(false); setPwMsg(pwErr); return; }
    if (pw.next !== pw.confirm) { setPwMsgOk(false); setPwMsg("Passwords do not match."); return; }
    setPwLoading(true);
    setPwMsg("");
    const res = await apiFetch("/api/client/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.next }) });
    setPwLoading(false);
    setPwMsgOk(res.ok);
    setPwMsg(res.ok ? "Password changed." : "Failed to change password.");
    if (res.ok) setPw({ current: "", next: "", confirm: "" });
  }

  return (
    <div className="space-y-8">
      <form onSubmit={saveProfile} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Display name"
            value={form.displayName}
            onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            autoComplete="name"
            maxLength={50}
            required
          />
          <Input
            label="Email"
            type="text"
            inputMode="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            autoComplete="email"
            hint="Changing your email will require re-verification."
            required
          />
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" size="md" loading={loading}>Save changes</Button>
          {msg && <span className={`text-sm ${msgOk ? "text-emerald-600" : "text-red-600"}`}>{msg}</span>}
        </div>
      </form>
      <div className="border-t border-slate-100 pt-6">
        <h4 className="text-sm font-semibold text-slate-900 mb-4">Change password</h4>
        <form onSubmit={changePassword} className="space-y-4">
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
            <Button type="submit" size="md" loading={pwLoading}>Change password</Button>
            {pwMsg && <span className={`text-sm ${pwMsgOk ? "text-emerald-600" : "text-red-600"}`}>{pwMsg}</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
