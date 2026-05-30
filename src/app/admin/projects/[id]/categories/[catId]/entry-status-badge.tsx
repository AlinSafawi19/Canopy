"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ConfirmModal } from "@/components/ui/confirm-modal";

export function EntryStatusBadge({
  entry,
  categoryId,
  projectId,
  basePath = "/api/admin/projects",
}: {
  entry: { id: string; archivedAt: Date | null };
  categoryId: string;
  projectId: string;
  basePath?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const baseUrl = `${basePath}/${projectId}/categories/${categoryId}/entries/${entry.id}`;
  const archived = !!entry.archivedAt;

  async function doArchive() {
    setLoading(true);
    await apiFetch(baseUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive" }),
    });
    setLoading(false);
    setConfirmOpen(false);
    router.refresh();
  }

  async function doRestore() {
    setLoading(true);
    await apiFetch(baseUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore" }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={archived ? doRestore : () => setConfirmOpen(true)}
        disabled={loading}
        title={archived ? "Click to restore" : "Click to archive"}
        className="disabled:opacity-50 transition-opacity hover:opacity-75"
      >
        {archived
          ? <Badge variant="danger">Archived</Badge>
          : <Badge variant="success">Active</Badge>}
      </button>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={doArchive}
        title="Archive Entry"
        message="Archive this entry? It will be hidden until restored."
        confirmLabel="Archive"
        variant="warning"
        loading={loading}
      />
    </>
  );
}
