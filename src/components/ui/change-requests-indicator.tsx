"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, CheckCircle, Inbox } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
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
  resolvedCount: number;
  canReopen?: boolean;
}

export function ChangeRequestsIndicator({
  entryId, projectId, categoryId, apiBase,
  openCount, resolvedCount, canReopen = false,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [fetching, setFetching] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  const baseUrl = `${apiBase}/${projectId}/categories/${categoryId}/entries/${entryId}/change-requests`;
  const hasOpen     = openCount > 0;
  const hasResolved = resolvedCount > 0;

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
    setActing(reqId);
    const res = await apiFetch(`${baseUrl}/${reqId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setActing(null);
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

  if (!hasOpen && !hasResolved) return null;

  const openRequests     = requests.filter((r) => !r.resolvedAt);
  const resolvedRequests = requests.filter((r) => !!r.resolvedAt);

  return (
    <>
      {hasOpen ? (
        <button
          onClick={handleOpen}
          title={`${openCount} open change request${openCount !== 1 ? "s" : ""}`}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium hover:bg-amber-100 transition-colors"
        >
          <MessageSquare size={10} />
          {openCount}
        </button>
      ) : (
        <button
          onClick={handleOpen}
          title={`${resolvedCount} resolved request${resolvedCount !== 1 ? "s" : ""} — click to view history`}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-400 text-xs font-medium hover:bg-slate-100 transition-colors"
        >
          <CheckCircle size={10} />
          {resolvedCount}
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Change Requests" size="lg">
        {fetching ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-5 h-5 rounded-full border-2 border-slate-200 border-t-indigo-500 animate-spin" />
          </div>
        ) : (
          <div className="flex gap-0 min-h-[240px]">

            {/* Open column */}
            <div className="flex-1 min-w-0 pr-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Open</span>
                <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                  {openRequests.length}
                </span>
              </div>

              {openRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Inbox size={22} className="text-slate-300 mb-2" />
                  <p className="text-xs text-slate-400">No open requests</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {openRequests.map((req) => (
                    <div
                      key={req.id}
                      className="bg-white rounded-lg border border-slate-200 border-l-[3px] border-l-amber-400 p-3 space-y-2 shadow-sm"
                    >
                      <p className="text-sm text-slate-800 leading-snug">{req.note}</p>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-xs text-slate-400">
                          <span className="font-medium text-slate-500">{req.authorName}</span>
                          {" · "}{formatDateTime(req.createdAt)}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          loading={acting === req.id}
                          onClick={() => handleAction(req.id, "resolve")}
                        >
                          Resolve
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="w-px bg-slate-100 self-stretch flex-shrink-0" />

            {/* Resolved column */}
            <div className="flex-1 min-w-0 pl-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Resolved</span>
                <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                  {resolvedRequests.length}
                </span>
              </div>

              {resolvedRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Inbox size={22} className="text-slate-300 mb-2" />
                  <p className="text-xs text-slate-400">Nothing resolved yet</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {resolvedRequests.map((req) => (
                    <div
                      key={req.id}
                      className="bg-slate-50 rounded-lg border border-slate-100 p-3 space-y-2"
                    >
                      <p className="text-sm text-slate-500 leading-snug">{req.note}</p>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-xs text-slate-400">
                          <span className="font-medium text-slate-500">{req.authorName}</span>
                          {" · "}{formatDateTime(req.createdAt)}
                          {req.resolvedByName && (
                            <> · <span className="text-emerald-600">✓ {req.resolvedByName}</span></>
                          )}
                        </p>
                        {canReopen && (
                          <Button
                            variant="ghost"
                            size="sm"
                            loading={acting === req.id}
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
            </div>

          </div>
        )}
      </Modal>
    </>
  );
}
