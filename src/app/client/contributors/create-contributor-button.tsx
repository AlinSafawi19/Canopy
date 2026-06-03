"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalRef } from "@/components/ui/modal";
import { ComboSelect } from "@/components/ui/combo-select";
import { validateUsername, validatePassword, validateEmail, validateDisplayName, firstError } from "@/lib/validation";
import { downloadCredentialsPdf } from "@/lib/credentials-pdf";

export function CreateContributorButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const modalRef = useRef<ModalRef>(null);
  const submittingRef = useRef(false);
  const [form, setForm] = useState({ username: "", password: "", displayName: "", email: "", projectId: "" });

  function reset() {
    setForm({ username: "", password: "", displayName: "", email: "", projectId: "" });
    setError("");
    setTouched(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submittingRef.current) return;
    setError("");
    const err = firstError(
      validateDisplayName(form.displayName),
      validateUsername(form.username),
      validateEmail(form.email),
      validatePassword(form.password),
    );
    if (err) { setError(err); return; }
    if (!form.projectId) { setError("Project is required."); return; }
    setLoading(true);
    submittingRef.current = true;
    try {
      const res = await apiFetch("/api/client/contributors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create contributor."); return; }
      downloadCredentialsPdf({
        role: "Contributor",
        displayName: form.displayName,
        username: form.username,
        password: form.password,
        email: form.email,
      });
      setOpen(false);
      reset();
      router.refresh();
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>New Contributor</Button>
      <Modal ref={modalRef} open={open} onClose={() => { setOpen(false); reset(); }} title="Add Contributor" isDirty={touched}>
        <form onSubmit={handleSubmit} className="space-y-4" onInput={() => setTouched(true)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Display name"
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              placeholder="Full name"
              autoComplete="off"
              maxLength={50}
              required
            />
            <Input
              label="Username"
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") }))}
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
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              autoComplete="new-password"
              hint="The contributor will be prompted to change this on first login."
              required
            />
            <Input
              label="Email"
              type="text"
              inputMode="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="contributor@example.com"
              autoComplete="off"
              hint="A verification code will be sent here."
              maxLength={255}
              required
            />
          </div>

          <ComboSelect
            endpoint="/api/client/selects/projects"
            value={form.projectId}
            onChange={(id) => { setForm((f) => ({ ...f, projectId: id })); setTouched(true); }}
            label="Project"
            placeholder="— select a project —"
            required
          />

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => modalRef.current?.attemptClose()}>Cancel</Button>
            <Button type="submit" loading={loading}>Add contributor</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
