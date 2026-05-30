"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalRef } from "@/components/ui/modal";
import { validateUsername, validatePassword, validateEmail, validateDisplayName, firstError } from "@/lib/validation";
import { downloadCredentialsPdf } from "@/lib/credentials-pdf";

export function CreateAdminButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const modalRef = useRef<ModalRef>(null);
  const [form, setForm] = useState({ username: "", password: "", displayName: "", email: "" });

  function handleChange(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setTouched(true);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const err = firstError(
      validateDisplayName(form.displayName),
      validateUsername(form.username),
      validateEmail(form.email),
      validatePassword(form.password),
    );
    if (err) { setError(err); return; }
    setLoading(true);
    try {
      const res = await apiFetch("/api/owner/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create admin.");
        return;
      }
      downloadCredentialsPdf({
        role: "Admin",
        displayName: form.displayName,
        username: form.username,
        password: form.password,
        email: form.email,
      });
      setOpen(false);
      setForm({ username: "", password: "", displayName: "", email: "" });
      setTouched(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} data-wt="create-admin-btn">New Admin</Button>
      <Modal ref={modalRef} open={open} onClose={() => { setOpen(false); setTouched(false); }} title="Create Admin Account" isDirty={touched}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Display name"
              value={form.displayName}
              onChange={(e) => handleChange("displayName", e.target.value)}
              placeholder="Full name"
              autoComplete="off"
              maxLength={50}
              required
            />
            <Input
              label="Username"
              value={form.username}
              onChange={(e) => handleChange("username", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              placeholder="e.g. john_smith"
              autoComplete="off"
              minLength={3}
              maxLength={30}
              hint="3–30 characters. Letters, numbers, and underscores only."
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Password"
              type="password"
              showToggle
              value={form.password}
              onChange={(e) => handleChange("password", e.target.value)}
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              hint="The admin will be prompted to change this on first login."
              required
            />
            <Input
              label="Email"
              type="text"
              inputMode="email"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="admin@example.com"
              autoComplete="off"
              hint="A verification code will be sent here."
              maxLength={255}
              required
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => modalRef.current?.attemptClose()}>Cancel</Button>
            <Button type="submit" loading={loading}>Create admin</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
