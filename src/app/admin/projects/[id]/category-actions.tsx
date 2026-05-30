"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionMenu, ActionMenuItem } from "@/components/ui/action-menu";
import { ConfirmModal } from "@/components/ui/confirm-modal";

interface Category { id: string; name: string; archivedAt: Date | null }

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  variant: "danger" | "warning";
  run: () => Promise<void>;
};

export function CategoryActions({ category, projectId, basePath = "/api/admin/projects" }: { category: Category; projectId: string; basePath?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

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
