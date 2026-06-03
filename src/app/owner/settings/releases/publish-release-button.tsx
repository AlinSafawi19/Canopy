"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalRef } from "@/components/ui/modal";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

export function PublishReleaseButton() {
  const router = useRouter();
  const modalRef = useRef<ModalRef>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ version: "", title: "", notes: "" });

  function reset() {
    setForm({ version: "", title: "", notes: "" });
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const notesEmpty = !form.notes.trim() || form.notes.trim() === "<p></p>";
    if (!form.version.trim() || !form.title.trim() || notesEmpty) {
      setError("All fields are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/owner/releases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to publish."); return; }
      setOpen(false);
      reset();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Publish Release</Button>
      <Modal ref={modalRef} open={open} onClose={() => { setOpen(false); reset(); }} title="Publish Release">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Version"
              value={form.version}
              onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
              placeholder="e.g. 1.2.0"
              required
            />
            <Input
              label="Title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Performance improvements"
              required
            />
          </div>

          <RichTextEditor
            label="Release notes"
            value={form.notes}
            onChange={(html) => setForm((f) => ({ ...f, notes: html }))}
            placeholder="Describe what's new in this release…"
            minHeight="160px"
          />

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => modalRef.current?.attemptClose()}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Publish &amp; notify users
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
