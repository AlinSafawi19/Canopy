"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Upload, Trash2 } from "lucide-react";

interface Field { name: string; type: string; options?: string[] }

// Same type→colour map used by the entries table on the page, so the import
// preview reads identically.
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
  enum:      "text-violet-500",
};

// Lightweight client-side column type inference for columns not already defined
// in the category schema (mirrors the server's inference).
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

interface Props {
  projectId: string;
  categoryId: string;
  fields: Field[];
  totalEntries?: number;
  basePath?: string;
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

// ── Value flattener ────────────────────────────────────────────────────────────
// Converts any JSON value to a human-readable string the same way a spreadsheet
// would display it:
//   { url: "https://..." }  →  "https://..."   (common link/image object)
//   ["a", "b"]              →  "a, b"           (arrays joined)
//   42 / true / null        →  "42" / "true" / ""
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

type ParsedRow = Record<string, string>;
type ImportMode = "replace" | "merge" | null;
type ImportResult = { created: number; updated: number; errors: Array<{ row: number; error: string }> };

export function ImportEntriesButton({
  projectId,
  categoryId,
  fields,
  totalEntries = 0,
  basePath = "/api/admin/projects",
}: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [mode, setMode] = useState<ImportMode>(null);

  function reset() {
    setRows([]);
    setParseError("");
    setResult(null);
    setMode(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleClose() {
    setOpen(false);
    reset();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError("");
    setRows([]);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        if (file.name.endsWith(".json")) {
          const parsed = JSON.parse(text);
          if (!Array.isArray(parsed)) throw new Error("JSON must be an array of objects.");
          setRows(parsed.map((r: unknown) =>
            typeof r === "object" && r !== null
              ? Object.fromEntries(Object.entries(r as Record<string, unknown>).map(([k, v]) => [k, flattenValue(v)]))
              : {}
          ));
        } else {
          const parsed = parseCSV(text);
          if (parsed.length === 0) throw new Error("No data rows found in file.");
          setRows(parsed);
        }
      } catch (err: unknown) {
        setParseError(err instanceof Error ? err.message : "Failed to parse file.");
      }
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    setLoading(true);
    setResult(null);
    setParseError("");
    try {
      const res = await apiFetch(
        `${basePath}/${projectId}/categories/${categoryId}/entries/import`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows, mode }),
        },
      );
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

  // Every column present across the parsed rows, with its resolved type:
  // existing schema type when the name matches, otherwise inferred from the data.
  const columns = useMemo(() => {
    const names = new Set<string>();
    for (const r of rows) for (const k of Object.keys(r)) names.add(k);
    return Array.from(names).map((name) => {
      const existing = fields.find((f) => f.name === name);
      return {
        name,
        type: existing ? existing.type : inferColumnTypeClient(rows, name),
        options: existing?.options,
      };
    });
  }, [rows, fields]);

  const hasExisting = totalEntries > 0;

  function updateCell(rowIdx: number, col: string, value: string) {
    setRows((rs) => rs.map((r, i) => (i === rowIdx ? { ...r, [col]: value } : r)));
  }
  function removeRow(rowIdx: number) {
    setRows((rs) => rs.filter((_, i) => i !== rowIdx));
  }

  const resultSummary = result
    ? [
        result.created > 0 ? `${result.created} row${result.created !== 1 ? "s" : ""} imported` : "",
        result.updated > 0 ? `${result.updated} row${result.updated !== 1 ? "s" : ""} updated` : "",
      ].filter(Boolean).join(", ") || "No changes made"
    : "";

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Upload size={14} />
        Import
      </Button>

      <Modal open={open} onClose={handleClose} title="Import Entries" size="lg">
        <div className="space-y-4">

          {/* Format note */}
          <p className="text-sm text-slate-500">
            Upload a <span className="font-medium text-slate-700">.csv</span> or{" "}
            <span className="font-medium text-slate-700">.json</span> file. The first CSV row
            must be column names matching this category&apos;s fields. JSON must be an array of
            objects. Up to 500 rows per import.
          </p>

          {/* File picker */}
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-lg py-8 px-4 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors">
            <Upload size={20} className="text-slate-400" />
            <span className="text-sm text-slate-600 font-medium">
              {rows.length > 0
                ? `${rows.length} row${rows.length !== 1 ? "s" : ""} ready to import`
                : "Click to choose file"}
            </span>
            <span className="text-xs text-slate-400">CSV or JSON</span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.json"
              className="hidden"
              onChange={handleFile}
            />
          </label>

          {/* Parse error */}
          {parseError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {parseError}
            </p>
          )}

          {/* Mode selector — only when existing data is present */}
          {rows.length > 0 && hasExisting && !result && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {totalEntries} existing {totalEntries === 1 ? "entry" : "entries"} found — how should we proceed?
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode("merge")}
                  className={`text-left px-3 py-2.5 rounded-lg border transition-colors ${
                    mode === "merge"
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 hover:border-slate-300 text-slate-600"
                  }`}
                >
                  <p className="text-sm font-medium">Merge</p>
                  <p className="text-xs opacity-75">Add new rows, update changed ones</p>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("replace")}
                  className={`text-left px-3 py-2.5 rounded-lg border transition-colors ${
                    mode === "replace"
                      ? "border-red-500 bg-red-50 text-red-700"
                      : "border-slate-200 hover:border-slate-300 text-slate-600"
                  }`}
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

          {/* Editable preview — all rows, typed columns, edit before importing */}
          {rows.length > 0 && !result && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Review &amp; edit — {rows.length} row{rows.length !== 1 ? "s" : ""}
                </p>
                <p className="text-xs text-slate-400">Edit any cell or remove rows before importing</p>
              </div>
              <div className="overflow-auto border border-slate-200 rounded-lg max-h-96">
                <table className="text-sm border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="w-10 px-3 py-2.5 text-left border-r border-slate-200 sticky left-0 bg-slate-50 text-[10px] font-medium text-slate-400">#</th>
                      {columns.map((c) => (
                        <th key={c.name} className="px-3 py-2.5 text-left font-medium text-slate-700 border-r border-slate-200 min-w-[160px] whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            <span>{c.name}</span>
                            <span className={`text-[10px] font-normal uppercase tracking-wide ${TYPE_COLORS[c.type] ?? "text-slate-400"}`}>
                              {c.type}
                            </span>
                          </div>
                        </th>
                      ))}
                      <th className="w-10 px-2 py-2.5 sticky right-0 bg-slate-50 border-l border-slate-200" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                        <td className="px-3 py-1.5 text-center text-xs text-slate-400 border-r border-slate-100 sticky left-0 bg-white">
                          {i + 1}
                        </td>
                        {columns.map((c) => {
                          const val = row[c.name] ?? "";
                          return (
                            <td key={c.name} className="px-1.5 py-1 border-r border-slate-100 align-top">
                              {c.type === "boolean" ? (
                                <select
                                  value={val}
                                  onChange={(e) => updateCell(i, c.name, e.target.value)}
                                  className="w-full bg-transparent text-sm text-slate-700 rounded px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                  <option value="">—</option>
                                  <option value="true">true</option>
                                  <option value="false">false</option>
                                </select>
                              ) : c.type === "enum" && c.options && c.options.length > 0 ? (
                                <select
                                  value={val}
                                  onChange={(e) => updateCell(i, c.name, e.target.value)}
                                  className="w-full bg-transparent text-sm text-slate-700 rounded px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                  <option value="">—</option>
                                  {c.options.map((o) => <option key={o} value={o}>{o}</option>)}
                                  {/* preserve an out-of-schema value so it isn't silently dropped */}
                                  {val && !c.options.includes(val) && <option value={val}>{val} (custom)</option>}
                                </select>
                              ) : (
                                <input
                                  value={val}
                                  onChange={(e) => updateCell(i, c.name, e.target.value)}
                                  inputMode={c.type === "number" ? "decimal" : undefined}
                                  spellCheck={false}
                                  className="w-full min-w-[140px] bg-transparent text-sm text-slate-700 rounded px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              )}
                            </td>
                          );
                        })}
                        <td className="px-1 py-1 sticky right-0 bg-white border-l border-slate-100">
                          <button
                            type="button"
                            onClick={() => removeRow(i)}
                            title="Remove this row from the import"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
            {!result && (
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
