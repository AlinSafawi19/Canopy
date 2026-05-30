"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Plus, Trash2, Columns } from "lucide-react";

interface Field { name: string; type: string }

const FIELD_TYPES = [
  { value: "text",      label: "Text" },
  { value: "textarea",  label: "Textarea" },
  { value: "rich_text", label: "Rich Text" },
  { value: "number",    label: "Number" },
  { value: "date",      label: "Date" },
  { value: "url",       label: "URL" },
  { value: "email",     label: "Email" },
  { value: "boolean",   label: "Boolean" },
];

export function ManageSchemaButton({
  projectId,
  categoryId,
  fields: initialFields,
  basePath = "/api/admin/projects",
}: {
  projectId: string;
  categoryId: string;
  fields: Field[];
  basePath?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Field[]>(initialFields);

  function handleOpen() {
    setFields(initialFields);
    setError("");
    setOpen(true);
  }

  function addField() {
    setFields((f) => [...f, { name: "", type: "text" }]);
  }

  function removeField(i: number) {
    setFields((f) => f.filter((_, idx) => idx !== i));
  }

  function updateField(i: number, key: keyof Field, value: string) {
    setFields((f) => f.map((field, idx) => idx === i ? { ...field, [key]: value } : field));
    setError("");
  }

  async function save() {
    const names = fields.map((f) => f.name.trim());
    if (names.some((n) => !n)) { setError("All columns must have a name"); return; }
    if (new Set(names).size !== names.length) { setError("Column names must be unique"); return; }

    setLoading(true);
    setError("");
    const res = await apiFetch(`${basePath}/${projectId}/categories/${categoryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: fields.map((f) => ({ name: f.name.trim(), type: f.type })) }),
    });
    setLoading(false);
    if (!res.ok) { setError("Failed to save columns"); return; }
    setOpen(false);
    router.refresh();
  }

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
          {fields.length > 0 && (
            <div className="hidden sm:grid grid-cols-[1fr_148px_32px] gap-2 px-1 pb-1">
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
            <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_148px_32px] gap-2 items-start">
              <Input
                value={field.name}
                placeholder="e.g. Title"
                onChange={(e) => updateField(i, "name", e.target.value)}
              />
              <Select
                value={field.type}
                onChange={(v) => updateField(i, "type", v)}
                options={FIELD_TYPES}
              />
              <button
                type="button"
                onClick={() => removeField(i)}
                className="h-9 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors"
              >
                <Trash2 size={14} />
              </button>
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
