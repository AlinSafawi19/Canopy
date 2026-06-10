"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Webhook, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { apiFetch } from "@/lib/api-fetch";
import { LIMITS } from "@/lib/limits";
import { WebhooksSection, WebhookRow } from "./webhooks-section";

const ALL_EVENTS = ["entry.created", "entry.updated", "entry.archived"] as const;
type WebhookEventKey = typeof ALL_EVENTS[number];
const EVENT_LABELS: Record<WebhookEventKey, string> = {
  "entry.created": "Created",
  "entry.updated": "Updated",
  "entry.archived": "Archived",
};

const VIEW_SHELL = "flex flex-col h-[70vh] -m-6";
const VIEW_BODY = "flex-1 overflow-y-auto min-h-0";
const VIEW_FOOTER = "flex-shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-white";

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

interface Props {
  projectId: string;
  categoryId: string;
  initialWebhooks: WebhookRow[];
  total: number;
  page: number;
  limit: number;
  basePath: string;
  extraParams: Record<string, string>;
}

export function WebhooksButton({
  projectId,
  categoryId,
  initialWebhooks,
  total,
  page,
  limit,
  basePath,
  extraParams,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "add">("list");

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<WebhookEventKey[]>([...ALL_EVENTS]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  function resetForm() {
    setName(""); setUrl(""); setEvents([...ALL_EVENTS]); setError(""); setCreatedSecret(null);
  }

  function backToList(refresh = false) {
    setView("list");
    resetForm();
    if (refresh) router.refresh();
  }

  function handleModalClose() {
    if (view === "add") {
      backToList(!!createdSecret);
    } else {
      setOpen(false);
    }
  }

  function toggleEvent(e: WebhookEventKey) {
    setEvents((prev) => prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]);
  }

  async function handleCreate() {
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
  }

  return (
    <>
      <Button
        variant="outline"
        className="gap-1.5 w-full sm:w-auto"
        onClick={() => setOpen(true)}
      >
        <Webhook size={14} />
        Webhooks{total > 0 ? ` (${total})` : ""}
      </Button>

      <Modal
        open={open}
        onClose={handleModalClose}
        title={view === "add" ? "Add Webhook" : "Webhooks"}
        size="xl"
        busy={loading}
        headerAction={
          view === "list" ? (
            <Button variant="outline" size="sm" onClick={() => setView("add")}>
              Add Webhook
            </Button>
          ) : undefined
        }
      >
        {/* List view */}
        {view === "list" && (
          <div className={VIEW_SHELL}>
            <div className={VIEW_BODY}>
              <WebhooksSection
                projectId={projectId}
                categoryId={categoryId}
                initialWebhooks={initialWebhooks}
              />
            </div>
            <div className="flex-shrink-0 border-t border-slate-100 bg-white px-4">
              <Pagination
                total={total}
                page={page}
                limit={limit}
                basePath={basePath}
                extraParams={extraParams}
                pageParam="wPage"
                limitParam="wLimit"
              />
            </div>
          </div>
        )}

        {/* Add view */}
        {view === "add" && (
          <div className={VIEW_SHELL}>
            <div className={`${VIEW_BODY} p-6 space-y-4`}>
              {createdSecret ? (
                <>
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
                    Use this secret to verify the{" "}
                    <code className="bg-slate-100 px-1 rounded">X-Webhook-Signature</code>{" "}
                    header on incoming requests. The payload is signed with HMAC-SHA256.
                  </p>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
            <div className={VIEW_FOOTER}>
              {createdSecret ? (
                <Button onClick={() => backToList(true)}>Done</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => backToList(false)} disabled={loading}>Cancel</Button>
                  <Button onClick={handleCreate} loading={loading}>Add Webhook</Button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
