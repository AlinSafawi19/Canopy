"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-fetch";
import { Badge } from "@/components/ui/badge";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2, Webhook, ToggleLeft, ToggleRight } from "lucide-react";

type WebhookEventKey = "entry.created" | "entry.updated" | "entry.archived";

const EVENT_LABELS: Record<WebhookEventKey, string> = {
  "entry.created": "Created",
  "entry.updated": "Updated",
  "entry.archived": "Archived",
};

export interface WebhookRow {
  id: string;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
  lastTriggeredAt: string | null;
  lastStatus: number | null;
}

interface Props {
  projectId: string;
  categoryId: string;
  initialWebhooks: WebhookRow[];
}

function StatusBadge({ status }: { status: number | null }) {
  if (status === null) return <span className="text-slate-400 text-xs">—</span>;
  if (status >= 200 && status < 300)
    return <Badge variant="success">{status}</Badge>;
  if (status === 0)
    return <Badge variant="danger">Timeout</Badge>;
  return <Badge variant="danger">{status}</Badge>;
}

export function WebhooksSection({ projectId, categoryId, initialWebhooks }: Props) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<WebhookRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(
        `/api/admin/projects/${projectId}/categories/${categoryId}/webhooks/${deleteTarget.id}`,
        { method: "DELETE" }
      );
      setDeleteTarget(null);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  const handleToggle = async (webhook: WebhookRow) => {
    setTogglingId(webhook.id);
    try {
      await apiFetch(
        `/api/admin/projects/${projectId}/categories/${categoryId}/webhooks/${webhook.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: !webhook.enabled }),
        }
      );
      router.refresh();
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>URL</TableHead>
            <TableHead>Events</TableHead>
            <TableHead>Last Status</TableHead>
            <TableHead>Last Triggered</TableHead>
            <TableHead className="sticky right-0 bg-slate-50"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {initialWebhooks.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-slate-400 py-8">
                <div className="flex flex-col items-center gap-2">
                  <Webhook size={20} className="text-slate-300" />
                  <span className="text-sm">No webhooks yet — add one to trigger revalidation on content changes</span>
                </div>
              </TableCell>
            </TableRow>
          )}
          {initialWebhooks.map((wh) => (
            <TableRow key={wh.id} className={wh.enabled ? "" : "opacity-50"}>
              <TableCell className="font-medium text-slate-900">{wh.name}</TableCell>
              <TableCell>
                <code className="text-xs font-mono text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded truncate max-w-[200px] block">
                  {wh.url}
                </code>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {(wh.events as WebhookEventKey[]).map((ev) => (
                    <Badge key={ev} variant="default" className="text-xs">
                      {EVENT_LABELS[ev] ?? ev}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge status={wh.lastStatus} />
              </TableCell>
              <TableCell className="text-slate-500 text-sm">
                {wh.lastTriggeredAt
                  ? new Date(wh.lastTriggeredAt).toLocaleString()
                  : <span className="text-slate-400">Never</span>}
              </TableCell>
              <TableCell className="sticky right-0 bg-white">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggle(wh)}
                    disabled={togglingId === wh.id}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
                    title={wh.enabled ? "Disable webhook" : "Enable webhook"}
                  >
                    {wh.enabled
                      ? <ToggleRight size={16} className="text-indigo-500" />
                      : <ToggleLeft size={16} />}
                  </button>
                  <button
                    onClick={() => setDeleteTarget(wh)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Delete webhook"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Webhook"
        message={`Delete "${deleteTarget?.name}"? The endpoint will stop receiving events immediately.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />
    </>
  );
}
