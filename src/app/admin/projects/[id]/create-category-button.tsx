"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Modal, ModalRef } from "@/components/ui/modal";
import { LIMITS } from "@/lib/limits";

export function CreateCategoryButton({ projectId, basePath = "/api/admin/projects" }: { projectId: string; basePath?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", slug: "", description: "" });
  const [touched, setTouched] = useState(false);
  const modalRef = useRef<ModalRef>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) { setError("Category name is required."); return; }
    setLoading(true);
    try {
      const res = await apiFetch(`${basePath}/${projectId}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed"); return; }
      setOpen(false);
      setForm({ name: "", slug: "", description: "" });
      setTouched(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Add Category
      </Button>
      <Modal ref={modalRef} open={open} onClose={() => { setOpen(false); setTouched(false); }} title="Create Category" size="sm" isDirty={touched}>
        <form onSubmit={handleSubmit} className="space-y-4" onInput={() => setTouched(true)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Name" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required maxLength={LIMITS.CATEGORY_NAME} />
            <Input label="Slug" value={form.slug} onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="optional" maxLength={LIMITS.CATEGORY_SLUG} />
          </div>
          <Textarea label="Description" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={2} maxLength={LIMITS.CATEGORY_DESCRIPTION} />
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => modalRef.current?.attemptClose()}>Cancel</Button>
            <Button type="submit" loading={loading}>Create</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
