"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, CheckCircle, GripVertical, Inbox, ChevronDown, ChevronUp } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { Modal } from "@/components/ui/modal";
import { ChangeRequestThread } from "@/components/ui/change-request-thread";
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
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.length === 0 ? "—" : v.join(", ");
  if (typeof v === "boolean") return v ? "true" : "false";
  const str = String(v).replace(/<[^>]*>/g, "").trim();
  return str.length > 80 ? str.slice(0, 80) + "…" : str || "—";
}

function SnapshotDiff({ before, after }: { before: Record<string, unknown> | null; after: Record<string, unknown> | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!before) return null;

  const hasBoth = before && after;
  const keys = hasBoth
    ? [...new Set([...Object.keys(before), ...Object.keys(after)])]
    : Object.keys(before);
  const changedKeys = hasBoth ? keys.filter((k) => formatValue(before[k]) !== formatValue(after![k])) : keys;
  if (changedKeys.length === 0) return null;

  const label = hasBoth ? `${changedKeys.length} changed field${changedKeys.length !== 1 ? "s" : ""}` : "Snapshot";

  return (
    <div className="mt-1.5">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 hover:text-indigo-500 transition-colors"
      >
        {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        {label}
      </button>
      {expanded && (
        <div className="mt-1.5 rounded-lg border border-slate-200 overflow-hidden text-[10px]">
          {hasBoth ? (
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-2 py-1 text-left font-semibold text-slate-400 w-1/4">Field</th>
                  <th className="px-2 py-1 text-left font-semibold text-red-400 w-[37.5%]">Before</th>
                  <th className="px-2 py-1 text-left font-semibold text-emerald-500 w-[37.5%]">After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {changedKeys.map((k) => (
                  <tr key={k}>
                    <td className="px-2 py-1 font-medium text-slate-500 truncate">{k}</td>
                    <td className="px-2 py-1 text-red-600 break-words">{formatValue(before[k])}</td>
                    <td className="px-2 py-1 text-emerald-700 break-words">{formatValue(after![k])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full">
              <tbody className="divide-y divide-slate-100">
                {changedKeys.map((k) => (
                  <tr key={k}>
                    <td className="px-2 py-1 font-medium text-slate-400 w-1/3 truncate">{k}</td>
                    <td className="px-2 py-1 text-slate-600 break-words">{formatValue(before[k])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
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

  // ── per-column lists ───────────────────────────────────────
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

  // ── optimistic deltas for the trigger badge ───────────────
  const [openDelta,     setOpenDelta]     = useState(0);
  const [resolvedDelta, setResolvedDelta] = useState(0);

  // Reset deltas once the server props catch up after router.refresh()
  useEffect(() => {
    setOpenDelta(0);
    setResolvedDelta(0);
  }, [openCount, resolvedCount]);

  const baseUrl = `${apiBase}/${projectId}/categories/${categoryId}/entries/${entryId}/change-requests`;

  // ── data fetching ─────────────────────────────────────────
  async function fetchCol(col: Column, pageNum: number) {
    if (pageNum === 1) setLoadingCol(null); // reset "load more" state
    else setLoadingCol(col);
    try {
      const res = await apiFetch(`${baseUrl}?status=${col}&page=${pageNum}`);
      if (!res.ok) return;
      const data = await res.json();
      const items: ChangeRequest[] = data.requests ?? [];
      if (col === "open") {
        setOpenItems((prev) => pageNum === 1 ? items : [...prev, ...items]);
        setOpenHasMore(data.hasMore ?? false);
        setOpenPage(pageNum);
      } else {
        setResolvedItems((prev) => pageNum === 1 ? items : [...prev, ...items]);
        setResolvedHasMore(data.hasMore ?? false);
        setResolvedPage(pageNum);
      }
    } finally {
      setLoadingCol(null);
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

  // ── action (resolve / reopen) ─────────────────────────────
  async function handleAction(reqId: string, action: "resolve" | "reopen") {
    // Capture the item SYNCHRONOUSLY before any await — avoids stale closure
    const sourceList = action === "resolve" ? openItems : resolvedItems;
    const moved = sourceList.find((r) => r.id === reqId);
    if (!moved) return;

    setActing(reqId);
    const res = await apiFetch(`${baseUrl}/${reqId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setActing(null);
    if (!res.ok) return;

    if (action === "resolve") {
      const resolved = { ...moved, resolvedAt: new Date().toISOString(), resolvedByName: "You" };
      setOpenItems((prev) => prev.filter((r) => r.id !== reqId));
      setResolvedItems((prev) => [resolved, ...prev]);
      setOpenDelta((d) => d - 1);
      setResolvedDelta((d) => d + 1);
    } else {
      const reopened = { ...moved, resolvedAt: null, resolvedBy: null, resolvedByName: null };
      setResolvedItems((prev) => prev.filter((r) => r.id !== reqId));
      setOpenItems((prev) => [reopened, ...prev]);
      setOpenDelta((d) => d + 1);
      setResolvedDelta((d) => d - 1);
    }
    router.refresh();
  }

  // ── drag & drop ───────────────────────────────────────────
  function handleDrop(target: Column) {
    if (dragging && draggingFrom && draggingFrom !== target) {
      if (target === "resolved") handleAction(dragging, "resolve");
      else if (target === "open" && canReopen) handleAction(dragging, "reopen");
    }
    setDragging(null);
    setDraggingFrom(null);
    setDragOver(null);
  }

  // ── derived display counts ─────────────────────────────────
  const displayOpenCount     = Math.max(0, openCount + openDelta);
  const displayResolvedCount = Math.max(0, resolvedCount + resolvedDelta);
  const hasOpen     = displayOpenCount > 0;
  const hasResolved = displayResolvedCount > 0;
  if (!hasOpen && !hasResolved) return null;

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

      <Modal open={open} onClose={() => setOpen(false)} title="Change Requests" size="lg" busy={acting !== null}>
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
                    {openItems.length}{openHasMore ? "+" : ""}
                  </span>
                </div>

                <div
                  className="overflow-y-auto max-h-64 divide-y divide-slate-200"
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
                            <SnapshotDiff before={req.before} after={null} />
                            <ChangeRequestThread
                              requestId={req.id}
                              initialNote={req.note}
                              initialAuthorName={req.authorName}
                              initialAuthorRole={req.authorRole}
                              initialCreatedAt={req.createdAt}
                              commentsUrl={`${baseUrl}/${req.id}/comments`}
                            />
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
                    {resolvedItems.length}{resolvedHasMore ? "+" : ""}
                  </span>
                </div>

                <div
                  className="overflow-y-auto max-h-64 divide-y divide-slate-200"
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
                            <SnapshotDiff before={req.before} after={req.after} />
                            <ChangeRequestThread
                              requestId={req.id}
                              initialNote={req.note}
                              initialAuthorName={req.authorName}
                              initialAuthorRole={req.authorRole}
                              initialCreatedAt={req.createdAt}
                              commentsUrl={`${baseUrl}/${req.id}/comments`}
                            />
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
