"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Modal, ModalRef } from "@/components/ui/modal";
import { ActionMenu, ActionMenuItem } from "@/components/ui/action-menu";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { LIMITS } from "@/lib/limits";

interface Category {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  previewUrl?: string | null;
  archivedAt: Date | null;
}

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  variant: "danger" | "warning";
  run: () => Promise<void>;
};

export function CategoryActions({
  category,
  projectId,
  basePath = "/api/admin/projects",
}: {
  category: Category;
  projectId: string;
  basePath?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  const [editError, setEditError] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const editModalRef = useRef<ModalRef>(null);
  const [form, setForm] = useState({
    name: category.name,
    slug: category.slug ?? "",
    description: category.description ?? "",
    previewUrl: category.previewUrl ?? "",
  });

  function openEdit() {
    setForm({
      name: category.name,
      slug: category.slug ?? "",
      description: category.description ?? "",
      previewUrl: category.previewUrl ?? "",
    });
    setEditError("");
    setTouched(false);
    setEditOpen(true);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setEditError("Name is required"); return; }
    setEditLoading(true);
    setEditError("");
    const res = await apiFetch(`${basePath}/${projectId}/categories/${category.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        slug: form.slug.trim() || null,
        description: form.description.trim() || null,
        previewUrl: form.previewUrl.trim() || null,
      }),
    });
    setEditLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setEditError(data.error ?? "Failed to save");
      return;
    }
    setEditOpen(false);
    setTouched(false);
    router.refresh();
  }

  async function doArchive() {
    setLoading(true);
    await apiFetch(`${basePath}/${projectId}/categories/${category.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive" }),
    });
    setLoading(false);
    setConfirm(null);
    router.refresh();
  }

  async function doRestore() {
    setLoading(true);
    await apiFetch(`${basePath}/${projectId}/categories/${category.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore" }),
    });
    setLoading(false);
    router.refresh();
  }

  async function doDelete() {
    setLoading(true);
    await apiFetch(`${basePath}/${projectId}/categories/${category.id}`, { method: "DELETE" });
    setLoading(false);
    setConfirm(null);
    router.refresh();
  }

  return (
    <>
      <ActionMenu>
        <ActionMenuItem onClick={openEdit} disabled={loading}>
          Edit
        </ActionMenuItem>
        <ActionMenuItem
          variant={category.archivedAt ? "success" : "warning"}
          onClick={category.archivedAt
            ? doRestore
            : () => setConfirm({
                title: "Archive Category",
                message: `Archive "${category.name}"? Contributors won't be able to add entries until it's restored.`,
                confirmLabel: "Archive",
                variant: "warning",
                run: doArchive,
              })}
          disabled={loading}
        >
          {category.archivedAt ? "Restore" : "Archive"}
        </ActionMenuItem>
        <ActionMenuItem
          variant="danger"
          onClick={() => setConfirm({
            title: "Delete Category",
            message: `Delete "${category.name}"? All entries within this category will also be permanently deleted.`,
            confirmLabel: "Delete",
            variant: "danger",
            run: doDelete,
          })}
          disabled={loading}
        >
          Delete
        </ActionMenuItem>
      </ActionMenu>

      <Modal ref={editModalRef} open={editOpen} onClose={() => { setEditOpen(false); setTouched(false); }} title="Edit Category" size="sm" isDirty={touched} busy={editLoading}>
        <form onSubmit={saveEdit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => { setForm(f => ({ ...f, name: e.target.value })); setTouched(true); }}
              required
              maxLength={LIMITS.CATEGORY_NAME}
            />
            <Input
              label="Slug"
              value={form.slug}
              onChange={(e) => { setForm(f => ({ ...f, slug: e.target.value })); setTouched(true); }}
              placeholder="optional"
              maxLength={LIMITS.CATEGORY_SLUG}
            />
          </div>
          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => { setForm(f => ({ ...f, description: e.target.value })); setTouched(true); }}
            rows={2}
            maxLength={LIMITS.CATEGORY_DESCRIPTION}
          />
          <div>
            <Input
              label="Preview URL"
              value={form.previewUrl}
              onChange={(e) => { setForm(f => ({ ...f, previewUrl: e.target.value })); setTouched(true); }}
              placeholder="https://mysite.com/blog/{slug}"
              maxLength={LIMITS.CATEGORY_PREVIEW_URL}
            />
            <p className="text-xs text-slate-400 mt-1">
              Use <code className="font-mono bg-slate-100 px-1 rounded">{"{entryId}"}</code> or any field name like <code className="font-mono bg-slate-100 px-1 rounded">{"{slug}"}</code> — replaced per row when previewing.
            </p>
          </div>
          {editError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{editError}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => editModalRef.current?.attemptClose()}>Cancel</Button>
            <Button type="submit" loading={editLoading}>Save</Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm?.run()}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        confirmLabel={confirm?.confirmLabel}
        variant={confirm?.variant}
        loading={loading}
      />
    </>
  );
}
