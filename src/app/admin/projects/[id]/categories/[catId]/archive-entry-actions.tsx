"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ActionMenu, ActionMenuItem } from "@/components/ui/action-menu";
import { ConfirmModal } from "@/components/ui/confirm-modal";

export function ArchiveProjectActions({
  project,
}: {
  project: { id: string; name: string };
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function doRestore() {
    setLoading(true);
    await apiFetch(`/api/admin/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore" }),
    });
    setLoading(false);
    router.refresh();
  }

  async function doDelete() {
    setLoading(true);
    await apiFetch(`/api/admin/projects/${project.id}`, { method: "DELETE" });
    setLoading(false);
    setConfirmDelete(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="sm" className="h-7 px-2" onClick={doRestore} disabled={loading}>
        Restore
      </Button>
      <ActionMenu>
        <ActionMenuItem variant="danger" onClick={() => setConfirmDelete(true)} disabled={loading}>
          Delete
        </ActionMenuItem>
      </ActionMenu>
      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={doDelete}
        title="Delete Project"
        message={`Permanently delete "${project.name}" and all its categories and entries? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={loading}
      />
    </div>
  );
}

export function ArchiveCategoryActions({
  category,
  projectId,
  basePath = "/api/admin/projects",
}: {
  category: { id: string; name: string };
  projectId: string;
  basePath?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const url = `${basePath}/${projectId}/categories/${category.id}`;

  async function doRestore() {
    setLoading(true);
    await apiFetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore" }),
    });
    setLoading(false);
    router.refresh();
  }

  async function doDelete() {
    setLoading(true);
    await apiFetch(url, { method: "DELETE" });
    setLoading(false);
    setConfirmDelete(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="sm" className="h-7 px-2" onClick={doRestore} disabled={loading}>
        Restore
      </Button>
      <ActionMenu>
        <ActionMenuItem variant="danger" onClick={() => setConfirmDelete(true)} disabled={loading}>
          Delete
        </ActionMenuItem>
      </ActionMenu>
      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={doDelete}
        title="Delete Category"
        message={`Permanently delete "${category.name}" and all its entries? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={loading}
      />
    </div>
  );
}

export function ArchiveEntryActions({
  entry,
  categoryId,
  projectId,
  basePath = "/api/admin/projects",
  canRestore = true,
  canDelete = true,
}: {
  entry: { id: string };
  categoryId: string;
  projectId: string;
  basePath?: string;
  canRestore?: boolean;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const url = `${basePath}/${projectId}/categories/${categoryId}/entries/${entry.id}`;

  async function doRestore() {
    setLoading(true);
    await apiFetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore" }),
    });
    setLoading(false);
    router.refresh();
  }

  async function doDelete() {
    setLoading(true);
    await apiFetch(url, { method: "DELETE" });
    setLoading(false);
    setConfirmDelete(false);
    router.refresh();
  }

  if (!canRestore && !canDelete) return null;

  return (
    <div className="flex items-center gap-1">
      {canRestore && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2"
          onClick={doRestore}
          disabled={loading}
        >
          Restore
        </Button>
      )}
      {canDelete && (
        <ActionMenu>
          <ActionMenuItem
            variant="danger"
            onClick={() => setConfirmDelete(true)}
            disabled={loading}
          >
            Delete
          </ActionMenuItem>
        </ActionMenu>
      )}
      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={doDelete}
        title="Delete Entry"
        message="Permanently delete this archived entry? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={loading}
      />
    </div>
  );
}
