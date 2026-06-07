"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalRef } from "@/components/ui/modal";
import { ComboSelect } from "@/components/ui/combo-select";
import { InviteLinkPopup } from "@/components/ui/invite-link-popup";
import { validateUsername, validateEmail, validateDisplayName, firstError } from "@/lib/validation";

export function CreateContributorButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [createdName, setCreatedName] = useState("");
  const modalRef = useRef<ModalRef>(null);
  const submittingRef = useRef(false);
  const [form, setForm] = useState({ username: "", displayName: "", email: "", projectId: "" });

  function reset() {
    setForm({ username: "", displayName: "", email: "", projectId: "" });
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
      setInviteUrl(`${window.location.origin}/invite?token=${data.inviteToken}`);
      setCreatedName(form.displayName);
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

      <Modal ref={modalRef} open={open} onClose={() => { setOpen(false); reset(); }} title="Add Contributor" isDirty={touched} busy={loading}>
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
          <Input
            label="Email"
            type="text"
            inputMode="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="contributor@example.com"
            autoComplete="off"
            hint="An invite link will be generated for them to set their password."
            maxLength={255}
            required
          />
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
            <Button type="submit" loading={loading}>Create & get invite link</Button>
          </div>
        </form>
      </Modal>

      {inviteUrl && (
        <InviteLinkPopup
          inviteUrl={inviteUrl}
          displayName={createdName}
          onClose={() => setInviteUrl("")}
        />
      )}
    </>
  );
}
