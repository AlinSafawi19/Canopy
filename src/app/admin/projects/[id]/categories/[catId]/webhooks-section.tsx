"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-fetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LIMITS } from "@/lib/limits";
import { Trash2, Copy, Check, Webhook, ToggleLeft, ToggleRight } from "lucide-react";

const ALL_EVENTS = ["entry.created", "entry.updated", "entry.archived"] as const;
type WebhookEventKey = typeof ALL_EVENTS[number];

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
  createOpen: boolean;
  onCreateClose: () => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded text-slate-400 hover:text-slate-300 transition-colors"
      title="Copy"
    >
      {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
    </button>
  );
}

function StatusBadge({ status }: { status: number | null }) {
  if (status === null) return <span className="text-slate-400 text-xs">—</span>;
  if (status >= 200 && status < 300)
    return <Badge variant="success">{status}</Badge>;
  if (status === 0)
    return <Badge variant="danger">Timeout</Badge>;
  return <Badge variant="danger">{status}</Badge>;
}

function CreateWebhookModal({
  open,
  onClose,
  projectId,
  categoryId,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  categoryId: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<WebhookEventKey[]>([...ALL_EVENTS]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const toggleEvent = (e: WebhookEventKey) => {
    setEvents((prev) =>
      prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]
    );
  };

  const handleCreate = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    if (!url.trim()) { setError("URL is required"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(
        `/api/admin/projects/${projectId}/categories/${categoryId}/webhooks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), url: url.trim(), events }),
        }
      );
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create webhook"); return; }
      setCreatedSecret(data.secret);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName("");
    setUrl("");
    setEvents([...ALL_EVENTS]);
    setError("");
    if (createdSecret) {
      setCreatedSecret(null);
      router.refresh();
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add Webhook"
      size="sm"
      busy={loading}
      footer={
        createdSecret ? (
          <Button className="w-full" onClick={handleClose}>Done</Button>
        ) : (
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleClose} disabled={loading}>Cancel</Button>
            <Button onClick={handleCreate} loading={loading}>Add Webhook</Button>
          </div>
        )
      }
    >
      {createdSecret ? (
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <Check size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-700">
              Webhook created — copy the signing secret now. It won&apos;t be shown again.
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1.5">Signing secret</p>
            <div className="flex items-center gap-2 p-3 bg-slate-900 rounded-lg">
              <code className="flex-1 text-xs font-mono text-emerald-400 break-all">{createdSecret}</code>
              <CopyButton text={createdSecret} />
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Use this secret to verify the <code className="bg-slate-100 px-1 rounded">X-Webhook-Signature</code> header
            on incoming requests. The payload is signed with HMAC-SHA256.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Vercel Revalidation"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
              maxLength={LIMITS.WEBHOOK_NAME}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Endpoint URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="https://example.com/api/revalidate"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              maxLength={LIMITS.WEBHOOK_URL}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Events</label>
            <div className="space-y-1.5">
              {ALL_EVENTS.map((ev) => (
                <label key={ev} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={events.includes(ev)}
                    onChange={() => toggleEvent(ev)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-700">
                    <span className="font-medium">{EVENT_LABELS[ev]}</span>
                    <span className="text-slate-400 ml-1.5 font-mono text-xs">{ev}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
        </div>
      )}
    </Modal>
  );
}

export function WebhooksSection({ projectId, categoryId, initialWebhooks, createOpen, onCreateClose }: Props) {
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

      <CreateWebhookModal
        open={createOpen}
        onClose={onCreateClose}
        projectId={projectId}
        categoryId={categoryId}
      />

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
