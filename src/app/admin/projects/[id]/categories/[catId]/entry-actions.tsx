"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useRef, useState } from "react";
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
import { LIMITS } from "@/lib/limits";

interface Field { name: string; type: string; options?: string[] }
interface Entry { id: string; values: unknown; archivedAt: Date | null }

export function EntryActions({
  entry,
  categoryId,
  projectId,
  fields,
  basePath = "/api/admin/projects",
  canEdit = true,
  canArchive = true,
  canDelete = true,
}: {
  entry: Entry;
  categoryId: string;
  projectId: string;
  fields: Field[];
  basePath?: string;
  canEdit?: boolean;
  canArchive?: boolean;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const editModalRef = useRef<ModalRef>(null);
  const [values, setValues] = useState<Record<string, string>>(
    entry.values as Record<string, string>
  );

  const baseUrl = `${basePath}/${projectId}/categories/${categoryId}/entries/${entry.id}`;

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

  return (
    <div className="flex items-center gap-1">
      {canEdit && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={() => { setValues(entry.values as Record<string, string>); setError(""); setEditOpen(true); }}
        >
          Edit
        </Button>
      )}

      {(canArchive || canDelete) && (
        <ActionMenu>
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

      <Modal ref={editModalRef} open={editOpen} onClose={() => { setEditOpen(false); setTouched(false); setError(""); }} title="Edit Entry" isDirty={touched}>
        <form onSubmit={save} className="space-y-4">
          {fields.map((field) => {
            if (field.type === "rich_text") return (
              <RichTextEditor
                key={field.name}
                label={field.name}
                value={values[field.name] ?? ""}
                onChange={(v) => { setValues(vals => ({ ...vals, [field.name]: v })); setTouched(true); }}
              />
            );
            if (field.type === "textarea") return (
              <Textarea key={field.name} label={field.name} value={values[field.name] ?? ""} onChange={(e) => { setValues(v => ({ ...v, [field.name]: e.target.value })); setTouched(true); }} rows={2} maxLength={LIMITS.ENTRY_TEXTAREA} />
            );
            if (field.type === "date") return (
              <DatePicker
                key={field.name}
                label={field.name}
                value={values[field.name] ?? null}
                onChange={(v) => { setValues(vals => ({ ...vals, [field.name]: v ?? "" })); setTouched(true); }}
              />
            );
            if (field.type === "enum") return (
              <Select
                key={field.name}
                label={field.name}
                value={values[field.name] ?? ""}
                onChange={(v) => { setValues(vals => ({ ...vals, [field.name]: v })); setTouched(true); }}
                options={[
                  { value: "", label: "Select…" },
                  ...(field.options ?? []).map((o) => ({ value: o, label: o })),
                ]}
              />
            );
            if (field.type === "boolean") {
              const isTrue = (values[field.name] ?? "false") === "true";
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
              <Input key={field.name} label={field.name} type={field.type === "number" ? "number" : field.type === "url" ? "url" : "text"} inputMode={field.type === "email" ? "email" : undefined} value={values[field.name] ?? ""} onChange={(e) => { setValues(v => ({ ...v, [field.name]: e.target.value })); setTouched(true); }} maxLength={maxLengthByType[field.type]} />
            );
          })}
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => editModalRef.current?.attemptClose()}>Cancel</Button>
            <Button type="submit" loading={loading}>Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
