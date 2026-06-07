"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalRef } from "@/components/ui/modal";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

interface ReleaseForm {
  version: string;
  title: string;
  notes: string;
}

interface Props {
  editRelease?: {
    id: string;
    version: string;
    title: string;
    notes: string;
    status: string;
  };
  onClose?: () => void;
  open?: boolean;
}

export function PublishReleaseButton({ editRelease, onClose, open: controlledOpen }: Props) {
  const router = useRouter();
  const modalRef = useRef<ModalRef>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<"draft" | "published" | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState<ReleaseForm>(
    editRelease
      ? { version: editRelease.version, title: editRelease.title, notes: editRelease.notes }
      : { version: "", title: "", notes: "" }
  );

  const isOpen = controlledOpen !== undefined ? controlledOpen : open;
  const isEdit = !!editRelease;

  function reset() {
    setForm({ version: "", title: "", notes: "" });
    setError("");
  }

  function handleClose() {
    if (onClose) { onClose(); }
    else { setOpen(false); reset(); }
  }

  async function handleSubmit(status: "draft" | "published") {
    const notesEmpty = !form.notes.trim() || form.notes.trim() === "<p></p>";
    if (!form.version.trim() || !form.title.trim() || notesEmpty) {
      setError("All fields are required.");
      return;
    }
    setLoading(status);
    setError("");
    try {
      const url = isEdit ? `/api/owner/releases/${editRelease!.id}` : "/api/owner/releases";
      const method = isEdit ? "PATCH" : "POST";
      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, status }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save."); return; }
      handleClose();
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      {!isEdit && (
        <Button onClick={() => setOpen(true)}>New Release</Button>
      )}
      <Modal
        ref={modalRef}
        open={isOpen}
        onClose={handleClose}
        title={isEdit ? "Edit Release" : "New Release"}
        size="lg"
        busy={loading !== null}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => modalRef.current?.attemptClose()}>
              Cancel
            </Button>
            <Button
              variant="outline"
              type="button"
              loading={loading === "draft"}
              disabled={loading === "published"}
              onClick={() => handleSubmit("draft")}
            >
              Save draft
            </Button>
            <Button
              type="button"
              loading={loading === "published"}
              disabled={loading === "draft"}
              onClick={() => handleSubmit("published")}
            >
              {isEdit && editRelease?.status === "published" ? "Save & republish" : "Publish & notify users"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
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
        </div>
      </Modal>
    </>
  );
}
