"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Modal, ModalRef } from "@/components/ui/modal";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { ActionMenu, ActionMenuItem } from "@/components/ui/action-menu";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { DatePicker } from "@/components/ui/date-picker";
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
  publishAt?: Date | null;
  archiveAt?: Date | null;
}
interface Editor { userId: string; name: string; color: string }

const PRESENCE_KEEPALIVE_MS = 30 * 1000;

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
  /** entryId → label, for pre-filling relation selects with the current value. */
  relatedEntries?: Record<string, string>;
  currentUserId: string;
  /** All users currently editing this entry — from the entries table's presence poll. */
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

  // Schedule state
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

  // ── Presence helpers ─────────────────────────────────────────────────────────

  async function registerPresence() {
    try {
      await apiFetch(presenceUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: entry.id }),
      });
    } catch { /* non-fatal */ }
  }

  async function deregisterPresence() {
    clearInterval(keepaliveRef.current!);
    keepaliveRef.current = null;
    try {
      await apiFetch(presenceUrl, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: entry.id }),
      });
    } catch { /* non-fatal */ }
  }

  // ── Edit handlers ───────────────────────────────────────────────────────────

  async function openEdit() {
    setError("");
    await registerPresence();
    keepaliveRef.current = setInterval(registerPresence, PRESENCE_KEEPALIVE_MS);
    setValues(entry.values as Record<string, unknown>);
    setEditOpen(true);
  }

  // Cleanup presence when component unmounts with modal open
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
    if (!res.ok) {
      setError("Failed to save");
      return;
    }
    await deregisterPresence();
    setEditOpen(false);
    setTouched(false);
    router.refresh();
  }

  async function doArchive() {
    setLoading(true);
    await apiFetch(baseUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive" }),
    });
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

  // ── Schedule handlers ───────────────────────────────────────────────────────

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
    if (!res.ok) { setError("Failed to save schedule"); return; }
    setScheduleOpen(false);
    router.refresh();
  }

  async function clearSchedule() {
    setScheduling(true);
    await apiFetch(baseUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "schedule", publishAt: null, archiveAt: null }),
    });
    setScheduling(false);
    setScheduleOpen(false);
    router.refresh();
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const hasSchedule = !!(entry.publishAt || entry.archiveAt);
  const others = activeEditors.filter((e) => e.userId !== currentUserId);
  // Combine polled presence with local edit state so you always see yourself immediately
  const selfPolled = activeEditors.find((e) => e.userId === currentUserId);
  const visibleEditors: Editor[] = editOpen && !selfPolled
    ? [{ userId: currentUserId, name: "You", color: "#6366F1" }, ...activeEditors.filter((e) => e.userId !== currentUserId)]
    : activeEditors;

  function formatScheduleDate(d: Date | null | undefined) {
    if (!d) return "";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {/* Who is editing this entry — shown on the table row */}
      {visibleEditors.length > 0 && (
        <div className="flex items-center gap-0.5">
          {visibleEditors.slice(0, 4).map((ed) => {
            const isSelf = ed.userId === currentUserId;
            return (
              <span
                key={ed.userId}
                title={isSelf ? "You (editing)" : ed.name}
                className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold text-white ring-1 ring-white ${isSelf ? "animate-pulse" : ""}`}
                style={{ backgroundColor: ed.color }}
              >
                {isSelf ? "✎" : presenceInitials(ed.name)}
              </span>
            );
          })}
          {visibleEditors.length > 4 && (
            <span className="text-[9px] text-slate-400 ml-0.5">+{visibleEditors.length - 4}</span>
          )}
        </div>
      )}

      {/* Schedule badges */}
      {entry.publishAt && (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5 whitespace-nowrap">
          <CalendarClock size={9} />
          Publishes {formatScheduleDate(entry.publishAt)}
        </span>
      )}
      {entry.archiveAt && (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 whitespace-nowrap">
          <Calendar size={9} />
          Archives {formatScheduleDate(entry.archiveAt)}
        </span>
      )}

      {/* Action buttons row */}
      <div className="flex items-center gap-1">
        {canEdit && (
          <Button variant="ghost" size="sm" onClick={openEdit}>
            Edit
          </Button>
        )}

        {(canArchive || canDelete || canSchedule) && (
          <ActionMenu>
            {canSchedule && (
              <ActionMenuItem onClick={openSchedule}>
                {hasSchedule ? "Edit schedule" : "Schedule"}
              </ActionMenuItem>
            )}
            {canArchive && (
              <ActionMenuItem variant="warning" onClick={doArchive} disabled={loading}>
                Archive
              </ActionMenuItem>
            )}
            {canDelete && (
              <ActionMenuItem variant="danger" onClick={() => setConfirmOpen(true)} disabled={loading}>
                Delete
              </ActionMenuItem>
            )}
          </ActionMenu>
        )}
      </div>

      {/* Confirm delete */}
      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={doDelete}
        title="Delete Entry"
        message="Delete this entry permanently? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={loading}
      />

      {/* Edit modal */}
      <Modal
        ref={editModalRef}
        open={editOpen}
        onClose={closeEdit}
        title="Edit Entry"
        isDirty={touched}
        busy={loading}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => editModalRef.current?.attemptClose()}>Cancel</Button>
            <Button type="submit" form="edit-entry-form" loading={loading}>Save</Button>
          </div>
        }
      >
        {others.length > 0 && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-0.5">
              {others.slice(0, 4).map((ed) => (
                <span
                  key={ed.userId}
                  title={ed.name}
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold text-white ring-2 ring-white"
                  style={{ backgroundColor: ed.color }}
                >
                  {presenceInitials(ed.name)}
                </span>
              ))}
            </div>
            <span className="text-xs text-amber-700">
              {others.length === 1
                ? `${others[0].name} is also editing`
                : `${others.map((e) => e.name).join(", ")} are also editing`}
            </span>
          </div>
        )}
        <form id="edit-entry-form" onSubmit={save} className="space-y-4">
          {fields.map((field) => {
            if (field.type === "rich_text") return (
              <RichTextEditor
                key={field.name}
                label={field.name}
                value={str(field.name)}
                onChange={(v) => { setValues(vals => ({ ...vals, [field.name]: v })); setTouched(true); }}
              />
            );
            if (field.type === "textarea") return (
              <Textarea key={field.name} label={field.name} value={str(field.name)} onChange={(e) => { setValues(v => ({ ...v, [field.name]: e.target.value })); setTouched(true); }} rows={2} maxLength={LIMITS.ENTRY_TEXTAREA} />
            );
            if (field.type === "date") return (
              <DatePicker
                key={field.name}
                label={field.name}
                value={str(field.name) || null}
                onChange={(v) => { setValues(vals => ({ ...vals, [field.name]: v ?? "" })); setTouched(true); }}
              />
            );
            if (field.type === "enum") return (
              <Select
                key={field.name}
                label={field.name}
                value={str(field.name)}
                onChange={(v) => { setValues(vals => ({ ...vals, [field.name]: v })); setTouched(true); }}
                options={[
                  { value: "", label: "Select…" },
                  ...(field.options ?? []).map((o) => ({ value: o, label: o })),
                ]}
              />
            );
            if (field.type === "relation") {
              if (field.multiple) {
                return (
                  <RelationMultiSelect
                    key={field.name}
                    label={field.name}
                    value={arr(field.name)}
                    onChange={(v) => { setValues(vals => ({ ...vals, [field.name]: v })); setTouched(true); }}
                    projectId={projectId}
                    targetCategoryId={field.relationCategoryId ?? ""}
                    basePath={basePath}
                    valueLabels={relatedEntries}
                  />
                );
              }
              const current = str(field.name);
              return (
                <RelationSelect
                  key={field.name}
                  label={field.name}
                  value={current}
                  onChange={(v) => { setValues(vals => ({ ...vals, [field.name]: v })); setTouched(true); }}
                  projectId={projectId}
                  targetCategoryId={field.relationCategoryId ?? ""}
                  basePath={basePath}
                  valueLabel={current ? relatedEntries?.[current] : undefined}
                />
              );
            }
            if (field.type === "boolean") {
              const isTrue = str(field.name) === "true";
              return (
                <div key={field.name} className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-slate-700">{field.name}</span>
                  <div className="flex rounded-lg border border-slate-300 overflow-hidden w-fit">
                    <button
                      type="button"
                      onClick={() => { setValues(v => ({ ...v, [field.name]: "true" })); setTouched(true); }}
                      className={`px-4 py-1.5 text-sm font-medium transition-colors ${isTrue ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                    >
                      True
                    </button>
                    <button
                      type="button"
                      onClick={() => { setValues(v => ({ ...v, [field.name]: "false" })); setTouched(true); }}
                      className={`px-4 py-1.5 text-sm font-medium transition-colors border-l border-slate-300 ${!isTrue ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                    >
                      False
                    </button>
                  </div>
                </div>
              );
            }
            const maxLengthByType: Record<string, number> = {
              text: LIMITS.ENTRY_TEXT,
              url: LIMITS.ENTRY_URL,
              email: LIMITS.ENTRY_EMAIL,
            };
            return (
              <Input key={field.name} label={field.name} type={field.type === "number" ? "number" : field.type === "url" ? "url" : "text"} inputMode={field.type === "email" ? "email" : undefined} value={str(field.name)} onChange={(e) => { setValues(v => ({ ...v, [field.name]: e.target.value })); setTouched(true); }} maxLength={maxLengthByType[field.type]} />
            );
          })}
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </form>
      </Modal>

      {/* Schedule modal */}
      <Modal
        open={scheduleOpen}
        onClose={() => { setScheduleOpen(false); setError(""); }}
        title="Schedule Entry"
        footer={
          <div className="flex items-center justify-between gap-3">
            {hasSchedule ? (
              <Button variant="outline" type="button" onClick={clearSchedule} loading={scheduling}>
                Clear schedule
              </Button>
            ) : <div />}
            <div className="flex gap-3">
              <Button variant="outline" type="button" onClick={() => setScheduleOpen(false)}>Cancel</Button>
              <Button type="submit" form="schedule-entry-form" loading={scheduling}>Save</Button>
            </div>
          </div>
        }
      >
        <form id="schedule-entry-form" onSubmit={saveSchedule} className="space-y-5">
          {/* Publish at */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Publish at (un-archive)</p>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <DatePicker
                  label="Date"
                  value={publishDate || null}
                  onChange={(v) => setPublishDate(v ?? "")}
                />
              </div>
              <div className="w-28">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Time</label>
                <input
                  type="time"
                  value={publishTime}
                  onChange={(e) => setPublishTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            {publishDate && (
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireApproval}
                  onChange={(e) => setRequireApproval(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Require approval before publishing
                <span className="text-xs text-slate-400">(creates a change request)</span>
              </label>
            )}
          </div>

          <hr className="border-slate-100" />

          {/* Archive at */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Archive at (take down)</p>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <DatePicker
                  label="Date"
                  value={archiveDate || null}
                  onChange={(v) => setArchiveDate(v ?? "")}
                />
              </div>
              <div className="w-28">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Time</label>
                <input
                  type="time"
                  value={archiveTime}
                  onChange={(e) => setArchiveTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </form>
      </Modal>
    </div>
  );
}
