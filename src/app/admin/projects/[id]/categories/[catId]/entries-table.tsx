"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { EntryActions } from "./entry-actions";
import { EntryStatusBadge } from "./entry-status-badge";
import { SortableHeader } from "@/components/ui/sortable-header";
import { RequestChangeButton } from "@/components/ui/request-change-button";
import { ChangeRequestsIndicator } from "@/components/ui/change-requests-indicator";
import { stripRichText, formatDate } from "@/lib/utils";
import { Trash2, ExternalLink, Download, Archive, Columns3 } from "lucide-react";

function resolvePreviewUrl(template: string, entryId: string, values: Record<string, unknown>): string {
  return template
    .replace("{entryId}", entryId)
    .replace(/\{([^}]+)\}/g, (match, field) => {
      const key = Object.keys(values).find((k) => k.toLowerCase() === field.toLowerCase());
      const v = key ? values[key] : undefined;
      return typeof v === "string" && v ? encodeURIComponent(v) : match;
    });
}

const TYPE_COLORS: Record<string, string> = {
  text:      "text-violet-500",
  textarea:  "text-blue-500",
  rich_text: "text-purple-600",
  number:    "text-amber-500",
  date:      "text-emerald-500",
  boolean:   "text-rose-500",
  url:       "text-cyan-500",
  email:     "text-indigo-500",
  relation:  "text-pink-500",
  count:     "text-orange-500",
};

interface Field { name: string; type: string; relationCategoryId?: string; multiple?: boolean; countCategoryId?: string; countFieldName?: string }
interface TableEntry {
  id: string;
  values: unknown;
  archivedAt: Date | null;
  publishAt?: Date | null;
  archiveAt?: Date | null;
}

interface Props {
  entries: TableEntry[];
  fields: Field[];
  projectId: string;
  categoryId: string;
  skip: number;
  search?: string;
  /** URL path of the page — used for sort links */
  pagePath: string;
  sortDir: "asc" | "desc";
  sortExtras: Record<string, string>;
  /** API base prefix — used for CRUD calls */
  apiBase?: string;
  canEdit?: boolean;
  canArchive?: boolean;
  canDelete?: boolean;
  previewUrl?: string | null;
  /** entryId → human-readable label for relation field display */
  relatedEntries?: Record<string, string>;
  /** fieldName → entryId → computed count for count-type fields */
  entryCounts?: Record<string, Record<string, number>>;
  categoryName?: string;
  /** entryId → count of open change requests; drives the amber indicator */
  openRequestsByEntry?: Record<string, number>;
  /** entryId → count of resolved change requests; drives the muted history indicator */
  resolvedRequestsByEntry?: Record<string, number>;
  /** When true, shows Request Change button (client view). When false/absent, shows ChangeRequestsIndicator (admin/contributor view). */
  canRequestChange?: boolean;
  /** When true, admin can reopen resolved requests from the indicator modal */
  canReopenRequests?: boolean;
  /** Session user ID — used to exclude self from presence avatars */
  currentUserId?: string;
}

export function EntriesTable({
  entries,
  fields,
  projectId,
  categoryId,
  skip,
  search,
  pagePath,
  sortDir,
  sortExtras,
  apiBase = "/api/admin/projects",
  canEdit = true,
  canArchive = true,
  canDelete = true,
  previewUrl,
  relatedEntries,
  categoryName = "entries",
  openRequestsByEntry,
  resolvedRequestsByEntry,
  canRequestChange = false,
  canReopenRequests = false,
  entryCounts,
  currentUserId = "",
}: Props) {
  const router = useRouter();

  // ── Presence polling ────────────────────────────────────────────────────────
  const [presence, setPresence] = useState<Record<string, { userId: string; name: string; color: string }[]>>({});
  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const res = await apiFetch(`${apiBase}/${projectId}/categories/${categoryId}/presence`);
        if (res.ok && mounted) setPresence(await res.json());
      } catch { /* non-fatal */ }
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => { mounted = false; clearInterval(id); };
  }, [apiBase, projectId, categoryId]);

  // ── Bulk selection ──────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  // ── Column visibility (persisted in localStorage per category) ──────────────
  const [hiddenFields, setHiddenFields] = useState<Set<string>>(new Set());
  const [showColumnsPanel, setShowColumnsPanel] = useState(false);
  const columnsPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`hidden-cols-${categoryId}`);
      if (stored) setHiddenFields(new Set(JSON.parse(stored) as string[]));
    } catch {}
  }, [categoryId]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (columnsPanelRef.current && !columnsPanelRef.current.contains(e.target as Node)) {
        setShowColumnsPanel(false);
      }
    }
    if (showColumnsPanel) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showColumnsPanel]);

  function toggleField(name: string) {
    setHiddenFields((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      try { localStorage.setItem(`hidden-cols-${categoryId}`, JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  }

  function showAllFields() {
    setHiddenFields(new Set());
    try { localStorage.removeItem(`hidden-cols-${categoryId}`); } catch {}
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const visibleFields = fields.filter((f) => !hiddenFields.has(f.name));

  const allSelected = entries.length > 0 && entries.every((e) => selected.has(e.id));
  const someSelected = selected.size > 0;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(entries.map((e) => e.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleBulkExport(format: "csv" | "json") {
    const ids = Array.from(selected).join(",");
    const url = `${apiBase}/${projectId}/categories/${categoryId}/entries/export?format=${format}&ids=${ids}`;
    const res = await apiFetch(url);
    if (!res.ok) return;
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${categoryName.replace(/[^a-z0-9_-]/gi, "_")}-selected.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  async function handleBulkArchive() {
    setArchiving(true);
    await apiFetch(`${apiBase}/${projectId}/categories/${categoryId}/entries`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive", ids: Array.from(selected) }),
    });
    setArchiving(false);
    setArchiveConfirmOpen(false);
    setSelected(new Set());
    router.refresh();
  }

  async function handleBulkDelete() {
    setDeleting(true);
    await apiFetch(`${apiBase}/${projectId}/categories/${categoryId}/entries`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected) }),
    });
    setDeleting(false);
    setConfirmOpen(false);
    setSelected(new Set());
    router.refresh();
  }

  const hasActions = canEdit || canArchive || canDelete || !!previewUrl;
  const colCount = visibleFields.length + 2 + (canDelete ? 1 : 0) + (hasActions ? 1 : 0);

  return (
    <>
      {/* Bulk actions bar */}
      {someSelected && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-indigo-50 border-b border-indigo-100">
          <span className="text-sm font-medium text-indigo-700">
            {selected.size} {selected.size === 1 ? "entry" : "entries"} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkExport("csv")}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 rounded transition-colors"
            >
              <Download size={12} />
              Export Selected as CSV
            </button>
            <button
              onClick={() => handleBulkExport("json")}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 rounded transition-colors"
            >
              <Download size={12} />
              Export Selected as JSON
            </button>
            <div className="w-px h-4 bg-indigo-200" />
            {canArchive && (
              <Button variant="warning" size="sm" className="gap-1.5" onClick={() => setArchiveConfirmOpen(true)}>
                <Archive size={13} />
                Archive selected
              </Button>
            )}
            {canDelete && (
              <Button variant="danger" size="sm" className="gap-1.5" onClick={() => setConfirmOpen(true)}>
                <Trash2 size={13} />
                Delete selected
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Table toolbar: Columns toggle */}
      <div className="flex items-center justify-end px-4 py-2 border-b border-slate-100 bg-white">
        <div className="relative" ref={columnsPanelRef}>
          <button
            onClick={() => setShowColumnsPanel((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border transition-colors ${
              hiddenFields.size > 0
                ? "text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100"
                : "text-slate-600 bg-white border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Columns3 size={13} />
            Columns
            {hiddenFields.size > 0 && (
              <span className="ml-0.5 px-1.5 py-0 rounded-full bg-indigo-200 text-indigo-800 text-[10px] font-semibold">
                {hiddenFields.size} hidden
              </span>
            )}
          </button>

          {showColumnsPanel && (
            <div className="absolute right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-lg shadow-lg z-30 min-w-[220px] py-1">
              <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Toggle columns</span>
                {hiddenFields.size > 0 && (
                  <button
                    onClick={showAllFields}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    Show all
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto">
                {fields.map((f) => (
                  <label
                    key={f.name}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={!hiddenFields.has(f.name)}
                      onChange={() => toggleField(f.name)}
                      className="w-3.5 h-3.5 rounded border-slate-300 accent-indigo-600 cursor-pointer"
                    />
                    <span className="flex-1 text-sm text-slate-700 truncate">{f.name}</span>
                    <span className={`text-[10px] uppercase tracking-wide font-medium ${TYPE_COLORS[f.type] ?? "text-slate-400"}`}>
                      {f.type}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {canDelete && (
                <th className="w-10 px-3 py-2.5 border-r border-slate-200 sticky left-0 bg-slate-50 z-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    title={allSelected ? "Deselect all" : "Select all"}
                    className="w-4 h-4 rounded border-slate-300 accent-indigo-600 cursor-pointer"
                  />
                </th>
              )}
              <th className={`w-10 px-3 py-2.5 text-left border-r border-slate-200 sticky bg-slate-50 z-10 ${canDelete ? "left-10" : "left-0"}`}>
                <SortableHeader
                  label="#"
                  field="sortIndex"
                  sortBy="sortIndex"
                  sortDir={sortDir}
                  basePath={pagePath}
                  extraParams={sortExtras}
                />
              </th>
              {visibleFields.map((f) => (
                <th key={f.name} className="px-4 py-2.5 text-left font-medium text-slate-700 border-r border-slate-200 min-w-[160px] whitespace-nowrap">
                  <div className="flex flex-col gap-0.5">
                    <span>{f.name}</span>
                    <span className={`text-[10px] font-normal uppercase tracking-wide ${TYPE_COLORS[f.type] ?? "text-slate-400"}`}>
                      {f.type}
                    </span>
                  </div>
                </th>
              ))}
              <th className="px-4 py-2.5 text-left font-medium text-slate-700 border-r border-slate-200 whitespace-nowrap">
                <div className="flex flex-col gap-0.5">
                  <span>Status</span>
                  <span className="text-[10px] font-normal uppercase tracking-wide text-slate-400">system</span>
                </div>
              </th>
              {hasActions && (
                <th className="px-4 py-2.5 text-left font-medium text-slate-700 whitespace-nowrap sticky right-0 bg-slate-50">
                  <div className="flex flex-col gap-0.5">
                    <span>Actions</span>
                    <span className="text-[10px] font-normal uppercase tracking-wide text-slate-400">system</span>
                  </div>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-400 text-sm" colSpan={colCount}>
                  {search ? `No entries found for "${search}"` : "No rows yet"}
                </td>
              </tr>
            ) : entries.map((entry, idx) => {
              const values = entry.values as Record<string, unknown>;
              const isSelected = selected.has(entry.id);
              return (
                <tr
                  key={entry.id}
                  className={`border-b border-slate-100 transition-colors ${isSelected ? "bg-indigo-50/50 hover:bg-indigo-50/70" : "hover:bg-slate-50/60"}`}
                >
                  {canDelete && (
                    <td className="px-3 py-2.5 border-r border-slate-100 sticky left-0 z-10 bg-inherit">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(entry.id)}
                        className="w-4 h-4 rounded border-slate-300 accent-indigo-600 cursor-pointer"
                      />
                    </td>
                  )}
                  <td className={`px-3 py-2.5 text-center text-xs text-slate-400 border-r border-slate-100 sticky z-10 ${canDelete ? "left-10" : "left-0"} ${isSelected ? "bg-indigo-50/50" : "bg-white"}`}>
                    {skip + idx + 1}
                  </td>
                  {visibleFields.map((f) => {
                    const raw = values[f.name];

                    if (f.type === "count") {
                      const count = entryCounts?.[f.name]?.[entry.id] ?? 0;
                      return (
                        <td key={f.name} className="px-4 py-2.5 border-r border-slate-100">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs font-medium">
                            {count}
                          </span>
                        </td>
                      );
                    }

                    if (f.type === "relation") {
                      const ids = Array.isArray(raw)
                        ? raw.filter((x): x is string => typeof x === "string" && !!x)
                        : typeof raw === "string" && raw ? [raw] : [];
                      return (
                        <td key={f.name} className="px-4 py-2.5 border-r border-slate-100 max-w-[240px]">
                          {ids.length === 0 ? (
                            <span className="text-slate-300">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {ids.map((id) => (
                                <span key={id} className="inline-flex items-center px-2 py-0.5 rounded-full bg-pink-50 border border-pink-200 text-pink-700 text-xs font-medium truncate max-w-full">
                                  {relatedEntries?.[id] ?? id}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    }

                    let display: string | null = null;
                    if (raw !== undefined && raw !== null && raw !== "") {
                      const str = String(raw);
                      if (f.type === "rich_text") display = stripRichText(str);
                      else if (f.type === "date") display = formatDate(str);
                      else display = str;
                    }
                    return (
                      <td key={f.name} className="px-4 py-2.5 border-r border-slate-100 max-w-[240px]">
                        {display
                          ? f.type === "enum"
                            ? <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700 text-xs font-medium truncate max-w-full">{display}</span>
                            : f.type === "boolean"
                            ? <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${display === "true" ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-600"}`}>{display}</span>
                            : f.type === "url"
                            ? <a href={display} target="_blank" rel="noopener noreferrer" className="block truncate text-indigo-600 hover:underline">{display}</a>
                            : <span className="block truncate text-slate-700">{display}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2.5 border-r border-slate-100">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <EntryStatusBadge entry={entry} categoryId={categoryId} projectId={projectId} basePath={apiBase} />
                      {!canRequestChange && (
                        (openRequestsByEntry?.[entry.id] ?? 0) > 0 ||
                        (resolvedRequestsByEntry?.[entry.id] ?? 0) > 0
                      ) && (
                        <ChangeRequestsIndicator
                          entryId={entry.id}
                          projectId={projectId}
                          categoryId={categoryId}
                          apiBase={apiBase}
                          openCount={openRequestsByEntry?.[entry.id] ?? 0}
                          resolvedCount={resolvedRequestsByEntry?.[entry.id] ?? 0}
                          canReopen={canReopenRequests}
                        />
                      )}
                    </div>
                  </td>
                  {hasActions && (
                    <td className={`px-4 py-2.5 sticky right-0 z-10 ${isSelected ? "bg-indigo-50/50" : "bg-white"}`}>
                      <div className="flex items-center gap-1">
                        {previewUrl && (
                          <a
                            href={resolvePreviewUrl(previewUrl, entry.id, values)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors"
                            title="Preview on site"
                          >
                            <ExternalLink size={12} />
                            Preview
                          </a>
                        )}
                        {canRequestChange && (
                          <RequestChangeButton
                            entryId={entry.id}
                            projectId={projectId}
                            categoryId={categoryId}
                            apiBase={apiBase}
                            openCount={openRequestsByEntry?.[entry.id] ?? 0}
                          />
                        )}
                        <EntryActions
                          entry={entry}
                          categoryId={categoryId}
                          projectId={projectId}
                          fields={fields}
                          basePath={apiBase}
                          canEdit={canEdit}
                          canArchive={canArchive}
                          canDelete={canDelete}
                          relatedEntries={relatedEntries}
                          currentUserId={currentUserId}
                          activeEditors={presence[entry.id] ?? []}
                        />
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        open={archiveConfirmOpen}
        onClose={() => setArchiveConfirmOpen(false)}
        onConfirm={handleBulkArchive}
        title="Archive Entries"
        message={`Archive ${selected.size} ${selected.size === 1 ? "entry" : "entries"}? They can be restored from the archive.`}
        confirmLabel={`Archive ${selected.size} ${selected.size === 1 ? "entry" : "entries"}`}
        variant="warning"
        loading={archiving}
      />

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleBulkDelete}
        title="Delete Entries"
        message={`Permanently delete ${selected.size} ${selected.size === 1 ? "entry" : "entries"}? This cannot be undone.`}
        confirmLabel={`Delete ${selected.size} ${selected.size === 1 ? "entry" : "entries"}`}
        variant="danger"
        loading={deleting}
      />
    </>
  );
}
