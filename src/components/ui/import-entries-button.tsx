"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal, ModalRef } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { DatePicker } from "@/components/ui/date-picker";
import { RelationSelect } from "@/components/ui/relation-select";
import { LIMITS } from "@/lib/limits";
import { stripRichText, formatDate } from "@/lib/utils";
import { Upload, Trash2, Plus, X, Columns, Pencil } from "lucide-react";

interface Field { name: string; type: string; options?: string[]; relationCategoryId?: string }

interface Props {
  projectId: string;
  categoryId: string;
  fields: Field[];
  totalEntries?: number;
  basePath?: string;
}

// Editable column with a stable key, so renaming a header never loses cell data.
type Col = { key: string; name: string; type: string; options?: string[]; relationCategoryId?: string };
type ImportMode = "replace" | "merge" | null;
type ImportResult = { created: number; updated: number; errors: Array<{ row: number; error: string }> };

const MAX_IMPORT_ROWS = 500; // mirrors src/lib/entries-io.ts

// Same type→colour map as the entries page table.
const TYPE_COLORS: Record<string, string> = {
  text: "text-violet-500", textarea: "text-blue-500", rich_text: "text-purple-600",
  number: "text-amber-500", date: "text-emerald-500", boolean: "text-rose-500",
  url: "text-cyan-500", email: "text-indigo-500", relation: "text-pink-500", enum: "text-violet-500",
};

// Types offered when defining a new import column (relation needs a target
// category, so it's only kept when an existing field already uses it).
const COLUMN_TYPES = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Textarea" },
  { value: "rich_text", label: "Rich Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Boolean" },
  { value: "url", label: "URL" },
  { value: "email", label: "Email" },
  { value: "enum", label: "Enum" },
];

function inferColumnTypeClient(rows: Record<string, string>[], key: string): string {
  const vals = rows.map((r) => r[key]).filter((v) => v !== "" && v != null);
  if (vals.length === 0) return "text";
  if (vals.every((v) => /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v.trim()))) return "number";
  if (vals.every((v) => /^https?:\/\/.+/i.test(v.trim()))) return "url";
  if (vals.every((v) => /^(true|false)$/i.test(v.trim()))) return "boolean";
  if (vals.every((v) => /^\d{4}-\d{2}-\d{2}/.test(v.trim()))) return "date";
  if (vals.some((v) => /<[a-z][\s\S]*?>/i.test(v))) return "rich_text";
  return "text";
}

// ── CSV parser ─────────────────────────────────────────────────────────────────

function parseCSV(text: string): Record<string, string>[] {
  const lines: string[] = [];
  let cur = "";
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQuote = false; }
      else { cur += ch; }
    } else {
      if (ch === '"') { inQuote = true; }
      else if (ch === "\n" || (ch === "\r" && text[i + 1] === "\n")) {
        if (ch === "\r") i++;
        lines.push(cur); cur = "";
      } else { cur += ch; }
    }
  }
  if (cur || lines.length) lines.push(cur);

  function splitLine(line: string): string[] {
    const cells: string[] = [];
    let cell = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') { q = false; }
        else { cell += c; }
      } else {
        if (c === '"') { q = true; }
        else if (c === ",") { cells.push(cell); cell = ""; }
        else { cell += c; }
      }
    }
    cells.push(cell);
    return cells;
  }

  const nonEmpty = lines.map((l) => l.trim()).filter(Boolean);
  if (nonEmpty.length < 2) return [];

  const headers = splitLine(nonEmpty[0]);
  return nonEmpty.slice(1).map((line) => {
    const cells = splitLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = cells[i] ?? ""; });
    return obj;
  });
}

// Flattens any JSON value to a spreadsheet-style string.
function flattenValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(flattenValue).join(", ");
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if (typeof obj.url === "string") return obj.url;
    return JSON.stringify(v);
  }
  return String(v);
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ImportEntriesButton({
  projectId,
  categoryId,
  fields,
  totalEntries = 0,
  basePath = "/api/admin/projects",
}: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const keyCounter = useRef(0);

  const [open, setOpen] = useState(false);
  const [columns, setColumns] = useState<Col[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]); // keyed by Col.key
  const [parseError, setParseError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [mode, setMode] = useState<ImportMode>(null);

  const [manageOpen, setManageOpen] = useState(false);
  const [editRowIdx, setEditRowIdx] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const editModalRef = useRef<ModalRef>(null);

  const nextKey = () => `c${keyCounter.current++}`;
  const hasExisting = totalEntries > 0;

  function reset() {
    setColumns([]);
    setRows([]);
    setParseError("");
    setResult(null);
    setMode(null);
    setManageOpen(false);
    setEditRowIdx(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleClose() {
    setOpen(false);
    reset();
  }

  // ── parsing ──────────────────────────────────────────────
  function ingest(parsed: Record<string, string>[]) {
    const names: string[] = [];
    for (const r of parsed) for (const k of Object.keys(r)) if (!names.includes(k)) names.push(k);

    const cols: Col[] = names.map((name) => {
      const existing = fields.find((f) => f.name === name);
      return {
        key: nextKey(),
        name,
        type: existing ? existing.type : inferColumnTypeClient(parsed, name),
        options: existing?.options,
        relationCategoryId: existing?.relationCategoryId,
      };
    });

    const keyed = parsed.map((r) => {
      const o: Record<string, string> = {};
      for (const c of cols) o[c.key] = r[c.name] ?? "";
      return o;
    });

    setColumns(cols);
    setRows(keyed);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError("");
    setColumns([]);
    setRows([]);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        if (file.name.endsWith(".json")) {
          const parsed = JSON.parse(text);
          if (!Array.isArray(parsed)) throw new Error("JSON must be an array of objects.");
          ingest(parsed.map((r: unknown) =>
            typeof r === "object" && r !== null
              ? Object.fromEntries(Object.entries(r as Record<string, unknown>).map(([k, v]) => [k, flattenValue(v)]))
              : {}
          ));
        } else {
          const parsed = parseCSV(text);
          if (parsed.length === 0) throw new Error("No data rows found in file.");
          ingest(parsed);
        }
      } catch (err: unknown) {
        setParseError(err instanceof Error ? err.message : "Failed to parse file.");
      }
    };
    reader.readAsText(file);
  }

  // ── row editing ──────────────────────────────────────────
  function openEditRow(idx: number) {
    setEditValues({ ...rows[idx] });
    setEditRowIdx(idx);
  }
  function saveEditRow() {
    if (editRowIdx === null) return;
    setRows((rs) => rs.map((r, i) => (i === editRowIdx ? { ...editValues } : r)));
    setEditRowIdx(null);
  }
  function removeRow(idx: number) {
    setRows((rs) => rs.filter((_, i) => i !== idx));
  }
  function addRow() {
    const blank = Object.fromEntries(columns.map((c) => [c.key, ""]));
    setRows((rs) => [...rs, blank]);
    setEditValues(blank);
    setEditRowIdx(rows.length); // index of the row just appended
  }

  // ── import ───────────────────────────────────────────────
  async function handleImport() {
    setParseError("");
    if (rows.length > MAX_IMPORT_ROWS) {
      setParseError(`This file has ${rows.length} rows. You can import up to ${MAX_IMPORT_ROWS} at a time — split it into smaller files.`);
      return;
    }
    const named = columns.filter((c) => c.name.trim());
    if (named.length === 0) { setParseError("Add at least one named column to import."); return; }
    const names = named.map((c) => c.name.trim());
    const dupe = names.find((n, i) => names.indexOf(n) !== i);
    if (dupe) { setParseError(`Two columns are both named "${dupe}". Column names must be unique.`); return; }

    const outRows = rows.map((r) => {
      const o: Record<string, string> = {};
      for (const c of named) o[c.name.trim()] = r[c.key] ?? "";
      return o;
    });
    const schema = named.map((c) => ({
      name: c.name.trim(),
      type: c.type,
      ...(c.options && c.options.length > 0 ? { options: c.options } : {}),
    }));

    setLoading(true);
    setResult(null);
    try {
      const res = await apiFetch(`${basePath}/${projectId}/categories/${categoryId}/entries/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: outRows, columns: schema, mode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setParseError(data.error ?? "Import failed. Please check your file and try again.");
        return;
      }
      setResult({
        created: data.created ?? 0,
        updated: data.updated ?? 0,
        errors: Array.isArray(data.errors) ? data.errors : [],
      });
      if ((data.created ?? 0) > 0 || (data.updated ?? 0) > 0) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const resultSummary = result
    ? [
        result.created > 0 ? `${result.created} row${result.created !== 1 ? "s" : ""} imported` : "",
        result.updated > 0 ? `${result.updated} row${result.updated !== 1 ? "s" : ""} updated` : "",
      ].filter(Boolean).join(", ") || "No changes made"
    : "";

  const editingCol = editRowIdx !== null;

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Upload size={14} />
        Import
      </Button>

      <Modal open={open} onClose={handleClose} title="Import Entries" size="xl">
        <div className="space-y-4">

          {/* Hidden input — always mounted so it survives when the dropzone is hidden */}
          <input ref={fileRef} type="file" accept=".csv,.json" className="hidden" onChange={handleFile} />

          {/* Dropzone — only before any file is loaded */}
          {columns.length === 0 && !result && (
            <>
              <p className="text-sm text-slate-500">
                Upload a <span className="font-medium text-slate-700">.csv</span> or{" "}
                <span className="font-medium text-slate-700">.json</span> file. The first CSV row must be
                column names. JSON must be an array of objects. Up to 500 rows per import.
              </p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-lg py-8 px-4 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors"
              >
                <Upload size={20} className="text-slate-400" />
                <span className="text-sm text-slate-600 font-medium">Click to choose file</span>
                <span className="text-xs text-slate-400">CSV or JSON</span>
              </button>
            </>
          )}

          {parseError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{parseError}</p>
          )}

          {/* Mode selector — only when existing data is present */}
          {columns.length > 0 && hasExisting && !result && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {totalEntries} existing {totalEntries === 1 ? "entry" : "entries"} found — how should we proceed?
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode("merge")}
                  className={`text-left px-3 py-2.5 rounded-lg border transition-colors ${mode === "merge" ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 hover:border-slate-300 text-slate-600"}`}
                >
                  <p className="text-sm font-medium">Merge</p>
                  <p className="text-xs opacity-75">Add new rows, update changed ones</p>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("replace")}
                  className={`text-left px-3 py-2.5 rounded-lg border transition-colors ${mode === "replace" ? "border-red-500 bg-red-50 text-red-700" : "border-slate-200 hover:border-slate-300 text-slate-600"}`}
                >
                  <p className="text-sm font-medium">Replace all</p>
                  <p className="text-xs opacity-75">Delete existing data and reimport</p>
                </button>
              </div>
              {mode === "replace" && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  All {totalEntries} existing {totalEntries === 1 ? "entry" : "entries"} will be permanently deleted before importing.
                </p>
              )}
            </div>
          )}

          {/* Review table (page-style display) + actions */}
          {columns.length > 0 && !result && (
            <div>
              <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Review &amp; edit — {rows.length} row{rows.length !== 1 ? "s" : ""}, {columns.length} column{columns.length !== 1 ? "s" : ""}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors"
                  >
                    <Upload size={12} /> Choose another file
                  </button>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setManageOpen(true)}>
                    <Columns size={13} /> Manage Columns
                  </Button>
                  <Button size="sm" className="gap-1.5" onClick={addRow}>
                    <Plus size={13} /> Add Row
                  </Button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="overflow-auto max-h-96">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="w-10 px-3 py-2.5 text-left border-r border-slate-200 sticky left-0 bg-slate-50 z-10 text-xs font-medium text-slate-400">#</th>
                        {columns.map((c) => (
                          <th key={c.key} className="px-4 py-2.5 text-left font-medium text-slate-700 border-r border-slate-200 min-w-[160px] whitespace-nowrap">
                            <div className="flex flex-col gap-0.5">
                              <span>{c.name || <span className="text-slate-300 italic">unnamed</span>}</span>
                              <span className={`text-[10px] font-normal uppercase tracking-wide ${TYPE_COLORS[c.type] ?? "text-slate-400"}`}>
                                {c.type}
                              </span>
                            </div>
                          </th>
                        ))}
                        <th className="px-4 py-2.5 text-left font-medium text-slate-700 whitespace-nowrap sticky right-0 bg-slate-50">
                          <span className="text-[10px] font-normal uppercase tracking-wide text-slate-400">actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={columns.length + 2} className="px-4 py-8 text-center text-sm text-slate-400">
                            No rows — use <span className="font-medium">Add Row</span> to create one.
                          </td>
                        </tr>
                      ) : rows.map((row, i) => (
                        <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                          <td className="px-3 py-2.5 text-center text-xs text-slate-400 border-r border-slate-100 sticky left-0 bg-white z-10">
                            {i + 1}
                          </td>
                          {columns.map((c) => (
                            <td key={c.key} className="px-4 py-2.5 border-r border-slate-100 max-w-[240px]">
                              <DisplayCell type={c.type} value={row[c.key] ?? ""} />
                            </td>
                          ))}
                          <td className="px-4 py-2.5 sticky right-0 bg-white">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditRow(i)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors"
                              >
                                <Pencil size={12} /> Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => removeRow(i)}
                                title="Remove row"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-2">
              <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 font-medium">
                {resultSummary}.
              </p>
              {result.errors.length > 0 && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 space-y-1">
                  <p className="font-medium">{result.errors.length} row{result.errors.length !== 1 ? "s" : ""} skipped:</p>
                  {result.errors.map((e) => (
                    <p key={e.row} className="text-xs">Row {e.row}: {e.error}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" type="button" onClick={handleClose}>
              {result ? "Close" : "Cancel"}
            </Button>
            {result ? (
              <Button type="button" variant="primary" onClick={reset}>Import another file</Button>
            ) : (
              <Button
                type="button"
                onClick={handleImport}
                loading={loading}
                disabled={rows.length === 0 || loading || (hasExisting && mode === null)}
                variant={mode === "replace" && hasExisting ? "danger" : "primary"}
              >
                {mode === "replace" ? "Replace" : "Import"}{rows.length > 0 ? ` ${rows.length} row${rows.length !== 1 ? "s" : ""}` : ""}
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* Per-row edit modal — typed field editors, same as the entry form */}
      <Modal
        ref={editModalRef}
        open={editingCol}
        onClose={() => setEditRowIdx(null)}
        title={editRowIdx !== null ? `Edit row ${editRowIdx + 1}` : "Edit row"}
      >
        <form onSubmit={(e) => { e.preventDefault(); saveEditRow(); }} className="space-y-4">
          {columns.map((c) => (
            <FieldEditor
              key={c.key}
              col={c}
              value={editValues[c.key] ?? ""}
              onChange={(v) => setEditValues((vals) => ({ ...vals, [c.key]: v }))}
              projectId={projectId}
              basePath={basePath}
            />
          ))}
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" type="button" onClick={() => setEditRowIdx(null)}>Cancel</Button>
            <Button type="submit">Done</Button>
          </div>
        </form>
      </Modal>

      {/* Manage columns modal */}
      <ManageColumnsModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        columns={columns}
        setColumns={setColumns}
        setRows={setRows}
        nextKey={nextKey}
      />
    </>
  );
}

// ── Display cell (mirrors the entries page table) ──────────────────────────────
function DisplayCell({ type, value }: { type: string; value: string }) {
  if (!value) return <span className="text-slate-300">—</span>;
  if (type === "rich_text") return <span className="block truncate text-slate-700">{stripRichText(value)}</span>;
  if (type === "date") return <span className="block truncate text-slate-700">{formatDate(value)}</span>;
  if (type === "relation") return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-pink-50 border border-pink-200 text-pink-700 text-xs font-medium truncate max-w-full">{value}</span>;
  if (type === "enum") return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700 text-xs font-medium truncate max-w-full">{value}</span>;
  if (type === "boolean") return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${value === "true" ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-600"}`}>{value}</span>;
  if (type === "url") return <a href={value} target="_blank" rel="noopener noreferrer" className="block truncate text-indigo-600 hover:underline">{value}</a>;
  return <span className="block truncate text-slate-700">{value}</span>;
}

// ── Typed field editor (mirrors the entry create/edit form) ────────────────────
function FieldEditor({
  col, value, onChange, projectId, basePath,
}: {
  col: Col;
  value: string;
  onChange: (v: string) => void;
  projectId: string;
  basePath: string;
}) {
  if (col.type === "rich_text") {
    return <RichTextEditor label={col.name} value={value} onChange={onChange} />;
  }
  if (col.type === "textarea") {
    return <Textarea label={col.name} value={value} onChange={(e) => onChange(e.target.value)} rows={2} maxLength={LIMITS.ENTRY_TEXTAREA} />;
  }
  if (col.type === "date") {
    return <DatePicker label={col.name} value={value || null} onChange={(v) => onChange(v ?? "")} />;
  }
  if (col.type === "enum") {
    return (
      <Select
        label={col.name}
        value={value}
        onChange={onChange}
        options={[{ value: "", label: "Select…" }, ...(col.options ?? []).map((o) => ({ value: o, label: o }))]}
      />
    );
  }
  if (col.type === "relation" && col.relationCategoryId) {
    return (
      <RelationSelect
        label={col.name}
        value={value}
        onChange={onChange}
        projectId={projectId}
        targetCategoryId={col.relationCategoryId}
        basePath={basePath}
      />
    );
  }
  if (col.type === "boolean") {
    const isTrue = value === "true";
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-slate-700">{col.name}</span>
        <div className="flex rounded-lg border border-slate-300 overflow-hidden w-fit">
          <button type="button" onClick={() => onChange("true")} className={`px-4 py-1.5 text-sm font-medium transition-colors ${isTrue ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>True</button>
          <button type="button" onClick={() => onChange("false")} className={`px-4 py-1.5 text-sm font-medium transition-colors border-l border-slate-300 ${!isTrue ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>False</button>
        </div>
      </div>
    );
  }
  const maxLengthByType: Record<string, number> = {
    text: LIMITS.ENTRY_TEXT, url: LIMITS.ENTRY_URL, email: LIMITS.ENTRY_EMAIL,
  };
  return (
    <Input
      label={col.name}
      type={col.type === "number" ? "number" : col.type === "url" ? "url" : "text"}
      inputMode={col.type === "email" ? "email" : undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={maxLengthByType[col.type]}
    />
  );
}

// ── Manage columns modal (in-memory schema editor) ─────────────────────────────
function ManageColumnsModal({
  open, onClose, columns, setColumns, setRows, nextKey,
}: {
  open: boolean;
  onClose: () => void;
  columns: Col[];
  setColumns: React.Dispatch<React.SetStateAction<Col[]>>;
  setRows: React.Dispatch<React.SetStateAction<Record<string, string>[]>>;
  nextKey: () => string;
}) {
  const [optionInput, setOptionInput] = useState<Record<string, string>>({});

  function update(key: string, patch: Partial<Col>) {
    setColumns((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }
  function remove(key: string) {
    setColumns((cs) => cs.filter((c) => c.key !== key));
  }
  function add() {
    const key = nextKey();
    setColumns((cs) => [...cs, { key, name: "", type: "text" }]);
    setRows((rs) => rs.map((r) => ({ ...r, [key]: "" })));
  }
  function addOption(key: string) {
    const v = (optionInput[key] ?? "").trim();
    if (!v) return;
    const col = columns.find((c) => c.key === key);
    if (col?.options?.includes(v)) return;
    update(key, { options: [...(col?.options ?? []), v] });
    setOptionInput((p) => ({ ...p, [key]: "" }));
  }
  function removeOption(key: string, idx: number) {
    const col = columns.find((c) => c.key === key);
    update(key, { options: (col?.options ?? []).filter((_, i) => i !== idx) });
  }

  return (
    <Modal open={open} onClose={onClose} title="Manage Columns">
      <div className="space-y-3">
        {columns.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-6">No columns — add your first one below.</p>
        )}

        {columns.map((c) => {
          // Keep relation selectable only when the column already targets a category.
          const typeOpts = c.type === "relation"
            ? [{ value: "relation", label: "Relation" }, ...COLUMN_TYPES]
            : COLUMN_TYPES;
          return (
            <div key={c.key} className="space-y-2">
              <div className="grid grid-cols-[1fr_148px_32px] gap-2 items-start">
                <Input value={c.name} placeholder="Column name" onChange={(e) => update(c.key, { name: e.target.value })} />
                <Select
                  value={c.type}
                  onChange={(v) => update(c.key, { type: v, ...(v !== "enum" ? { options: [] } : {}) })}
                  options={typeOpts}
                />
                <button
                  type="button"
                  onClick={() => remove(c.key)}
                  className="h-9 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {c.type === "enum" && (
                <div className="ml-1 pl-3 border-l-2 border-slate-200 space-y-2">
                  <div className="flex flex-wrap gap-1.5 items-center min-h-[24px]">
                    {(c.options ?? []).length === 0 && <span className="text-xs text-slate-400">No options yet — add at least 2</span>}
                    {(c.options ?? []).map((opt, j) => (
                      <span key={j} className="flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full border border-indigo-200">
                        {opt}
                        <button type="button" onClick={() => removeOption(c.key, j)} className="text-indigo-400 hover:text-indigo-700 transition-colors leading-none">
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Add option…"
                      value={optionInput[c.key] ?? ""}
                      onChange={(e) => setOptionInput((p) => ({ ...p, [c.key]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOption(c.key); } }}
                      className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 w-36 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button type="button" onClick={() => addOption(c.key)} className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
                      <Plus size={12} /> Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <button type="button" onClick={add} className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors pt-1">
          <Plus size={14} /> Add column
        </button>

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <Button type="button" onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  );
}
