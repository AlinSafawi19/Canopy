"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useRef, useState, useEffect, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Modal, ModalRef } from "@/components/ui/modal";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { ActionMenu, ActionMenuItem } from "@/components/ui/action-menu";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { Select } from "@/components/ui/select";
import { RelationSelect } from "@/components/ui/relation-select";
import { RelationMultiSelect } from "@/components/ui/relation-multi-select";
import { LIMITS } from "@/lib/limits";
import { CalendarClock, Calendar } from "lucide-react";
import { presenceInitials } from "@/lib/presence-client";

interface Field { name: string; type: string; options?: string[]; relationCategoryId?: string; multiple?: boolean }
interface Entry {
  id: string;
  values: unknown;
  archivedAt: Date | null;
  archivedBy?: string | null;
  publishAt?: Date | null;
  archiveAt?: Date | null;
}
interface Editor { userId: string; name: string; color: string }
interface PeerState {
  name: string;
  color: string;
  x: number | null;
  y: number | null;
  activeField: string | null;
  fieldValues: Record<string, string>;
}

const PRESENCE_KEEPALIVE_MS = 30 * 1000;

function toYMD(d: Date) {
  return d.toISOString().slice(0, 10);
}

const DATE_SHORTCUTS = [
  { label: "Today",      fn: () => toYMD(new Date()) },
  { label: "Tomorrow",   fn: () => { const d = new Date(); d.setDate(d.getDate() + 1); return toYMD(d); } },
  { label: "Next week",  fn: () => { const d = new Date(); d.setDate(d.getDate() + 7); return toYMD(d); } },
  { label: "Next month", fn: () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return toYMD(d); } },
];

const TIME_SHORTCUTS = [
  { label: "Now",       fn: () => { const n = new Date(); return `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`; } },
  { label: "Morning",   fn: () => "09:00" },
  { label: "Noon",      fn: () => "12:00" },
  { label: "Afternoon", fn: () => "15:00" },
  { label: "Evening",   fn: () => "18:00" },
  { label: "Night",     fn: () => "21:00" },
];

function nowHHMM() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

function QuickDateButtons({ onDate }: { onDate: (v: string) => void }) {
  const today = toYMD(new Date());
  return (
    <div className="flex flex-wrap gap-1">
      {DATE_SHORTCUTS.map(({ label, fn }) => {
        const val = fn();
        if (val < today) return null;
        return (
          <button key={label} type="button" onClick={() => onDate(val)}
            className="px-2 py-0.5 text-[11px] font-medium rounded-md border border-slate-200 text-slate-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-colors">
            {label}
          </button>
        );
      })}
    </div>
  );
}

function QuickTimeButtons({ onTime, minTime }: { onTime: (v: string) => void; minTime?: string }) {
  return (
    <div className="flex flex-wrap gap-1">
      {TIME_SHORTCUTS.map(({ label, fn }) => {
        const val = fn();
        if (minTime && val < minTime) return null;
        return (
          <button key={label} type="button" onClick={() => onTime(val)}
            className="px-2 py-0.5 text-[11px] font-medium rounded-md border border-slate-200 text-slate-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-colors">
            {label}
          </button>
        );
      })}
    </div>
  );
}
const CURSOR_THROTTLE_MS = 50;

export function EntryActions({
  entry,
  categoryId,
  projectId,
  fields,
  basePath = "/api/admin/projects",
  canEdit = true,
  canArchive = true,
  canDelete = true,
  canSchedule = true,
  relatedEntries,
  currentUserId,
  activeEditors = [],
}: {
  entry: Entry;
  categoryId: string;
  projectId: string;
  fields: Field[];
  basePath?: string;
  canEdit?: boolean;
  canArchive?: boolean;
  canDelete?: boolean;
  canSchedule?: boolean;
  relatedEntries?: Record<string, string>;
  currentUserId: string;
  activeEditors?: Editor[];
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const editModalRef = useRef<ModalRef>(null);
  const keepaliveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [values, setValues] = useState<Record<string, unknown>>(
    entry.values as Record<string, unknown>
  );

  // ── Real-time presence (Pusher) ──────────────────────────────────────────────
  const [peers, setPeers] = useState<Record<string, PeerState>>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const pusherRef = useRef<import("pusher-js").default | null>(null);
  const socketIdRef = useRef<string | null>(null);
  const lastCursorRef = useRef(0);

  // Connect to Pusher presence channel when edit modal opens
  useEffect(() => {
    if (!editOpen) {
      if (pusherRef.current) {
        pusherRef.current.unsubscribe(`presence-entry-${entry.id}`);
        pusherRef.current.disconnect();
        pusherRef.current = null;
      }
      setPeers({});
      setFocusedField(null);
      socketIdRef.current = null;
      return;
    }

    (async () => {
      try {
      const PusherClient = (await import("pusher-js")).default;
      const pusher = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
        channelAuthorization: {
          endpoint: "/api/pusher/auth",
          transport: "ajax",
          customHandler: async (params, callback) => {
            try {
              const res = await apiFetch("/api/pusher/auth", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({ socket_id: params.socketId, channel_name: params.channelName }).toString(),
              });
              if (!res.ok) { callback(new Error(`Auth ${res.status}`), null); return; }
              callback(null, await res.json());
            } catch (err) {
              callback(err instanceof Error ? err : new Error(String(err)), null);
            }
          },
        },
      });
      pusherRef.current = pusher;

      pusher.connection.bind("connected", () => {
        socketIdRef.current = pusher.connection.socket_id;
      });

      const channel = pusher.subscribe(`presence-entry-${entry.id}`);

      channel.bind("pusher:subscription_succeeded", (members: { each: (fn: (m: { id: string; info: { name: string; color: string } }) => void) => void }) => {
        const map: Record<string, PeerState> = {};
        members.each((m) => {
          if (m.id !== currentUserId) {
            map[m.id] = { name: m.info.name, color: m.info.color, x: null, y: null, activeField: null, fieldValues: {} };
          }
        });
        setPeers(map);
      });

      channel.bind("pusher:member_added", (member: { id: string; info: { name: string; color: string } }) => {
        if (member.id === currentUserId) return;
        setPeers((prev) => ({ ...prev, [member.id]: { name: member.info.name, color: member.info.color, x: null, y: null, activeField: null, fieldValues: {} } }));
      });

      channel.bind("pusher:member_removed", (member: { id: string }) => {
        setPeers((prev) => { const next = { ...prev }; delete next[member.id]; return next; });
      });

      channel.bind("cursor-move", ({ userId, x, y }: { userId: string; x: number; y: number }) => {
        if (userId === currentUserId) return;
        setPeers((prev) => prev[userId] ? { ...prev, [userId]: { ...prev[userId], x, y } } : prev);
      });

      channel.bind("field-focus", ({ userId, field }: { userId: string; field: string | null }) => {
        if (userId === currentUserId) return;
        setPeers((prev) => prev[userId] ? { ...prev, [userId]: { ...prev[userId], activeField: field } } : prev);
      });

      channel.bind("field-change", ({ userId, field, value }: { userId: string; field: string; value: string }) => {
        if (userId === currentUserId) return;
        setPeers((prev) => prev[userId]
          ? { ...prev, [userId]: { ...prev[userId], fieldValues: { ...prev[userId].fieldValues, [field]: value } } }
          : prev
        );
      });
      } catch (err) { console.error("[Pusher] init failed", err); }
    })();

    return () => {
      if (pusherRef.current) {
        pusherRef.current.unsubscribe(`presence-entry-${entry.id}`);
        pusherRef.current.disconnect();
        pusherRef.current = null;
      }
    };
  }, [editOpen, entry.id, currentUserId]);

  // Broadcast field value changes (debounced 300ms)
  useEffect(() => {
    if (!editOpen || !focusedField) return;
    const field = focusedField;
    const value = values[field];
    const timer = setTimeout(() => {
      apiFetch("/api/pusher/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: `presence-entry-${entry.id}`, event: "field-change", data: { field, value: String(value ?? ""), socketId: socketIdRef.current } }),
      }).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [values, focusedField, editOpen, entry.id]);

  function broadcast(event: string, data: object) {
    apiFetch("/api/pusher/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: `presence-entry-${entry.id}`, event, data: { ...data, socketId: socketIdRef.current } }),
    }).catch(() => {});
  }

  function onFieldFocus(name: string) {
    setFocusedField(name);
    broadcast("field-focus", { field: name });
  }

  function onFieldBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setFocusedField(null);
      broadcast("field-focus", { field: null });
    }
  }

  function broadcastCursor(x: number, y: number) {
    const now = Date.now();
    if (now - lastCursorRef.current < CURSOR_THROTTLE_MS) return;
    lastCursorRef.current = now;
    broadcast("cursor-move", { x, y });
  }

  function handleModalMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    broadcastCursor(e.clientX, e.clientY);
  }

  function handleModalTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    const t = e.touches[0];
    if (t) broadcastCursor(t.clientX, t.clientY);
  }

  // ── Schedule state ───────────────────────────────────────────────────────────
  const [publishDate, setPublishDate] = useState(
    entry.publishAt ? new Date(entry.publishAt).toISOString().slice(0, 10) : ""
  );
  const [publishTime, setPublishTime] = useState(
    entry.publishAt ? new Date(entry.publishAt).toISOString().slice(11, 16) : "09:00"
  );
  const [archiveDate, setArchiveDate] = useState(
    entry.archiveAt ? new Date(entry.archiveAt).toISOString().slice(0, 10) : ""
  );
  const [archiveTime, setArchiveTime] = useState(
    entry.archiveAt ? new Date(entry.archiveAt).toISOString().slice(11, 16) : "09:00"
  );
  const [requireApproval, setRequireApproval] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  const str = (name: string): string => {
    const v = values[name];
    return typeof v === "string" ? v : "";
  };
  const arr = (name: string): string[] => {
    const v = values[name];
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
    return typeof v === "string" && v ? [v] : [];
  };

  const baseUrl = `${basePath}/${projectId}/categories/${categoryId}/entries/${entry.id}`;
  const presenceUrl = `${basePath}/${projectId}/categories/${categoryId}/presence`;

  // ── Redis presence (table row visibility) ────────────────────────────────────

  async function registerPresence() {
    try {
      await apiFetch(presenceUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entryId: entry.id }) });
    } catch { /* non-fatal */ }
  }

  async function deregisterPresence() {
    clearInterval(keepaliveRef.current!);
    keepaliveRef.current = null;
    try {
      await apiFetch(presenceUrl, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entryId: entry.id }) });
    } catch { /* non-fatal */ }
  }

  // ── Edit handlers ────────────────────────────────────────────────────────────

  async function openEdit() {
    setError("");
    await registerPresence();
    keepaliveRef.current = setInterval(registerPresence, PRESENCE_KEEPALIVE_MS);
    setValues(entry.values as Record<string, unknown>);
    setEditOpen(true);
  }

  useEffect(() => () => { if (keepaliveRef.current) clearInterval(keepaliveRef.current); }, []);

  async function closeEdit() {
    await deregisterPresence();
    setEditOpen(false);
    setTouched(false);
    setError("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await apiFetch(baseUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    });
    setLoading(false);
    if (!res.ok) { setError("Failed to save"); return; }
    await deregisterPresence();
    setEditOpen(false);
    setTouched(false);
    router.refresh();
  }

  async function doArchive() {
    setLoading(true);
    await apiFetch(baseUrl, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "archive" }) });
    setLoading(false);
    router.refresh();
  }

  async function doDelete() {
    setLoading(true);
    await apiFetch(baseUrl, { method: "DELETE" });
    setLoading(false);
    setConfirmOpen(false);
    router.refresh();
  }

  // ── Schedule handlers ────────────────────────────────────────────────────────

  function openSchedule() {
    setPublishDate(entry.publishAt ? new Date(entry.publishAt).toISOString().slice(0, 10) : "");
    setPublishTime(entry.publishAt ? new Date(entry.publishAt).toISOString().slice(11, 16) : "09:00");
    setArchiveDate(entry.archiveAt ? new Date(entry.archiveAt).toISOString().slice(0, 10) : "");
    setArchiveTime(entry.archiveAt ? new Date(entry.archiveAt).toISOString().slice(11, 16) : "09:00");
    setRequireApproval(false);
    setError("");
    setScheduleOpen(true);
  }

  async function saveSchedule(e: React.FormEvent) {
    e.preventDefault();
    setScheduling(true);
    setError("");
    const publishAt = publishDate ? new Date(`${publishDate}T${publishTime}:00`).toISOString() : null;
    const archiveAt = archiveDate ? new Date(`${archiveDate}T${archiveTime}:00`).toISOString() : null;
    const res = await apiFetch(baseUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "schedule", publishAt, archiveAt, requireApproval }),
    });
    setScheduling(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Failed to save schedule");
      return;
    }
    setScheduleOpen(false);
    router.refresh();
  }

  async function clearSchedule() {
    setScheduling(true);
    await apiFetch(baseUrl, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "schedule", publishAt: null, archiveAt: null }) });
    setScheduling(false);
    setScheduleOpen(false);
    router.refresh();
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const hasSchedule = !!(entry.publishAt || entry.archiveAt);
  const peerList = Object.values(peers);

  // Row-level avatars: combine Redis polling with local edit state
  const selfPolled = activeEditors.find((e) => e.userId === currentUserId);
  const visibleEditors: Editor[] = editOpen && !selfPolled
    ? [{ userId: currentUserId, name: "You", color: "#6366F1" }, ...activeEditors.filter((e) => e.userId !== currentUserId)]
    : activeEditors;

  function formatScheduleDate(d: Date | null | undefined) {
    if (!d) return "";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  // Render a single form field wrapped with presence overlays
  function renderField(field: Field) {
    const fieldPeers = peerList.filter((p) => p.activeField === field.name);
    const mb = fieldPeers.some((p) => p.fieldValues[field.name]) ? "mb-6" : "";

    let fieldEl: React.ReactNode;
    if (field.type === "rich_text") {
      fieldEl = (
        <RichTextEditor label={field.name} value={str(field.name)}
          onChange={(v) => { setValues((vals) => ({ ...vals, [field.name]: v })); setTouched(true); }} />
      );
    } else if (field.type === "textarea") {
      fieldEl = (
        <Textarea label={field.name} value={str(field.name)} rows={2} maxLength={LIMITS.ENTRY_TEXTAREA}
          onChange={(e) => { setValues((v) => ({ ...v, [field.name]: e.target.value })); setTouched(true); }} />
      );
    } else if (field.type === "date") {
      fieldEl = (
        <DatePicker label={field.name} value={str(field.name) || null}
          onChange={(v) => { setValues((vals) => ({ ...vals, [field.name]: v ?? "" })); setTouched(true); }} />
      );
    } else if (field.type === "enum") {
      fieldEl = (
        <Select label={field.name} value={str(field.name)}
          onChange={(v) => { setValues((vals) => ({ ...vals, [field.name]: v })); setTouched(true); }}
          options={[{ value: "", label: "Select…" }, ...(field.options ?? []).map((o) => ({ value: o, label: o }))]} />
      );
    } else if (field.type === "relation") {
      if (field.multiple) {
        fieldEl = (
          <RelationMultiSelect label={field.name} value={arr(field.name)}
            onChange={(v) => { setValues((vals) => ({ ...vals, [field.name]: v })); setTouched(true); }}
            projectId={projectId} targetCategoryId={field.relationCategoryId ?? ""} basePath={basePath} valueLabels={relatedEntries} />
        );
      } else {
        const current = str(field.name);
        fieldEl = (
          <RelationSelect label={field.name} value={current}
            onChange={(v) => { setValues((vals) => ({ ...vals, [field.name]: v })); setTouched(true); }}
            projectId={projectId} targetCategoryId={field.relationCategoryId ?? ""} basePath={basePath}
            valueLabel={current ? relatedEntries?.[current] : undefined} />
        );
      }
    } else if (field.type === "boolean") {
      const isTrue = str(field.name) === "true";
      fieldEl = (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700">{field.name}</span>
          <div className="flex rounded-lg border border-slate-300 overflow-hidden w-fit">
            <button type="button" onClick={() => { setValues((v) => ({ ...v, [field.name]: "true" })); setTouched(true); }}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${isTrue ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>True</button>
            <button type="button" onClick={() => { setValues((v) => ({ ...v, [field.name]: "false" })); setTouched(true); }}
              className={`px-4 py-1.5 text-sm font-medium transition-colors border-l border-slate-300 ${!isTrue ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>False</button>
          </div>
        </div>
      );
    } else {
      const maxLengthByType: Record<string, number> = { text: LIMITS.ENTRY_TEXT, url: LIMITS.ENTRY_URL, email: LIMITS.ENTRY_EMAIL };
      fieldEl = (
        <Input label={field.name}
          type={field.type === "number" ? "number" : field.type === "url" ? "url" : "text"}
          inputMode={field.type === "email" ? "email" : undefined}
          value={str(field.name)} maxLength={maxLengthByType[field.type]}
          onChange={(e) => { setValues((v) => ({ ...v, [field.name]: e.target.value })); setTouched(true); }} />
      );
    }

    return (
      <div key={field.name} className={`relative ${mb}`}
        onFocus={() => onFieldFocus(field.name)}
        onBlur={onFieldBlur}
      >
        {fieldEl}
        {/* Colored border + name badge per peer editing this field */}
        {fieldPeers.map((p) => (
          <Fragment key={p.name}>
            <div className="absolute inset-0 rounded-lg border-2 pointer-events-none" style={{ borderColor: p.color }} />
            <span className="absolute -top-2 right-2 text-[9px] font-semibold text-white px-1.5 py-0.5 rounded-full pointer-events-none z-10 shadow-sm" style={{ backgroundColor: p.color }}>
              {p.name}
            </span>
            {/* Live typing preview */}
            {p.fieldValues[field.name] && (
              <p className="absolute -bottom-5 left-1 text-[10px] italic truncate max-w-full pointer-events-none" style={{ color: p.color }}>
                {p.name}: {p.fieldValues[field.name]}
              </p>
            )}
          </Fragment>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {/* Schedule badges */}
      {entry.publishAt && (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5 whitespace-nowrap">
          <CalendarClock size={9} />Goes live {formatScheduleDate(entry.publishAt)}
        </span>
      )}
      {entry.archiveAt && (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 whitespace-nowrap">
          <Calendar size={9} />Archives {formatScheduleDate(entry.archiveAt)}
        </span>
      )}

      {/* Action buttons + presence avatars on the same row */}
      <div className="flex items-center gap-1">
        {/* Row-level presence avatars */}
        {visibleEditors.length > 0 && (
          <div className="flex items-center gap-0.5 mr-1">
            {visibleEditors.slice(0, 4).map((ed) => {
              const isSelf = ed.userId === currentUserId;
              return (
                <span key={ed.userId} title={isSelf ? "You (editing)" : ed.name}
                  className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold text-white ring-1 ring-white ${isSelf ? "animate-pulse" : ""}`}
                  style={{ backgroundColor: ed.color }}>
                  {isSelf ? "✎" : presenceInitials(ed.name)}
                </span>
              );
            })}
            {visibleEditors.length > 4 && <span className="text-[9px] text-slate-400 ml-0.5">+{visibleEditors.length - 4}</span>}
          </div>
        )}
        {canEdit && <Button variant="ghost" size="sm" onClick={openEdit}>Edit</Button>}
        {(canArchive || canDelete || canSchedule) && (
          <ActionMenu>
            {canSchedule && <ActionMenuItem onClick={openSchedule}>{hasSchedule ? "Edit schedule" : "Schedule"}</ActionMenuItem>}
            {canArchive && <ActionMenuItem variant="warning" onClick={doArchive} disabled={loading}>Archive</ActionMenuItem>}
            {canDelete && <ActionMenuItem variant="danger" onClick={() => setConfirmOpen(true)} disabled={loading}>Delete</ActionMenuItem>}
          </ActionMenu>
        )}
      </div>

      {/* Confirm delete */}
      <ConfirmModal open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={doDelete}
        title="Delete Entry" message="Delete this entry permanently? This cannot be undone."
        confirmLabel="Delete" variant="danger" loading={loading} />

      {/* Edit modal */}
      <Modal ref={editModalRef} open={editOpen} onClose={closeEdit} title="Edit Entry" isDirty={touched} busy={loading}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => editModalRef.current?.attemptClose()}>Cancel</Button>
            <Button type="submit" form="edit-entry-form" loading={loading}>Save</Button>
          </div>
        }
      >
        {/* Modal content wrapper — tracks mouse for cursor broadcasting */}
        <div className="relative" onMouseMove={handleModalMouseMove} onTouchMove={handleModalTouchMove}>

          {/* Floating cursors */}
          {peerList.map((p) => {
            if (p.x === null || p.y === null) return null;
            return (
              <div key={p.name + "-cursor"} className="fixed pointer-events-none z-[9999]"
                style={{ left: p.x, top: p.y, transition: "left 75ms linear, top 75ms linear" }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="drop-shadow-sm">
                  <path d="M0 0 L0 11 L3 8 L5.5 13 L7 12 L4.5 7 L9 7 Z" fill={p.color} stroke="white" strokeWidth="1" strokeLinejoin="round" />
                </svg>
                <div className="absolute left-3.5 top-0 text-[9px] font-semibold text-white px-1.5 py-0.5 rounded-full shadow-sm whitespace-nowrap"
                  style={{ backgroundColor: p.color }}>
                  {p.name}
                </div>
              </div>
            );
          })}

          {/* Who else is in this modal */}
          {peerList.length > 0 && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
              <div className="flex items-center -space-x-1">
                {peerList.slice(0, 4).map((p) => (
                  <span key={p.name} title={p.name}
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold text-white ring-2 ring-white"
                    style={{ backgroundColor: p.color }}>
                    {presenceInitials(p.name)}
                  </span>
                ))}
              </div>
              <span className="text-xs text-indigo-700">
                {peerList.length === 1
                  ? `${peerList[0].name} is also editing`
                  : `${peerList.map((p) => p.name).join(", ")} are also editing`}
              </span>
            </div>
          )}

          <form id="edit-entry-form" onSubmit={save} className="space-y-4">
            {fields.map(renderField)}
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          </form>
        </div>
      </Modal>

      {/* Schedule modal */}
      <Modal open={scheduleOpen} onClose={() => { setScheduleOpen(false); setError(""); }} title="Schedule Entry"
        footer={
          <div className="flex items-center justify-between gap-3">
            {hasSchedule ? <Button variant="outline" type="button" onClick={clearSchedule} loading={scheduling}>Clear schedule</Button> : <div />}
            <div className="flex gap-3">
              <Button variant="outline" type="button" onClick={() => setScheduleOpen(false)}>Cancel</Button>
              <Button type="submit" form="schedule-entry-form" loading={scheduling}>Save</Button>
            </div>
          </div>
        }
      >
        <form id="schedule-entry-form" onSubmit={saveSchedule} className="space-y-5">
          {(() => {
            const today = toYMD(new Date());
            const pubMinTime = publishDate === today ? nowHHMM() : undefined;
            const arcMinTime = archiveDate === today ? nowHHMM() : undefined;
            return (
              <>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Go live on</p>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1"><DatePicker label="Date" value={publishDate || null} onChange={(v) => setPublishDate(v ?? "")} disablePast /></div>
                    <TimePicker label="Time" value={publishTime} onChange={setPublishTime} minTime={pubMinTime} className="w-28" />
                  </div>
                  <QuickDateButtons onDate={setPublishDate} />
                  <QuickTimeButtons onTime={setPublishTime} minTime={pubMinTime} />
                  {publishDate && !entry.archivedAt && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      This entry will be hidden immediately and go live on the scheduled date.
                    </p>
                  )}
                  {publishDate && (
                    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                      <input type="checkbox" checked={requireApproval} onChange={(e) => setRequireApproval(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      Require approval before publishing
                      <span className="text-xs text-slate-400">(creates a change request)</span>
                    </label>
                  )}
                </div>
                <hr className="border-slate-100" />
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Archive on</p>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1"><DatePicker label="Date" value={archiveDate || null} onChange={(v) => setArchiveDate(v ?? "")} disablePast /></div>
                    <TimePicker label="Time" value={archiveTime} onChange={setArchiveTime} minTime={arcMinTime} className="w-28" />
                  </div>
                  <QuickDateButtons onDate={setArchiveDate} />
                  <QuickTimeButtons onTime={setArchiveTime} minTime={arcMinTime} />
                </div>
              </>
            );
          })()}
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </form>
      </Modal>
    </div>
  );
}
