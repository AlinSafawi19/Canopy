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
      {/* Compact icon+count trigger — sits inline beside the status badge */}
      <button
        onClick={handleOpen}
        title={`${openCount} open change request${openCount !== 1 ? "s" : ""}`}
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium hover:bg-amber-100 transition-colors"
      >
        <MessageSquare size={10} />
        {openCount}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Change Requests">
        {fetching ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-5 h-5 rounded-full border-2 border-slate-200 border-t-indigo-500 animate-spin" />
          </div>
        ) : requests.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-2">No requests found</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {requests.map((req) => (
              <div key={req.id} className="py-3 first:pt-0 last:pb-0 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-slate-800 leading-snug flex-1">{req.note}</p>
                  {req.resolvedAt
                    ? <Badge variant="success">Resolved</Badge>
                    : <Badge variant="warning">Open</Badge>}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-400">
                    <span className="font-medium text-slate-500">{req.authorName}</span>
                    {" · "}
                    {formatDateTime(req.createdAt)}
                    {req.resolvedAt && req.resolvedByName && (
                      <> · Resolved by <span className="font-medium text-slate-500">{req.resolvedByName}</span></>
                    )}
                  </p>

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
