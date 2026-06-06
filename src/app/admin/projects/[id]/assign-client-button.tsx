"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { ComboSelect } from "@/components/ui/combo-select";
import { UserPlus, X } from "lucide-react";

interface AssignedClient {
  id: string;
  displayName: string;
  email: string;
  username: string;
}

interface Props {
  projectId: string;
  assignedClient: AssignedClient | null;
}

export function AssignClientButton({ projectId, assignedClient }: Props) {
  const router = useRouter();
  const [assignOpen, setAssignOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [selectedLabel, setSelectedLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function doAssign(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!selectedId) { setError("Please select a client."); return; }
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/projects/${projectId}/assignment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: selectedId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to assign client");
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

  async function doRemove() {
    setLoading(true);
    try {
      await apiFetch(`/api/admin/projects/${projectId}/assignment`, { method: "DELETE" });
      setRemoveOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {assignedClient ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{assignedClient.displayName}</p>
            <p className="text-xs text-slate-500 truncate">@{assignedClient.username} · {assignedClient.email}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={() => { setSelectedId(""); setSelectedLabel(""); setAssignOpen(true); }}
          >
            Change
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:border-red-300 shrink-0"
            onClick={() => setRemoveOpen(true)}
          >
            <X size={14} />
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="md" className="gap-1.5" onClick={() => setAssignOpen(true)}>
          <UserPlus size={14} />
          Assign client
        </Button>
      )}

      <Modal open={assignOpen} onClose={() => { setAssignOpen(false); setError(""); setSelectedId(""); setSelectedLabel(""); }} title="Assign Client" size="sm">
        <form onSubmit={doAssign} className="space-y-4">
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
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => { setAssignOpen(false); setError(""); setSelectedId(""); setSelectedLabel(""); }}>
              Cancel
            </Button>
            <Button type="submit" loading={loading} disabled={!selectedId}>
              Assign
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        onConfirm={doRemove}
        title="Remove Assignment"
        message={`Remove "${assignedClient?.displayName}" from this project? They will lose access.`}
        confirmLabel="Remove"
        variant="danger"
        loading={loading}
      />
    </>
  );
}
