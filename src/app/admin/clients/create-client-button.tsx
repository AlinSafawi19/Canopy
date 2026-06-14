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

interface Props { tenantId: string }

export function CreateClientButton({ tenantId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [createdName, setCreatedName] = useState("");
  const modalRef = useRef<ModalRef>(null);
  const submittingRef = useRef(false);
  const [form, setForm] = useState({ username: "", name: "", email: "", projectId: "", representativeName: "", representativeDesignation: "" });

  function reset() {
    setForm({ username: "", name: "", email: "", projectId: "", representativeName: "", representativeDesignation: "" });
    setError("");
    setTouched(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submittingRef.current) return;
    setError("");
    const err = firstError(
      validateDisplayName(form.name),
      validateUsername(form.username),
      validateEmail(form.email),
    );
    if (err) { setError(err); return; }
    setLoading(true);
    submittingRef.current = true;
    try {
      const res = await apiFetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.username, name: form.name, email: form.email, tenantId, representativeName: form.representativeName || undefined, representativeDesignation: form.representativeDesignation || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create client."); return; }

      if (form.projectId) {
        await apiFetch(`/api/admin/projects/${form.projectId}/assignment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: data.id }),
        });
      }

      setInviteUrl(`${window.location.origin}/invite?token=${data.inviteToken}`);
      setCreatedName(form.name);
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
      <Button onClick={() => setOpen(true)}>New Client</Button>

      <Modal ref={modalRef} open={open} onClose={() => { setOpen(false); reset(); }} title="Create Client" isDirty={touched} busy={loading}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => modalRef.current?.attemptClose()}>Cancel</Button>
            <Button type="submit" form="create-client-form" loading={loading}>Create & get invite link</Button>
          </div>
        }
      >
        <form id="create-client-form" onSubmit={handleSubmit} className="space-y-4" onInput={() => setTouched(true)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Company or client name"
              autoComplete="off"
              maxLength={100}
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
            placeholder="client@example.com"
            autoComplete="off"
            hint="An invite link will be generated for them to set their password."
            maxLength={255}
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Representative Name"
              value={form.representativeName}
              onChange={(e) => setForm((f) => ({ ...f, representativeName: e.target.value }))}
              placeholder="e.g. John Smith"
              autoComplete="off"
              maxLength={100}
            />
            <Input
              label="Representative Designation"
              value={form.representativeDesignation}
              onChange={(e) => setForm((f) => ({ ...f, representativeDesignation: e.target.value }))}
              placeholder="e.g. CEO"
              autoComplete="off"
              maxLength={100}
            />
          </div>
          <ComboSelect
            endpoint="/api/admin/selects/projects"
            extraParams={{ unassigned: "true" }}
            value={form.projectId}
            onChange={(id) => { setForm((f) => ({ ...f, projectId: id })); setTouched(true); }}
            label="Assign to project"
            placeholder="— none (optional) —"
          />
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
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
