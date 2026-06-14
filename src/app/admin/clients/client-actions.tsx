"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ActionMenu, ActionMenuItem } from "@/components/ui/action-menu";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { ComboSelect } from "@/components/ui/combo-select";
import { X } from "lucide-react";

interface Project { id: string; name: string }
interface Client { id: string; name: string; archivedAt: Date | null }

interface Props {
  client: Client;
  assignedProjects: Project[];
}

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  variant: "danger" | "warning";
  run: () => Promise<void>;
};

export function ClientActions({ client, assignedProjects }: Props) {
  const router = useRouter();
  const [assignOpen, setAssignOpen] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function doArchive() {
    setLoading(true);
    await apiFetch(`/api/admin/clients/${client.id}`, {
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
    await apiFetch(`/api/admin/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore" }),
    });
    setLoading(false);
    router.refresh();
  }

  async function doDelete() {
    setLoading(true);
    await apiFetch(`/api/admin/clients/${client.id}`, { method: "DELETE" });
    setLoading(false);
    setConfirm(null);
    router.refresh();
  }

  async function doAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProjectId) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/api/admin/projects/${selectedProjectId}/assignment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to assign");
        return;
      }
      setSelectedProjectId("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function doRemoveAssignment(projectId: string) {
    setLoading(true);
    await apiFetch(`/api/admin/projects/${projectId}/assignment`, { method: "DELETE" });
    setLoading(false);
    router.refresh();
  }

  return (
    <>
      <ActionMenu>
        <ActionMenuItem onClick={() => { setError(""); setSelectedProjectId(""); setAssignOpen(true); }}>
          {assignedProjects.length > 0 ? "Manage Projects" : "Assign to Project"}
        </ActionMenuItem>
        <ActionMenuItem
          variant={client.archivedAt ? "success" : "warning"}
          onClick={client.archivedAt
            ? doRestore
            : () => setConfirm({
                title: "Archive Client",
                message: `Archive "${client.name}"? They won't be able to sign in until restored.`,
                confirmLabel: "Archive",
                variant: "warning",
                run: doArchive,
              })}
          disabled={loading}
        >
          {client.archivedAt ? "Restore" : "Archive"}
        </ActionMenuItem>
        <ActionMenuItem
          variant="danger"
          onClick={() => setConfirm({
            title: "Delete Client",
            message: `Permanently delete "${client.name}"? This cannot be undone.`,
            confirmLabel: "Delete",
            variant: "danger",
            run: doDelete,
          })}
          disabled={loading}
        >
          Delete
        </ActionMenuItem>
      </ActionMenu>

      <Modal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title={`Projects — ${client.name}`}
        size="sm"
        busy={loading}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button type="submit" form="client-assign-project-form" loading={loading} disabled={!selectedProjectId}>Assign</Button>
          </div>
        }
      >
        <div className="space-y-4">
          {assignedProjects.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Assigned</p>
              <div className="space-y-1.5">
                {assignedProjects.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <span className="text-sm font-medium text-slate-800 truncate">{p.name}</span>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => doRemoveAssignment(p.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50 flex-shrink-0"
                      title="Remove assignment"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <form id="client-assign-project-form" onSubmit={doAssign} className="space-y-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              {assignedProjects.length > 0 ? "Add another project" : "Assign to project"}
              <span className="text-red-500 ml-0.5">*</span>
            </p>
            <ComboSelect
              endpoint="/api/admin/selects/projects"
              extraParams={{ unassigned: "true" }}
              value={selectedProjectId}
              onChange={(id) => setSelectedProjectId(id)}
              placeholder="— choose a project —"
            />
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          </form>
        </div>
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
