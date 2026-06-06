"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { DatePicker } from "@/components/ui/date-picker";
import { RelationSelect } from "@/components/ui/relation-select";
import { LIMITS } from "@/lib/limits";
import { stripRichText, formatDate } from "@/lib/utils";
import { Upload, Trash2, Plus, X, Columns, Pencil } from "lucide-react";

interface Field { name: string; type: string; options?: string[]; relationCategoryId?: string; multiple?: boolean }

interface Props {
  projectId: string;
  categoryId: string;
  fields: Field[];
  totalEntries?: number;
  basePath?: string;
  categories?: { id: string; name: string }[];
}

// Editable column with a stable key, so renaming a header never loses cell data.
type Col = { key: string; name: string; type: string; options?: string[]; relationCategoryId?: string; multiple?: boolean };
type ImportMode = "replace" | "merge" | null;
type ImportResult = { created: number; updated: number; errors: Array<{ row: number; error: string }> };

const MAX_IMPORT_ROWS = 500; // mirrors src/lib/entries-io.ts

// Shared shell so every view (import / manage / row editor) has the same size,
// a scrollable body, and a footer pinned to the modal's bottom edge. The -m-6
// cancels the Modal's own padding so the footer sits flush against the border.
const VIEW_SHELL = "flex flex-col h-[70vh] -m-6";
const VIEW_BODY = "flex-1 overflow-y-auto min-h-0 p-6";
const VIEW_FOOTER = "flex-shrink-0 flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-white";

// Same type→colour map as the entries page table.
const TYPE_COLORS: Record<string, string> = {
  text: "text-violet-500", textarea: "text-blue-500", rich_text: "text-purple-600",
  number: "text-amber-500", date: "text-emerald-500", boolean: "text-rose-500",
  url: "text-cyan-500", email: "text-indigo-500", relation: "text-pink-500", enum: "text-violet-500",
};

// Same list/order as ManageSchemaButton's FIELD_TYPES.
const COLUMN_TYPES = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Textarea" },
  { value: "rich_text", label: "Rich Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "url", label: "URL" },
  { value: "email", label: "Email" },
  { value: "boolean", label: "Boolean" },
  { value: "enum", label: "Enum" },
  { value: "relation", label: "Relation" },
];

// Distinct, trimmed, non-empty values for a column — used for enum detection/options.
function distinctValues(rows: Record<string, string>[], key: string): string[] {
  const seen = new Set<string>();
  for (const r of rows) {
    const v = (r[key] ?? "").trim();
    if (v) seen.add(v);
  }
  return [...seen];
}

// A column "looks like" an enum when it has enough rows, the values repeat into a
// small set of short labels, and the distinct count stays within the schema limit.
function looksLikeEnum(rows: Record<string, string>[], key: string): boolean {
  const vals = rows.map((r) => (r[key] ?? "").trim()).filter(Boolean);
  if (vals.length < 4) return false;
  const distinct = distinctValues(rows, key);
  if (distinct.length < 2) return false;
  if (distinct.length > Math.min(20, Math.ceil(vals.length / 2))) return false; // must repeat
  return distinct.every((v) => v.length <= 50);
}

// Comparison keys for matching a relation value to an entry label, ignoring
// case (upper/lower/capitalised) and singular/plural form. e.g. "Categories",
// "category", and "CATEGORY" all share the key "category".
function relationMatchKeys(s: string): string[] {
  const v = s.trim().toLowerCase();
  if (!v) return [];
  const keys = new Set<string>([v]);
  if (v.endsWith("ies") && v.length > 3) keys.add(v.slice(0, -3) + "y"); // categories → category
  if (v.endsWith("es") && v.length > 2) keys.add(v.slice(0, -2));        // boxes → box
  if (v.endsWith("s") && v.length > 1) keys.add(v.slice(0, -1));         // brands → brand
  if (v.endsWith("y") && v.length > 1) keys.add(v.slice(0, -1) + "ies"); // category → categories
  keys.add(v + "s");                                                      // brand → brands
  return [...keys];
}

function inferColumnTypeClient(rows: Record<string, string>[], key: string): string {
  const vals = rows.map((r) => r[key]).filter((v) => v !== "" && v != null);
  if (vals.length === 0) return "text";
  if (vals.every((v) => /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v.trim()))) return "number";
  if (vals.every((v) => /^https?:\/\/.+/i.test(v.trim()))) return "url";
  if (vals.every((v) => /^(true|false)$/i.test(v.trim()))) return "boolean";
  if (vals.every((v) => /^\d{4}-\d{2}-\d{2}/.test(v.trim()))) return "date";
  if (vals.some((v) => /<[a-z][\s\S]*?>/i.test(v))) return "rich_text";
  if (looksLikeEnum(rows, key)) return "enum";
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
  categories = [],
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

  // Which view fills the single modal — avoids stacking modals on top of each other.
  const [view, setView] = useState<"main" | "manage" | "editRow">("main");
  const [editRowIdx, setEditRowIdx] = useState<number | null>(null);
  const [addingRow, setAddingRow] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const nextKey = () => `c${keyCounter.current++}`;
  const hasExisting = totalEntries > 0;

  function reset() {
    setColumns([]);
    setRows([]);
    setParseError("");
    setResult(null);
    setMode(null);
    setView("main");
    setEditRowIdx(null);
    setAddingRow(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleClose() {
    setOpen(false);
    reset();
  }

  // Fetches a sibling category's entry labels as case/plural-insensitive match
  // keys (see relationMatchKeys) for relation detection.
  async function fetchLabelSet(catId: string): Promise<Set<string>> {
    try {
      const res = await apiFetch(`${basePath}/${projectId}/categories/${catId}/entries/select?limit=200`);
      const data = await res.json().catch(() => ({}));
      const items: Array<{ label?: string }> = Array.isArray(data.items) ? data.items : [];
      const set = new Set<string>();
      for (const it of items) for (const k of relationMatchKeys(String(it.label ?? ""))) set.add(k);
      return set;
    } catch {
      return new Set();
    }
  }

  // A new (non-existing) text/enum column whose values mostly match the labels of
  // one sibling category is retyped as a relation pointing at that category.
  async function detectRelations(cols: Col[], parsed: Record<string, string>[]) {
    const targets = categories.filter((c) => c.id !== categoryId);
    const candidates = cols.filter(
      (c) => !fields.some((f) => f.name === c.name) && (c.type === "text" || c.type === "enum"),
    );
    if (targets.length === 0 || candidates.length === 0) return;

    const labelSets = await Promise.all(targets.map((t) => fetchLabelSet(t.id)));
    for (const col of candidates) {
      // Each cell may hold several comma-separated references, so match on the
      // individual tokens — and remember when a cell carries more than one.
      const tokenized = parsed
        .map((r) => (r[col.name] ?? "").split(",").map((t) => t.trim()).filter(Boolean))
        .filter((toks) => toks.length > 0);
      const distinctTokens = [...new Set(tokenized.flat())];
      if (distinctTokens.length === 0) continue;
      let best = { idx: -1, rate: 0 };
      labelSets.forEach((set, idx) => {
        if (set.size === 0) return;
        // A token matches if any of its case/plural variants is a known label key.
        const matched = distinctTokens.filter((v) => relationMatchKeys(v).some((k) => set.has(k))).length;
        const rate = matched / distinctTokens.length;
        if (rate > best.rate) best = { idx, rate };
      });
      // Require a strong match so plain text columns aren't misread as relations.
      if (best.idx >= 0 && best.rate >= 0.8) {
        col.type = "relation";
        col.relationCategoryId = targets[best.idx].id;
        col.options = undefined;
        // Any cell referencing more than one entry makes this a multiple relation.
        col.multiple = tokenized.some((toks) => toks.length > 1);
      }
    }
  }

  // ── parsing ──────────────────────────────────────────────
  async function ingest(parsed: Record<string, string>[]) {
    const names: string[] = [];
    for (const r of parsed) for (const k of Object.keys(r)) if (!names.includes(k)) names.push(k);

    const cols: Col[] = names.map((name) => {
      const existing = fields.find((f) => f.name === name);
      const type = existing ? existing.type : inferColumnTypeClient(parsed, name);
      // A freshly-inferred enum gets its options seeded from the values found.
      const options =
        existing?.options ?? (type === "enum" ? distinctValues(parsed, name) : undefined);
      return {
        key: nextKey(),
        name,
        type,
        options,
        relationCategoryId: existing?.relationCategoryId,
        multiple: existing?.multiple,
      };
    });

    await detectRelations(cols, parsed);

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
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      try {
        if (file.name.endsWith(".json")) {
          const parsed = JSON.parse(text);
          if (!Array.isArray(parsed)) throw new Error("JSON must be an array of objects.");
          await ingest(parsed.map((r: unknown) =>
            typeof r === "object" && r !== null
              ? Object.fromEntries(Object.entries(r as Record<string, unknown>).map(([k, v]) => [k, flattenValue(v)]))
              : {}
          ));
        } else {
          const parsed = parseCSV(text);
          if (parsed.length === 0) throw new Error("No data rows found in file.");
          await ingest(parsed);
        }
      } catch (err: unknown) {
        setParseError(err instanceof Error ? err.message : "Failed to parse file.");
      }
    };
    reader.readAsText(file);
  }

  // ── view navigation ──────────────────────────────────────
  function backToMain() {
    setView("main");
    setEditRowIdx(null);
    setAddingRow(false);
  }

  // ── row editing ──────────────────────────────────────────
  function openEditRow(idx: number) {
    setAddingRow(false);
    setEditValues({ ...rows[idx] });
    setEditRowIdx(idx);
    setView("editRow");
  }
  function openAddRow() {
    // Open the editor with a blank row — only committed to the table on confirm.
    setAddingRow(true);
    setEditRowIdx(null);
    setEditValues(Object.fromEntries(columns.map((c) => [c.key, ""])));
    setView("editRow");
  }
  function saveEditRow() {
    if (addingRow) {
      setRows((rs) => [...rs, { ...editValues }]);
    } else if (editRowIdx !== null) {
      setRows((rs) => rs.map((r, i) => (i === editRowIdx ? { ...editValues } : r)));
    }
    backToMain();
  }
  function removeRow(idx: number) {
    setRows((rs) => rs.filter((_, i) => i !== idx));
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
      ...(c.type === "relation" ? { relationCategoryId: c.relationCategoryId, multiple: !!c.multiple } : {}),
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

  const modalTitle =
    view === "manage" ? "Manage Columns"
    : view === "editRow" ? (addingRow ? "Add row" : `Edit row ${(editRowIdx ?? 0) + 1}`)
    : "Import Entries";

  // The X / backdrop returns to the main view from a sub-view, or closes from main.
  const onModalClose = () => { if (view === "main") handleClose(); else backToMain(); };

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Upload size={14} />
        Import
      </Button>

      <Modal open={open} onClose={onModalClose} title={modalTitle} size="xl">
        {/* ── Manage Columns view ── */}
        {view === "manage" && (
          <ManageColumnsPanel
            columns={columns}
            setColumns={setColumns}
            rows={rows}
            setRows={setRows}
            nextKey={nextKey}
            categories={categories}
            categoryId={categoryId}
            onDone={backToMain}
          />
        )}

        {/* ── Row editor view ── */}
        {view === "editRow" && (
          <form onSubmit={(e) => { e.preventDefault(); saveEditRow(); }} className={VIEW_SHELL}>
            <div className={`${VIEW_BODY} space-y-4`}>
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
            </div>
            <div className={VIEW_FOOTER}>
              <Button variant="outline" type="button" onClick={backToMain}>Cancel</Button>
              <Button type="submit">{addingRow ? "Add row" : "Done"}</Button>
            </div>
          </form>
        )}

        <div className={`${view === "main" ? "flex" : "hidden"} flex-col h-[70vh] -m-6`}>
         <div className={`${VIEW_BODY} flex flex-col gap-4`}>

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
                className="w-full flex-1 min-h-[200px] flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-lg py-8 px-4 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors"
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
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between gap-3 mb-2 flex-wrap flex-shrink-0">
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
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setView("manage")}>
                    <Columns size={13} /> Manage Columns
                  </Button>
                  <Button size="sm" className="gap-1.5" onClick={openAddRow}>
                    <Plus size={13} /> Add Row
                  </Button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden flex-1 min-h-0">
                <div className="overflow-auto h-full">
                  <table className="w-full text-sm border-collapse">
                    <thead className="sticky top-0 z-20">
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="w-10 px-3 py-2.5 text-left border-r border-slate-200 sticky left-0 bg-slate-50 z-30 text-xs font-medium text-slate-400">#</th>
                        {columns.map((c) => (
                          <th key={c.key} className="px-4 py-2.5 text-left font-medium text-slate-700 border-r border-slate-200 min-w-[160px] whitespace-nowrap bg-slate-50">
                            <div className="flex flex-col gap-0.5">
                              <span>{c.name || <span className="text-slate-300 italic">unnamed</span>}</span>
                              <span className={`text-[10px] font-normal uppercase tracking-wide ${TYPE_COLORS[c.type] ?? "text-slate-400"}`}>
                                {c.type}
                              </span>
                            </div>
                          </th>
                        ))}
                        <th className="px-4 py-2.5 text-left font-medium text-slate-700 whitespace-nowrap sticky right-0 bg-slate-50 z-30">
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

         </div>

          {/* Actions — pinned footer */}
          <div className={VIEW_FOOTER}>
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
    </>
  );
}

// ── Display cell (mirrors the entries page table) ──────────────────────────────
function DisplayCell({ type, value }: { type: string; value: string }) {
  if (!value) return <span className="text-slate-300">—</span>;
  if (type === "rich_text") return <span className="block truncate text-slate-700">{stripRichText(value)}</span>;
  if (type === "date") return <span className="block truncate text-slate-700">{formatDate(value)}</span>;
  if (type === "relation") {
    // A multiple-reference cell is comma-separated — render each as its own tag.
    const refs = value.split(",").map((s) => s.trim()).filter(Boolean);
    return (
      <span className="flex flex-wrap gap-1">
        {refs.map((ref, i) => (
          <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full bg-pink-50 border border-pink-200 text-pink-700 text-xs font-medium max-w-full truncate">{ref}</span>
        ))}
      </span>
    );
  }
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

// ── Manage columns panel — mirrors the page's ManageSchemaButton, in-memory ────
function ManageColumnsPanel({
  columns, setColumns, rows, setRows, nextKey, categories, categoryId, onDone,
}: {
  columns: Col[];
  setColumns: React.Dispatch<React.SetStateAction<Col[]>>;
  rows: Record<string, string>[];
  setRows: React.Dispatch<React.SetStateAction<Record<string, string>[]>>;
  nextKey: () => string;
  categories: { id: string; name: string }[];
  categoryId: string;
  onDone: () => void;
}) {
  // Edits happen on a local draft so "Back" discards them — only "Done" commits
  // to the parent. (The panel unmounts on Back, so the draft is simply dropped.)
  const [draft, setDraft] = useState<Col[]>(columns);
  const [optionInputs, setOptionInputs] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  function update(key: string, patch: Partial<Col>) {
    setDraft((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c)));
    setError("");
  }
  // Changing type to enum seeds the options from the distinct values already
  // in that column, so users don't re-type what the file already contains.
  function changeType(key: string, type: string) {
    if (type !== "enum") { update(key, { type, options: [] }); return; }
    const existing = draft.find((c) => c.key === key)?.options ?? [];
    const merged = [...existing];
    for (const r of rows) {
      const v = (r[key] ?? "").trim();
      if (v && !merged.includes(v)) merged.push(v);
    }
    update(key, { type, options: merged });
  }
  function add() {
    setDraft((cs) => [...cs, { key: nextKey(), name: "", type: "text" }]);
  }
  function remove(key: string) {
    setDraft((cs) => cs.filter((c) => c.key !== key));
    setSelected((prev) => { const n = new Set(prev); n.delete(key); return n; });
  }
  function removeSelected() {
    setDraft((cs) => cs.filter((c) => !selected.has(c.key)));
    setSelected(new Set());
  }
  function toggleSelect(key: string) {
    setSelected((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  }
  function toggleAll() {
    setSelected(selected.size === draft.length ? new Set() : new Set(draft.map((c) => c.key)));
  }
  function addOption(key: string) {
    const v = (optionInputs[key] ?? "").trim();
    if (!v) return;
    const col = draft.find((c) => c.key === key);
    if (col?.options?.includes(v)) return;
    update(key, { options: [...(col?.options ?? []), v] });
    setOptionInputs((p) => ({ ...p, [key]: "" }));
  }
  function removeOption(key: string, idx: number) {
    const col = draft.find((c) => c.key === key);
    update(key, { options: (col?.options ?? []).filter((_, i) => i !== idx) });
  }

  function done() {
    const names = draft.map((c) => c.name.trim());
    if (names.some((n) => !n)) { setError("All columns must have a name"); return; }
    if (new Set(names).size !== names.length) { setError("Column names must be unique"); return; }
    for (const c of draft) {
      if (c.type === "enum" && (!c.options || c.options.length < 2)) {
        setError(`"${c.name || "Enum column"}" must have at least 2 options`); return;
      }
      if (c.type === "relation" && !c.relationCategoryId) {
        setError(`"${c.name || "Relation column"}" must have a target category selected`); return;
      }
    }
    setError("");
    // Commit the draft, backfilling row cells for any columns added here.
    setColumns(draft);
    const originalKeys = new Set(columns.map((c) => c.key));
    const addedKeys = draft.filter((c) => !originalKeys.has(c.key)).map((c) => c.key);
    if (addedKeys.length > 0) {
      setRows((rs) => rs.map((r) => {
        const o = { ...r };
        for (const k of addedKeys) if (!(k in o)) o[k] = "";
        return o;
      }));
    }
    onDone();
  }

  const targetCategories = categories.filter((c) => c.id !== categoryId);
  const allSelected = draft.length > 0 && selected.size === draft.length;
  const someSelected = selected.size > 0 && selected.size < draft.length;

  return (
      <div className={VIEW_SHELL}>
       <div className={`${VIEW_BODY} space-y-3`}>

        {/* Bulk selection action bar */}
        {selected.size > 0 && (
          <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <span className="text-sm text-red-700 font-medium">
              {selected.size} column{selected.size !== 1 ? "s" : ""} selected
            </span>
            <button type="button" onClick={removeSelected} className="flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700 transition-colors">
              <Trash2 size={13} /> Delete selected
            </button>
          </div>
        )}

        {/* Header row */}
        {draft.length > 0 && (
          <div className="hidden sm:grid grid-cols-[20px_1fr_148px_32px] gap-2 pb-1 items-center">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => { if (el) el.indeterminate = someSelected; }}
              onChange={toggleAll}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <span className="text-xs font-medium text-slate-500">Column Name</span>
            <span className="text-xs font-medium text-slate-500">Type</span>
            <span />
          </div>
        )}

        {draft.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-6">No columns yet — add your first one below.</p>
        )}

        {draft.map((c) => (
          <div key={c.key} className="space-y-2">
            <div className="grid grid-cols-[20px_1fr_32px] sm:grid-cols-[20px_1fr_148px_32px] gap-2 items-start">
              <div className="h-9 flex items-center">
                <input
                  type="checkbox"
                  checked={selected.has(c.key)}
                  onChange={() => toggleSelect(c.key)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </div>
              <Input value={c.name} placeholder="e.g. Title" onChange={(e) => update(c.key, { name: e.target.value })} />
              <div className="col-span-2 order-3 sm:col-span-1 sm:order-none">
                <Select
                  value={c.type}
                  onChange={(v) => changeType(c.key, v)}
                  options={COLUMN_TYPES}
                />
              </div>
              <button
                type="button"
                onClick={() => remove(c.key)}
                className="order-2 sm:order-none h-9 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>

            {c.type === "enum" && (
              <div className="ml-5 pl-3 border-l-2 border-slate-200 space-y-2">
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
                    value={optionInputs[c.key] ?? ""}
                    onChange={(e) => setOptionInputs((p) => ({ ...p, [c.key]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOption(c.key); } }}
                    className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 w-36 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <button type="button" onClick={() => addOption(c.key)} className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors">
                    <Plus size={12} /> Add
                  </button>
                </div>
              </div>
            )}

            {c.type === "relation" && (
              <div className="ml-5 pl-3 border-l-2 border-pink-200 space-y-2">
                <Select
                  value={c.relationCategoryId ?? ""}
                  onChange={(v) => update(c.key, { relationCategoryId: v })}
                  options={[
                    { value: "", label: "Select target category…" },
                    ...targetCategories.map((cat) => ({ value: cat.id, label: cat.name })),
                  ]}
                />
                {targetCategories.length === 0 && (
                  <p className="text-xs text-slate-400">No other categories in this project yet.</p>
                )}
                <label className="flex items-center gap-2 cursor-pointer w-fit">
                  <input
                    type="checkbox"
                    checked={!!c.multiple}
                    onChange={(e) => update(c.key, { multiple: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 accent-indigo-600 cursor-pointer"
                  />
                  <span className="text-xs font-medium text-slate-600">Allow multiple references</span>
                </label>
              </div>
            )}
          </div>
        ))}

        <button type="button" onClick={add} className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors pt-1">
          <Plus size={14} /> Add column
        </button>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}
       </div>

        <div className={VIEW_FOOTER}>
          <Button variant="outline" type="button" onClick={onDone}>Back</Button>
          <Button type="button" onClick={done}>Done</Button>
        </div>
      </div>
  );
}
