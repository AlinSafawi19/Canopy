"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Plus, Trash2, Columns, X } from "lucide-react";

interface Field { name: string; type: string; options?: string[]; relationCategoryId?: string; multiple?: boolean }
interface Category { id: string; name: string }

const FIELD_TYPES = [
  { value: "text",      label: "Text" },
  { value: "textarea",  label: "Textarea" },
  { value: "rich_text", label: "Rich Text" },
  { value: "number",    label: "Number" },
  { value: "date",      label: "Date" },
  { value: "url",       label: "URL" },
  { value: "email",     label: "Email" },
  { value: "boolean",   label: "Boolean" },
  { value: "enum",      label: "Enum" },
  { value: "relation",  label: "Relation" },
];

export function ManageSchemaButton({
  projectId,
  categoryId,
  fields: initialFields,
  categories = [],
  basePath = "/api/admin/projects",
}: {
  projectId: string;
  categoryId: string;
  fields: Field[];
  categories?: Category[];
  basePath?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Field[]>(initialFields);
  const [optionInputs, setOptionInputs] = useState<Record<number, string>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());

  function handleOpen() {
    setFields(initialFields);
    setError("");
    setOptionInputs({});
    setSelected(new Set());
    setOpen(true);
  }

  function addField() {
    setFields((f) => [...f, { name: "", type: "text" }]);
  }

  function remapOptionInputs(p: Record<number, string>, removedIndices: Set<number>): Record<number, string> {
    const next: Record<number, string> = {};
    Object.entries(p).forEach(([k, v]) => {
      const ki = Number(k);
      if (!removedIndices.has(ki)) {
        const shift = Array.from(removedIndices).filter((idx) => idx < ki).length;
        next[ki - shift] = v;
      }
    });
    return next;
  }

  function removeField(i: number) {
    const removed = new Set([i]);
    setFields((f) => f.filter((_, idx) => idx !== i));
    setOptionInputs((p) => remapOptionInputs(p, removed));
    setSelected((prev) => {
      const next = new Set<number>();
      prev.forEach((idx) => {
        if (idx < i) next.add(idx);
        else if (idx > i) next.add(idx - 1);
      });
      return next;
    });
  }

  function removeSelected() {
    setFields((f) => f.filter((_, idx) => !selected.has(idx)));
    setOptionInputs((p) => remapOptionInputs(p, selected));
    setSelected(new Set());
  }

  function toggleSelect(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === fields.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(fields.map((_, i) => i)));
    }
  }

  function updateField(i: number, patch: Partial<Field>) {
    setFields((f) => f.map((field, idx) => idx === i ? { ...field, ...patch } : field));
    setError("");
  }

  function addOption(fieldIdx: number) {
    const val = (optionInputs[fieldIdx] ?? "").trim();
    if (!val) return;
    const existing = fields[fieldIdx].options ?? [];
    if (existing.includes(val)) return;
    updateField(fieldIdx, { options: [...existing, val] });
    setOptionInputs((p) => ({ ...p, [fieldIdx]: "" }));
  }

  function removeOption(fieldIdx: number, optIdx: number) {
    const existing = fields[fieldIdx].options ?? [];
    updateField(fieldIdx, { options: existing.filter((_, i) => i !== optIdx) });
  }

  async function save() {
    const names = fields.map((f) => f.name.trim());
    if (names.some((n) => !n)) { setError("All columns must have a name"); return; }
    if (new Set(names).size !== names.length) { setError("Column names must be unique"); return; }
    for (const f of fields) {
      if (f.type === "enum" && (!f.options || f.options.length < 2)) {
        setError(`"${f.name || "Enum column"}" must have at least 2 options`);
        return;
      }
      if (f.type === "relation" && !f.relationCategoryId) {
        setError(`"${f.name || "Relation column"}" must have a target category selected`);
        return;
      }
    }

    setLoading(true);
    setError("");
    const res = await apiFetch(`${basePath}/${projectId}/categories/${categoryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: fields.map((f) => ({
          name: f.name.trim(),
          type: f.type,
          ...(f.type === "enum" ? { options: f.options ?? [] } : {}),
          ...(f.type === "relation" ? { relationCategoryId: f.relationCategoryId ?? "", multiple: !!f.multiple } : {}),
        })),
      }),
    });
    setLoading(false);
    if (!res.ok) { setError("Failed to save columns"); return; }
    setOpen(false);
    router.refresh();
  }

  const allSelected = fields.length > 0 && selected.size === fields.length;
  const someSelected = selected.size > 0 && selected.size < fields.length;

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleOpen} className="gap-1.5">
        <Columns size={14} />
        Manage Columns
        {initialFields.length > 0 && (
          <span className="ml-0.5 text-xs text-slate-400">({initialFields.length})</span>
        )}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Manage Columns">
        <div className="space-y-3">

          {/* Bulk selection action bar */}
          {selected.size > 0 && (
            <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <span className="text-sm text-red-700 font-medium">
                {selected.size} column{selected.size !== 1 ? "s" : ""} selected
              </span>
              <button
                type="button"
                onClick={removeSelected}
                className="flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
              >
                <Trash2 size={13} />
                Delete selected
              </button>
            </div>
          )}

          {/* Header row */}
          {fields.length > 0 && (
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

          {fields.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">
              No columns yet — add your first one below.
            </p>
          )}

          {fields.map((field, i) => (
            <div key={i} className="space-y-2">
              <div className="grid grid-cols-[20px_1fr_32px] sm:grid-cols-[20px_1fr_148px_32px] gap-2 items-start">
                <div className="h-9 flex items-center">
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    onChange={() => toggleSelect(i)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>
                <Input
                  value={field.name}
                  placeholder="e.g. Title"
                  onChange={(e) => updateField(i, { name: e.target.value })}
                />
                {/* On mobile: drops to row 2, spans both columns. On sm+: normal column 3. */}
                <div className="col-span-2 order-3 sm:col-span-1 sm:order-none">
                  <Select
                    value={field.type}
                    onChange={(v) => updateField(i, {
                      type: v,
                      ...(v !== "enum" ? { options: [] } : {}),
                    })}
                    options={FIELD_TYPES}
                  />
                </div>
                {/* On mobile: stays row 1 col 3 next to input. On sm+: normal column 4. */}
                <button
                  type="button"
                  onClick={() => removeField(i)}
                  className="order-2 sm:order-none h-9 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {field.type === "enum" && (
                <div className="ml-5 pl-3 border-l-2 border-slate-200 space-y-2">
                  <div className="flex flex-wrap gap-1.5 items-center min-h-[24px]">
                    {(field.options ?? []).length === 0 && (
                      <span className="text-xs text-slate-400">No options yet — add at least 2</span>
                    )}
                    {(field.options ?? []).map((opt, j) => (
                      <span
                        key={j}
                        className="flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full border border-indigo-200"
                      >
                        {opt}
                        <button
                          type="button"
                          onClick={() => removeOption(i, j)}
                          className="text-indigo-400 hover:text-indigo-700 transition-colors leading-none"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Add option…"
                      value={optionInputs[i] ?? ""}
                      onChange={(e) => setOptionInputs((p) => ({ ...p, [i]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOption(i); } }}
                      className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 w-36 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => addOption(i)}
                      className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                    >
                      <Plus size={12} />
                      Add
                    </button>
                  </div>
                </div>
              )}

              {field.type === "relation" && (
                <div className="ml-5 pl-3 border-l-2 border-pink-200 space-y-2">
                  <Select
                    value={field.relationCategoryId ?? ""}
                    onChange={(v) => updateField(i, { relationCategoryId: v })}
                    options={[
                      { value: "", label: "Select target category…" },
                      ...categories
                        .filter((c) => c.id !== categoryId)
                        .map((c) => ({ value: c.id, label: c.name })),
                    ]}
                  />
                  {categories.filter((c) => c.id !== categoryId).length === 0 && (
                    <p className="text-xs text-slate-400">No other categories in this project yet.</p>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer w-fit">
                    <input
                      type="checkbox"
                      checked={!!field.multiple}
                      onChange={(e) => updateField(i, { multiple: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 accent-indigo-600 cursor-pointer"
                    />
                    <span className="text-xs font-medium text-slate-600">Allow multiple references</span>
                  </label>
                </div>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addField}
            className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors pt-1"
          >
            <Plus size={14} />
            Add column
          </button>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={loading}>Save Columns</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
