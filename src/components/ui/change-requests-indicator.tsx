"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

interface ChangeRequest {
  id: string;
  note: string;
  authorName: string;
  authorRole: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolvedByName: string | null;
  createdAt: string;
}

interface Props {
  entryId: string;
  projectId: string;
  categoryId: string;
  apiBase: string;
  openCount: number;
  canReopen?: boolean;
}

export function ChangeRequestsIndicator({ entryId, projectId, categoryId, apiBase, openCount, canReopen = false }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [fetching, setFetching] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);

  const baseUrl = `${apiBase}/${projectId}/categories/${categoryId}/entries/${entryId}/change-requests`;

  async function handleOpen() {
    setOpen(true);
    setFetching(true);
    try {
      const res = await apiFetch(baseUrl);
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests ?? []);
      }
    } finally {
      setFetching(false);
    }
  }

  async function handleAction(reqId: string, action: "resolve" | "reopen") {
    setResolving(reqId);
    const res = await apiFetch(`${baseUrl}/${reqId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setResolving(null);
    if (res.ok) {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === reqId
            ? action === "resolve"
              ? { ...r, resolvedAt: new Date().toISOString(), resolvedByName: "You" }
              : { ...r, resolvedAt: null, resolvedBy: null, resolvedByName: null }
            : r
        )
      );
      router.refresh();
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        title="View change requests"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium hover:bg-amber-100 transition-colors"
      >
        <MessageSquare size={10} />
        {openCount} {openCount === 1 ? "request" : "requests"}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Change Requests"
      >
        {fetching ? (
          <p className="text-sm text-slate-400 text-center py-6">Loading…</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No requests found</p>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <div
                key={req.id}
                className={`rounded-lg border px-4 py-3 space-y-2 ${
                  req.resolvedAt
                    ? "border-slate-200 bg-slate-50"
                    : "border-amber-200 bg-amber-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-slate-800 leading-relaxed flex-1">{req.note}</p>
                  {req.resolvedAt ? (
                    <Badge variant="success">Resolved</Badge>
                  ) : (
                    <Badge variant="warning">Open</Badge>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-xs text-slate-400 space-y-0.5">
                    <p>Requested by <span className="font-medium text-slate-600">{req.authorName}</span> · {formatDateTime(req.createdAt)}</p>
                    {req.resolvedAt && req.resolvedByName && (
                      <p>Resolved by <span className="font-medium text-slate-600">{req.resolvedByName}</span> · {formatDateTime(req.resolvedAt)}</p>
                    )}
                  </div>

                  {!req.resolvedAt && (
                    <Button
                      variant="outline"
                      size="sm"
                      loading={resolving === req.id}
                      onClick={() => handleAction(req.id, "resolve")}
                    >
                      Mark Resolved
                    </Button>
                  )}
                  {req.resolvedAt && canReopen && (
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={resolving === req.id}
                      onClick={() => handleAction(req.id, "reopen")}
                    >
                      Reopen
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
