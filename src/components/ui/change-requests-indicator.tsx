"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, CheckCircle, GripVertical, Inbox } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { Modal } from "@/components/ui/modal";
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

type Column = "open" | "resolved";

export function ChangeRequestsIndicator({
  entryId, projectId, categoryId, apiBase,
  openCount, resolvedCount, canReopen = false,
}: Props) {
  const router = useRouter();
  const [open, setOpen]         = useState(false);
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [fetching, setFetching] = useState(false);
  const [acting, setActing]     = useState<string | null>(null);

  const [dragging,     setDragging]     = useState<string | null>(null);
  const [draggingFrom, setDraggingFrom] = useState<Column | null>(null);
  const [dragOver,     setDragOver]     = useState<Column | null>(null);

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

  function handleDrop(target: Column) {
    if (dragging && draggingFrom && draggingFrom !== target) {
      if (target === "resolved") handleAction(dragging, "resolve");
      else if (target === "open" && canReopen) handleAction(dragging, "reopen");
    }
    setDragging(null);
    setDraggingFrom(null);
    setDragOver(null);
  }

  const hasOpen     = openCount > 0;
  const hasResolved = resolvedCount > 0;
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
          <div className="space-y-4">
            <p className="text-xs text-slate-400">
              {canReopen ? "Drag requests between columns to resolve or reopen." : "Drag open requests to the Resolved column to mark them done."}
            </p>

            <div className="flex gap-3 min-h-[240px]">
              {/* ── Open column ── */}
              <div
                className={`flex-1 min-w-0 rounded-xl p-3 transition-colors ${
                  dragOver === "open" && canReopen ? "bg-amber-50" : "bg-slate-50"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver("open"); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => handleDrop("open")}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Open</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 leading-none">
                    {openRequests.length}
                  </span>
                </div>

                {openRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-1.5">
                    <Inbox size={20} className="text-slate-300" />
                    <p className="text-xs text-slate-400">No open requests</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {openRequests.map((req) => (
                      <div
                        key={req.id}
                        draggable={!acting}
                        onDragStart={() => { setDragging(req.id); setDraggingFrom("open"); }}
                        onDragEnd={() => { setDragging(null); setDraggingFrom(null); setDragOver(null); }}
                        className={`flex items-start gap-2.5 py-3 first:pt-0 last:pb-0 select-none transition-opacity ${
                          acting ? "cursor-wait" : "cursor-grab active:cursor-grabbing"
                        } ${dragging === req.id ? "opacity-40" : ""}`}
                      >
                        <GripVertical size={13} className="text-slate-300 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-800 leading-snug">{req.note}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            <span className="font-medium text-slate-500">{req.authorName}</span>
                            {" · "}{formatDateTime(req.createdAt)}
                          </p>
                        </div>
                        {acting === req.id && (
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-200 border-t-indigo-500 animate-spin flex-shrink-0 mt-0.5" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Resolved column ── */}
              <div
                className={`flex-1 min-w-0 rounded-xl p-3 transition-colors ${
                  dragOver === "resolved" ? "bg-emerald-50" : "bg-slate-50"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver("resolved"); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => handleDrop("resolved")}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Resolved</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 leading-none">
                    {resolvedRequests.length}
                  </span>
                </div>

                {resolvedRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-1.5">
                    <Inbox size={20} className="text-slate-300" />
                    <p className="text-xs text-slate-400">Nothing resolved yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {resolvedRequests.map((req) => (
                      <div
                        key={req.id}
                        draggable={canReopen && !acting}
                        onDragStart={() => { if (canReopen) { setDragging(req.id); setDraggingFrom("resolved"); } }}
                        onDragEnd={() => { setDragging(null); setDraggingFrom(null); setDragOver(null); }}
                        className={`flex items-start gap-2.5 py-3 first:pt-0 last:pb-0 select-none transition-opacity ${
                          canReopen && !acting ? "cursor-grab active:cursor-grabbing" : "cursor-default"
                        } ${dragging === req.id ? "opacity-40" : ""}`}
                      >
                        {canReopen && (
                          <GripVertical size={13} className="text-slate-300 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-500 leading-snug">{req.note}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            <span className="font-medium text-slate-500">{req.authorName}</span>
                            {" · "}{formatDateTime(req.createdAt)}
                            {req.resolvedByName && (
                              <> · <span className="text-emerald-600 font-medium">✓ {req.resolvedByName}</span></>
                            )}
                          </p>
                        </div>
                        {acting === req.id && (
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-200 border-t-indigo-500 animate-spin flex-shrink-0 mt-0.5" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
