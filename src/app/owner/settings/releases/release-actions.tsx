"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-fetch";
import { PublishReleaseButton } from "./publish-release-button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Pencil, Trash2, Archive, Globe, FileText } from "lucide-react";

interface Release {
  id: string;
  version: string;
  title: string;
  notes: string;
  status: string;
}

export function ReleaseActions({ release }: { release: Release }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  async function patch(data: Record<string, string>) {
    setLoading(data.status ?? "saving");
    await apiFetch(`/api/owner/releases/${release.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).catch(() => {});
    setLoading(null);
    router.refresh();
  }

  async function handleDelete() {
    setLoading("delete");
    await apiFetch(`/api/owner/releases/${release.id}`, { method: "DELETE" }).catch(() => {});
    setLoading(null);
    router.refresh();
  }

  return (
    <>
      {/* Edit */}
      <button
        title="Edit"
        onClick={() => setEditOpen(true)}
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
      >
        <Pencil size={14} />
      </button>

      {/* Publish / Unpublish */}
      {release.status === "draft" && (
        <button
          title="Publish"
          disabled={loading === "published"}
          onClick={() => patch({ status: "published" })}
          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-40"
        >
          <Globe size={14} />
        </button>
      )}
      {release.status === "published" && (
        <button
          title="Revert to draft"
          disabled={loading === "draft"}
          onClick={() => patch({ status: "draft" })}
          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-40"
        >
          <FileText size={14} />
        </button>
      )}

      {/* Archive / Unarchive */}
      {release.status !== "archived" ? (
        <button
          title="Archive"
          disabled={loading === "archived"}
          onClick={() => patch({ status: "archived" })}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40"
        >
          <Archive size={14} />
        </button>
      ) : (
        <button
          title="Restore"
          disabled={loading === "draft"}
          onClick={() => patch({ status: "draft" })}
          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-40"
        >
          <Globe size={14} />
        </button>
      )}

      {/* Delete */}
      <button
        title="Delete"
        onClick={() => setDeleteOpen(true)}
        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
      >
        <Trash2 size={14} />
      </button>

      {/* Edit modal */}
      <PublishReleaseButton
        editRelease={release}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />

      {/* Delete confirm */}
      <ConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete release"
        message={`Are you sure you want to delete "${release.title}" (${release.version})? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={loading === "delete"}
      />
    </>
  );
}
