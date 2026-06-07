"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Badge } from "@/components/ui/badge";
import { ComboSelect } from "@/components/ui/combo-select";
import { UserPlus, X, Settings } from "lucide-react";
import {
  DEFAULT_CONTRIBUTOR_PERMISSIONS,
  PERMISSION_LABELS,
  parsePermissions,
  type ContributorPermissions,
} from "@/lib/contributor-permissions";

interface AssignedContributor {
  id: string;
  displayName: string;
  email: string;
  username: string;
  permissions: ContributorPermissions;
}

interface Props {
  projectId: string;
  assignedContributors: AssignedContributor[];
}

function PermissionsForm({
  value,
  onChange,
}: {
  value: ContributorPermissions;
  onChange: (p: ContributorPermissions) => void;
}) {
  return (
    <div className="space-y-2">
      {(Object.keys(PERMISSION_LABELS) as Array<keyof ContributorPermissions>).map((key) => {
        const locked = key === "canViewContent";
        return (
          <label key={key} className={`flex items-center gap-2.5 ${locked ? "cursor-not-allowed" : "cursor-pointer"}`}>
            <input
              type="checkbox"
              checked={locked ? true : value[key]}
              disabled={locked}
              onChange={(e) => !locked && onChange({ ...value, [key]: e.target.checked })}
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
  );
}

export function AssignContributorsButton({ projectId, assignedContributors }: Props) {
  const router = useRouter();
  const [assignOpen, setAssignOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AssignedContributor | null>(null);
  const [removeTarget, setRemoveTarget] = useState<AssignedContributor | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [assignPerms, setAssignPerms] = useState<ContributorPermissions>({ ...DEFAULT_CONTRIBUTOR_PERMISSIONS });
  const [editPerms, setEditPerms] = useState<ContributorPermissions>({ ...DEFAULT_CONTRIBUTOR_PERMISSIONS });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function openAssign() {
    setError("");
    setSelectedId("");
    setAssignPerms({ ...DEFAULT_CONTRIBUTOR_PERMISSIONS });
    setAssignOpen(true);
  }

  function openEdit(c: AssignedContributor) {
    setEditPerms(parsePermissions(c.permissions));
    setEditTarget(c);
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

  async function doEditPermissions(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setLoading(true);
    try {
      await apiFetch(`/api/client/contributors/${editTarget.id}/assignment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, permissions: editPerms }),
      });
      setEditTarget(null);
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

  const activePermKeys = (p: ContributorPermissions) =>
    (Object.keys(PERMISSION_LABELS) as Array<keyof ContributorPermissions>).filter((k) => p[k]);

  return (
    <>
      <div className="space-y-3">
        {assignedContributors.length === 0 ? (
          <p className="text-sm text-slate-500">No contributors assigned to this project.</p>
        ) : (
          <div className="space-y-3">
            {assignedContributors.map((c) => {
              const active = activePermKeys(c.permissions);
              return (
                <div key={c.id} className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{c.displayName}</p>
                    <p className="text-xs text-slate-500 truncate">@{c.username} · {c.email}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {active.length === 0 ? (
                        <span className="text-xs text-slate-400">No permissions</span>
                      ) : (
                        active.map((k) => (
                          <Badge key={k} variant="outline" className="text-xs py-0">
                            {PERMISSION_LABELS[k]}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(c)}
                      title="Edit permissions"
                    >
                      <Settings size={13} />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:border-red-300"
                      onClick={() => setRemoveTarget(c)}
                      disabled={loading}
                    >
                      <X size={13} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Button variant="outline" size="sm" className="gap-1.5" onClick={openAssign}>
          <UserPlus size={14} />
          Assign Contributor
        </Button>
      </div>

      {/* Assign modal */}
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
            <PermissionsForm value={assignPerms} onChange={setAssignPerms} />
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

      {/* Edit permissions modal */}
      <Modal
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title={`Permissions — ${editTarget?.displayName}`}
        size="sm"
        busy={loading}
      >
        <form onSubmit={doEditPermissions} className="space-y-4">
          <PermissionsForm value={editPerms} onChange={setEditPerms} />
          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button type="submit" loading={loading}>Save</Button>
          </div>
        </form>
      </Modal>

      {/* Remove confirm */}
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
