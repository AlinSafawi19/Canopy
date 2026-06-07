"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { ActionMenu, ActionMenuItem } from "@/components/ui/action-menu";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { validatePassword } from "@/lib/validation";

interface Contributor { id: string; displayName: string; archivedAt: Date | null }

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  variant: "danger" | "warning";
  run: () => Promise<void>;
};

export function ContributorActions({ contributor }: { contributor: Contributor }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");

  async function doArchive() {
    setLoading(true);
    await apiFetch(`/api/admin/contributors/${contributor.id}`, {
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
    await apiFetch(`/api/admin/contributors/${contributor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore" }),
    });
    setLoading(false);
    router.refresh();
  }

  async function doDelete() {
    setLoading(true);
    await apiFetch(`/api/admin/contributors/${contributor.id}`, { method: "DELETE" });
    setLoading(false);
    setConfirm(null);
    router.refresh();
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const pwErr = validatePassword(newPassword);
    if (pwErr) { setError(pwErr); return; }
    setLoading(true);
    const res = await apiFetch(`/api/admin/contributors/${contributor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset-password", newPassword }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to reset password");
      return;
    }
    setResetOpen(false);
    setNewPassword("");
    router.refresh();
  }

  return (
    <>
      <ActionMenu>
        <ActionMenuItem onClick={() => setResetOpen(true)}>
          Reset Password
        </ActionMenuItem>
        <ActionMenuItem
          variant={contributor.archivedAt ? "success" : "warning"}
          onClick={contributor.archivedAt
            ? doRestore
            : () => setConfirm({
                title: "Archive Contributor",
                message: `Archive "${contributor.displayName}"? They won't be able to sign in until restored.`,
                confirmLabel: "Archive",
                variant: "warning",
                run: doArchive,
              })}
          disabled={loading}
        >
          {contributor.archivedAt ? "Restore" : "Archive"}
        </ActionMenuItem>
        <ActionMenuItem
          variant="danger"
          onClick={() => setConfirm({
            title: "Delete Contributor",
            message: `Permanently delete "${contributor.displayName}"? This cannot be undone.`,
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

      <Modal open={resetOpen} onClose={() => { setResetOpen(false); setError(""); }} title={`Reset — ${contributor.displayName}`} size="sm" busy={loading}>
        <form onSubmit={resetPassword} className="space-y-4">
          <Input label="New Password" type="password" showToggle value={newPassword} onChange={e => { setNewPassword(e.target.value); setError(""); }} required />
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => { setResetOpen(false); setError(""); }}>Cancel</Button>
            <Button type="submit" loading={loading}>Reset</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
