"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ActionMenu, ActionMenuItem } from "@/components/ui/action-menu";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { ComboSelect } from "@/components/ui/combo-select";
import {
  DEFAULT_CONTRIBUTOR_PERMISSIONS,
  PERMISSION_LABELS,
  type ContributorPermissions,
} from "@/lib/contributor-permissions";

interface Contributor {
  id: string;
  displayName: string;
  email: string;
  username: string;
}

interface Props {
  projectId: string;
  assignedContributors: Contributor[];
}

export function ProjectContributorsButton({ projectId, assignedContributors }: Props) {
  const router = useRouter();
  const [assignOpen, setAssignOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Contributor | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [assignPerms, setAssignPerms] = useState<ContributorPermissions>({ ...DEFAULT_CONTRIBUTOR_PERMISSIONS });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function openAssign() {
    setError("");
    setSelectedId("");
    setAssignPerms({ ...DEFAULT_CONTRIBUTOR_PERMISSIONS });
    setAssignOpen(true);
  }

  async function doAssign(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!selectedId) { setError("Please select a contributor."); return; }
    setLoading(true);
    try {
      const res = await apiFetch(`/api/client/contributors/${selectedId}/assignment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, permissions: assignPerms }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to assign contributor");
        return;
      }
      setAssignOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function doRemove() {
    if (!removeTarget) return;
    setLoading(true);
    await apiFetch(`/api/client/contributors/${removeTarget.id}/assignment?projectId=${projectId}`, {
      method: "DELETE",
    });
    setLoading(false);
    setRemoveTarget(null);
    router.refresh();
  }

  return (
    <>
      <ActionMenu>
        <ActionMenuItem onClick={openAssign}>
          Assign Contributor
        </ActionMenuItem>
        {assignedContributors.map((c) => (
          <ActionMenuItem
            key={c.id}
            variant="warning"
            onClick={() => setRemoveTarget(c)}
            disabled={loading}
          >
            Remove {c.displayName}
          </ActionMenuItem>
        ))}
      </ActionMenu>

      <Modal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Assign Contributor"
        size="sm"
        busy={loading}
      >
        <form onSubmit={doAssign} className="space-y-4">
          <ComboSelect
            endpoint="/api/client/selects/contributors"
            extraParams={{ excludeProjectId: projectId }}
            value={selectedId}
            onChange={(id) => setSelectedId(id)}
            label="Select contributor"
            placeholder="— choose a contributor —"
            required
          />
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-slate-700">Permissions</p>
            <div className="space-y-2">
              {(Object.keys(PERMISSION_LABELS) as Array<keyof ContributorPermissions>).map((key) => {
                const locked = key === "canViewContent";
                return (
                  <label key={key} className={`flex items-center gap-2.5 ${locked ? "cursor-not-allowed" : "cursor-pointer"}`}>
                    <input
                      type="checkbox"
                      checked={locked ? true : assignPerms[key]}
                      disabled={locked}
                      onChange={(e) => !locked && setAssignPerms({ ...assignPerms, [key]: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-60"
                    />
                    <span className={`text-sm ${locked ? "text-slate-400" : "text-slate-700"}`}>
                      {PERMISSION_LABELS[key]}
                      {locked && <span className="ml-1 text-xs text-slate-400">(always on)</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button type="submit" loading={loading} disabled={!selectedId}>Assign</Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        onConfirm={doRemove}
        title="Remove Contributor"
        message={`Remove "${removeTarget?.displayName}" from this project? They will lose access.`}
        confirmLabel="Remove"
        variant="warning"
        loading={loading}
      />
    </>
  );
}
