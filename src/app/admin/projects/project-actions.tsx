"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionMenu, ActionMenuItem } from "@/components/ui/action-menu";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ComboSelect } from "@/components/ui/combo-select";
import { EditProjectButton } from "./[id]/edit-project-button";

interface Client {
  id: string;
  displayName: string;
  username: string;
  email: string;
}

interface Project {
  id: string;
  name: string;
  slug: string | null;
  description: string;
  shortDescription: string | null;
  industry: string | null;
  status: string;
  role: string | null;
  teamSize: string | null;
  featured: boolean;
  domain: string | null;
  host: string | null;
  liveUrl: string | null;
  githubUrl: string | null;
  previewUrl: string | null;
  imageBg: string | null;
  videoBg: string | null;
  coverImageAlt: string | null;
  techStack: string[];
  highlights: string[];
  startDate: string | null;
  endDate: string | null;
  archivedAt: Date | null;
}

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  variant: "danger" | "warning";
  run: () => Promise<void>;
};

interface Props {
  project: Project;
  assignedClient: Client | null;
}

export function ProjectActions({ project, assignedClient }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [selectedLabel, setSelectedLabel] = useState("");
  const [assignError, setAssignError] = useState("");

  async function doArchive() {
    setLoading(true);
    await apiFetch(`/api/admin/projects/${project.id}`, {
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
    setConfirm(null);
    router.refresh();
  }

  async function doAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setLoading(true);
    setAssignError("");
    try {
      const res = await apiFetch(`/api/admin/projects/${project.id}/assignment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: selectedId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setAssignError(data.error ?? "Failed to assign client");
        return;
      }
      setAssignOpen(false);
      setSelectedId("");
      setSelectedLabel("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function doRemoveAssignment() {
    setLoading(true);
    await apiFetch(`/api/admin/projects/${project.id}/assignment`, { method: "DELETE" });
    setLoading(false);
    setConfirm(null);
    router.refresh();
  }

  return (
    <>
      <ActionMenu>
        <ActionMenuItem onClick={() => setEditOpen(true)}>
          Edit
        </ActionMenuItem>
        <ActionMenuItem
          onClick={() => { setSelectedId(""); setSelectedLabel(""); setAssignError(""); setAssignOpen(true); }}
        >
          {assignedClient ? "Change Client" : "Assign Client"}
        </ActionMenuItem>
        {assignedClient && (
          <ActionMenuItem
            variant="warning"
            onClick={() => setConfirm({
              title: "Remove Assignment",
              message: `Remove "${assignedClient.displayName}" from "${project.name}"? They will lose access.`,
              confirmLabel: "Remove",
              variant: "warning",
              run: doRemoveAssignment,
            })}
            disabled={loading}
          >
            Remove Client
          </ActionMenuItem>
        )}
        <ActionMenuItem
          variant={project.archivedAt ? "success" : "warning"}
          onClick={project.archivedAt
            ? doRestore
            : () => setConfirm({
                title: "Archive Project",
                message: `Archive "${project.name}"? It will be hidden from clients until restored.`,
                confirmLabel: "Archive",
                variant: "warning",
                run: doArchive,
              })}
          disabled={loading}
        >
          {project.archivedAt ? "Restore" : "Archive"}
        </ActionMenuItem>
        <ActionMenuItem
          variant="danger"
          onClick={() => setConfirm({
            title: "Delete Project",
            message: `Delete "${project.name}"? This will permanently remove all categories and entries and cannot be undone.`,
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
        onClose={() => { setAssignOpen(false); setAssignError(""); setSelectedId(""); setSelectedLabel(""); }}
        title={assignedClient ? "Change Client" : "Assign Client"}
        size="sm"
      >
        <form onSubmit={doAssign} className="space-y-4">
          {assignedClient && (
            <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
              Currently assigned: <span className="font-medium text-slate-800">{assignedClient.displayName}</span>
            </div>
          )}
          <ComboSelect
            endpoint="/api/admin/selects/clients"
            extraParams={assignedClient ? { excludeId: assignedClient.id } : {}}
            value={selectedId}
            onChange={(id, label) => { setSelectedId(id); setSelectedLabel(label); }}
            initialLabel={selectedLabel}
            label="Select client"
            placeholder="— choose a client —"
            required
          />
          {assignError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{assignError}</p>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => { setAssignOpen(false); setAssignError(""); setSelectedId(""); setSelectedLabel(""); }}>
              Cancel
            </Button>
            <Button type="submit" loading={loading} disabled={!selectedId}>
              {assignedClient ? "Change" : "Assign"}
            </Button>
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

      <EditProjectButton
        project={project}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />
    </>
  );
}
