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
  const [open, setOpen] = useState(false);

  // ── per-column state ──────────────────────────────────────
  const [openItems,       setOpenItems]       = useState<ChangeRequest[]>([]);
  const [resolvedItems,   setResolvedItems]   = useState<ChangeRequest[]>([]);
  const [openPage,        setOpenPage]        = useState(1);
  const [resolvedPage,    setResolvedPage]    = useState(1);
  const [openHasMore,     setOpenHasMore]     = useState(false);
  const [resolvedHasMore, setResolvedHasMore] = useState(false);
  const [fetching,        setFetching]        = useState(false);
  const [loadingCol,      setLoadingCol]      = useState<Column | null>(null);

  // ── drag state ────────────────────────────────────────────
  const [dragging,     setDragging]     = useState<string | null>(null);
  const [draggingFrom, setDraggingFrom] = useState<Column | null>(null);
  const [dragOver,     setDragOver]     = useState<Column | null>(null);
  const [acting,       setActing]       = useState<string | null>(null);

  // ── optimistic count deltas for the trigger badge ─────────
  const [openDelta,     setOpenDelta]     = useState(0);
  const [resolvedDelta, setResolvedDelta] = useState(0);

  const baseUrl = `${apiBase}/${projectId}/categories/${categoryId}/entries/${entryId}/change-requests`;

  async function fetchCol(col: Column, pageNum: number) {
    const isFirst = pageNum === 1;
    if (isFirst) setFetching(true); else setLoadingCol(col);
    try {
      const res = await apiFetch(`${baseUrl}?status=${col}&page=${pageNum}`);
      if (!res.ok) return;
      const data = await res.json();
      const items: ChangeRequest[] = data.requests ?? [];
      const more: boolean = data.hasMore ?? false;

      if (col === "open") {
        setOpenItems((prev) => isFirst ? items : [...prev, ...items]);
        setOpenHasMore(more);
        setOpenPage(pageNum);
      } else {
        setResolvedItems((prev) => isFirst ? items : [...prev, ...items]);
        setResolvedHasMore(more);
        setResolvedPage(pageNum);
      }
    } finally {
      if (isFirst) setFetching(false); else setLoadingCol(null);
    }
  }

  async function handleOpen() {
    setOpen(true);
    if (openItems.length === 0 && resolvedItems.length === 0) {
      setFetching(true);
      await Promise.all([fetchCol("open", 1), fetchCol("resolved", 1)]);
      setFetching(false);
    }
  }

  function handleOpenScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 60 && openHasMore && !loadingCol)
      fetchCol("open", openPage + 1);
  }

  function handleResolvedScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 60 && resolvedHasMore && !loadingCol)
      fetchCol("resolved", resolvedPage + 1);
  }

  async function handleAction(reqId: string, action: "resolve" | "reopen") {
    setActing(reqId);
    const res = await apiFetch(`${baseUrl}/${reqId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setActing(null);
    if (!res.ok) return;

    if (action === "resolve") {
      const moved = openItems.find((r) => r.id === reqId);
      if (moved) {
        const resolved = { ...moved, resolvedAt: new Date().toISOString(), resolvedByName: "You" };
        setOpenItems((prev) => prev.filter((r) => r.id !== reqId));
        setResolvedItems((prev) => [resolved, ...prev]);
        setOpenDelta((d) => d - 1);
        setResolvedDelta((d) => d + 1);
      }
    } else {
      const moved = resolvedItems.find((r) => r.id === reqId);
      if (moved) {
        const reopened = { ...moved, resolvedAt: null, resolvedBy: null, resolvedByName: null };
        setResolvedItems((prev) => prev.filter((r) => r.id !== reqId));
        setOpenItems((prev) => [reopened, ...prev]);
        setOpenDelta((d) => d + 1);
        setResolvedDelta((d) => d - 1);
      }
    }
    router.refresh();
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

  const displayOpenCount     = Math.max(0, openCount + openDelta);
  const displayResolvedCount = Math.max(0, resolvedCount + resolvedDelta);
  const hasOpen     = displayOpenCount > 0;
  const hasResolved = displayResolvedCount > 0;
  if (!hasOpen && !hasResolved && openDelta === 0 && resolvedDelta === 0) return null;

  return (
    <>
      {/* Trigger badge */}
      {hasOpen ? (
        <button
          onClick={handleOpen}
          title={`${displayOpenCount} open change request${displayOpenCount !== 1 ? "s" : ""}`}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium hover:bg-amber-100 transition-colors"
        >
          <MessageSquare size={10} />
          {displayOpenCount}
        </button>
      ) : (
        <button
          onClick={handleOpen}
          title={`${displayResolvedCount} resolved request${displayResolvedCount !== 1 ? "s" : ""} — click to view history`}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-400 text-xs font-medium hover:bg-slate-100 transition-colors"
        >
          <CheckCircle size={10} />
          {displayResolvedCount}
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
              {canReopen
                ? "Drag requests between columns to resolve or reopen."
                : "Drag open requests to the Resolved column to mark them done."}
            </p>

            <div className="flex gap-3">
              {/* ── Open column ── */}
              <div
                className={`flex-1 min-w-0 rounded-xl p-3 transition-colors flex flex-col ${
                  dragOver === "open" && canReopen ? "bg-amber-50" : "bg-slate-50"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver("open"); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => handleDrop("open")}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Open</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 leading-none">
                    {openItems.length + (openHasMore ? "+" : "")}
                  </span>
                </div>

                <div
                  className="flex-1 overflow-y-auto max-h-64 divide-y divide-slate-200"
                  onScroll={handleOpenScroll}
                >
                  {openItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-1.5">
                      <Inbox size={20} className="text-slate-300" />
                      <p className="text-xs text-slate-400">No open requests</p>
                    </div>
                  ) : (
                    <>
                      {openItems.map((req) => (
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
                      {loadingCol === "open" && (
                        <div className="flex justify-center py-3">
                          <div className="w-4 h-4 rounded-full border-2 border-slate-200 border-t-indigo-500 animate-spin" />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* ── Resolved column ── */}
              <div
                className={`flex-1 min-w-0 rounded-xl p-3 transition-colors flex flex-col ${
                  dragOver === "resolved" ? "bg-emerald-50" : "bg-slate-50"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver("resolved"); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => handleDrop("resolved")}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Resolved</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 leading-none">
                    {resolvedItems.length + (resolvedHasMore ? "+" : "")}
                  </span>
                </div>

                <div
                  className="flex-1 overflow-y-auto max-h-64 divide-y divide-slate-200"
                  onScroll={handleResolvedScroll}
                >
                  {resolvedItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-1.5">
                      <Inbox size={20} className="text-slate-300" />
                      <p className="text-xs text-slate-400">Nothing resolved yet</p>
                    </div>
                  ) : (
                    <>
                      {resolvedItems.map((req) => (
                        <div
                          key={req.id}
                          draggable={canReopen && !acting}
                          onDragStart={() => { if (canReopen) { setDragging(req.id); setDraggingFrom("resolved"); } }}
                          onDragEnd={() => { setDragging(null); setDraggingFrom(null); setDragOver(null); }}
                          className={`flex items-start gap-2.5 py-3 first:pt-0 last:pb-0 select-none transition-opacity ${
                            canReopen && !acting ? "cursor-grab active:cursor-grabbing" : "cursor-default"
                          } ${dragging === req.id ? "opacity-40" : ""}`}
                        >
                          {canReopen && <GripVertical size={13} className="text-slate-300 flex-shrink-0 mt-0.5" />}
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
                      {loadingCol === "resolved" && (
                        <div className="flex justify-center py-3">
                          <div className="w-4 h-4 rounded-full border-2 border-slate-200 border-t-indigo-500 animate-spin" />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
