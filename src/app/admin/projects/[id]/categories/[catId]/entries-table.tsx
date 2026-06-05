"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { EntryActions } from "./entry-actions";
import { EntryStatusBadge } from "./entry-status-badge";
import { SortableHeader } from "@/components/ui/sortable-header";
import { stripRichText, formatDate } from "@/lib/utils";
import { Trash2, ExternalLink } from "lucide-react";

function resolvePreviewUrl(template: string, entryId: string, values: Record<string, unknown>): string {
  return template
    .replace("{entryId}", entryId)
    .replace(/\{([^}]+)\}/g, (match, field) => {
      const v = values[field];
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
};

interface Field { name: string; type: string; relationCategoryId?: string }
interface TableEntry { id: string; values: unknown; archivedAt: Date | null }

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
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  // Number of <td> columns for empty-state colspan
  const hasActions = canEdit || canArchive || canDelete || !!previewUrl;
  const colCount = fields.length + 2 + (canDelete ? 1 : 0) + (hasActions ? 1 : 0);

  return (
    <>
      {/* Bulk actions bar */}
      {someSelected && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-indigo-50 border-b border-indigo-100">
          <span className="text-sm font-medium text-indigo-700">
            {selected.size} {selected.size === 1 ? "entry" : "entries"} selected
          </span>
          <Button
            variant="danger"
            size="sm"
            className="gap-1.5"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 size={13} />
            Delete selected
          </Button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {/* Checkbox column */}
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
              {/* Row number */}
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
              {fields.map((f) => (
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
                  {fields.map((f) => {
                    const raw = values[f.name];
                    let display: string | null = null;
                    if (raw !== undefined && raw !== null && raw !== "") {
                      const str = String(raw);
                      if (f.type === "rich_text") display = stripRichText(str);
                      else if (f.type === "date") display = formatDate(str);
                      else if (f.type === "relation") display = relatedEntries?.[str] ?? `…${str.slice(-6)}`;
                      else display = str;
                    }
                    return (
                      <td key={f.name} className="px-4 py-2.5 border-r border-slate-100 max-w-[240px]">
                        {display
                          ? f.type === "relation"
                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-pink-50 border border-pink-200 text-pink-700 text-xs font-medium truncate max-w-full">{display}</span>
                            : <span className="block truncate text-slate-700">{display}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2.5 border-r border-slate-100">
                    <EntryStatusBadge entry={entry} categoryId={categoryId} projectId={projectId} basePath={apiBase} />
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
                        <EntryActions
                          entry={entry}
                          categoryId={categoryId}
                          projectId={projectId}
                          fields={fields}
                          basePath={apiBase}
                          canEdit={canEdit}
                          canArchive={canArchive}
                          canDelete={canDelete}
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
