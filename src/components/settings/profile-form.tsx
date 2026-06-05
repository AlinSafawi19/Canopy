"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { validateDisplayName, validateEmail, firstError } from "@/lib/validation";
import { LIMITS } from "@/lib/limits";

interface ProfileFormProps {
  apiPath: string;
  displayName: string;
  email: string;
  tenantId?: string;
}

export function ProfileForm({ apiPath, displayName, email, tenantId }: ProfileFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({ displayName, email });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(true);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg("");
    const err = firstError(validateDisplayName(form.displayName), validateEmail(form.email));
    if (err) { setMsgOk(false); setMsg(err); return; }
    setLoading(true);
    const res = await apiFetch(apiPath, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      setMsgOk(true);
      setMsg(
        data.emailChanged
          ? "Email updated — a verification code has been sent to your new address. Check Settings → Email."
          : "Profile updated."
      );
      router.refresh();
    } else {
      setMsgOk(false);
      setMsg("Failed to update.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {tenantId && (
        <div className="p-3 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-500">Workspace (Tenant ID)</p>
          <Badge variant="info" className="mt-1">{tenantId}</Badge>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Display name"
          value={form.displayName}
          onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
          autoComplete="name"
          maxLength={LIMITS.DISPLAY_NAME}
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
          maxLength={LIMITS.EMAIL}
          required
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" size="md" loading={loading}>Save changes</Button>
        {msg && (
          <span className={`text-sm ${msgOk ? "text-emerald-600" : "text-red-600"}`}>{msg}</span>
        )}
      </div>
    </form>
  );
}
