"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Plus, Trash2, Columns, X } from "lucide-react";
import type { MigrationImpact } from "@/lib/field-coerce";
import { SAFE_FIELD_NAME_RE } from "@/lib/limits";

interface Field { name: string; type: string; options?: string[]; relationCategoryId?: string; multiple?: boolean; countCategoryId?: string; countFieldName?: string }
interface Category { id: string; name: string; fields?: Array<{ name: string; type: string; relationCategoryId?: string }> }

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
  { value: "count",     label: "Count" },
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
  const [impact, setImpact] = useState<MigrationImpact[] | null>(null);

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

  function buildFieldsPayload() {
    return fields.map((f) => ({
      name: f.name.trim(),
      type: f.type,
      ...(f.type === "enum" ? { options: f.options ?? [] } : {}),
      ...(f.type === "relation" ? { relationCategoryId: f.relationCategoryId ?? "", multiple: !!f.multiple } : {}),
      ...(f.type === "count" ? { countCategoryId: f.countCategoryId ?? "", countFieldName: f.countFieldName ?? "" } : {}),
    }));
  }

  /** True if any existing column's type or multiplicity changed (data may be affected). */
  function hasTypeChanges(): boolean {
    const initialByName = new Map(initialFields.map((f) => [f.name, f]));
    return fields.some((f) => {
      const init = initialByName.get(f.name.trim());
      return init && (init.type !== f.type || !!init.multiple !== !!f.multiple);
    });
  }

  function validate(): boolean {
    const names = fields.map((f) => f.name.trim());
    if (names.some((n) => !n)) { setError("All columns must have a name"); return false; }
    if (new Set(names).size !== names.length) { setError("Column names must be unique"); return false; }
    for (const name of names) {
      if (!SAFE_FIELD_NAME_RE.test(name)) {
        setError(`"${name}" is not a valid column name — names must start with a letter or underscore and may only contain letters, digits, underscores, and spaces (max 64 characters)`);
        return false;
      }
    }
    for (const f of fields) {
      if (f.type === "enum" && (!f.options || f.options.length < 2)) {
        setError(`"${f.name || "Enum column"}" must have at least 2 options`);
        return false;
      }
      if (f.type === "relation" && !f.relationCategoryId) {
        setError(`"${f.name || "Relation column"}" must have a target category selected`);
        return false;
      }
      if (f.type === "count" && !f.countCategoryId) {
        setError(`"${f.name || "Count column"}" must have a source category selected`);
        return false;
      }
      if (f.type === "count" && !f.countFieldName) {
        setError(`"${f.name || "Count column"}" must have a source relation field selected`);
        return false;
      }
    }
    setError("");
    return true;
  }

  const url = `${basePath}/${projectId}/categories/${categoryId}`;

  async function attemptSave() {
    if (!validate()) return;

    // No type changes → save directly.
    if (!hasTypeChanges()) { doSave(); return; }

    // Type changes → measure impact on existing data first.
    setLoading(true);
    const res = await apiFetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: buildFieldsPayload(), dryRun: true }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    const imp: MigrationImpact[] = data.impact ?? [];
    // If no entries actually hold values for the changed columns, just save.
    if (!imp.some((i) => i.total > 0)) { doSave(); return; }
    setImpact(imp);
  }

  async function doSave() {
    setImpact(null);
    setLoading(true);
    setError("");
    const res = await apiFetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: buildFieldsPayload() }),
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
      <Button variant="outline" onClick={handleOpen} className="gap-1.5">
        <Columns size={14} />
        Manage Columns
        {initialFields.length > 0 && (
          <span className="ml-0.5 text-xs text-slate-400">({initialFields.length})</span>
        )}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Manage Columns" busy={loading}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={attemptSave} loading={loading}>Save Columns</Button>
          </div>
        }
      >
        <div className="space-y-3">

          {/* Bulk selection action bar */}
          {selected.size > 0 && (
            <div className="flex items-center justify-between px-1 py-1">
              <span className="text-sm text-slate-600 font-medium">
                {selected.size} column{selected.size !== 1 ? "s" : ""} selected
              </span>
              <button
                type="button"
                onClick={removeSelected}
                className="flex items-center gap-1.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors px-3 py-1.5 rounded-lg"
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
                      ...(v !== "count" ? { countCategoryId: undefined, countFieldName: undefined } : {}),
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

              {field.type === "count" && (() => {
                const sourceCategory = categories.find((c) => c.id === field.countCategoryId);
                const sourceRelationFields = (sourceCategory?.fields ?? []).filter(
                  (f) => f.type === "relation" && f.relationCategoryId === categoryId
                );
                return (
                  <div className="ml-5 pl-3 border-l-2 border-orange-200 space-y-2">
                    <Select
                      value={field.countCategoryId ?? ""}
                      onChange={(v) => updateField(i, { countCategoryId: v, countFieldName: "" })}
                      options={[
                        { value: "", label: "Select source category…" },
                        ...categories
                          .filter((c) => c.id !== categoryId)
                          .map((c) => ({ value: c.id, label: c.name })),
                      ]}
                    />
                    {field.countCategoryId && (
                      <>
                        {sourceRelationFields.length === 0 ? (
                          <p className="text-xs text-slate-400">
                            No relation fields in that category point to this category yet.
                          </p>
                        ) : (
                          <Select
                            value={field.countFieldName ?? ""}
                            onChange={(v) => updateField(i, { countFieldName: v })}
                            options={[
                              { value: "", label: "Select relation field…" },
                              ...sourceRelationFields.map((f) => ({ value: f.name, label: f.name })),
                            ]}
                          />
                        )}
                      </>
                    )}
                  </div>
                );
              })()}
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
        </div>
      </Modal>

      <ConfirmModal
        open={!!impact}
        onClose={() => setImpact(null)}
        onConfirm={doSave}
        title="Change column types?"
        message="Existing values will be converted to the new type. Any that can't be converted will be permanently cleared:"
        confirmLabel={
          (impact ?? []).some((i) => i.cleared > 0) ? "Convert & clear" : "Convert & save"
        }
        variant="warning"
        loading={loading}
      >
        <div className="space-y-2">
          {(impact ?? []).filter((i) => i.total > 0).map((i) => (
            <div key={i.name} className="rounded-lg border border-slate-200 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-800 truncate">{i.name}</span>
                <span className="text-xs text-slate-400 font-mono flex-shrink-0">{i.from} → {i.to}</span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs">
                <span className="text-emerald-600">{i.converted} kept</span>
                {i.cleared > 0
                  ? <span className="text-red-600 font-medium">{i.cleared} cleared</span>
                  : <span className="text-slate-400">0 cleared</span>}
                <span className="text-slate-400">of {i.total}</span>
              </div>
            </div>
          ))}
        </div>
      </ConfirmModal>
    </>
  );
}
