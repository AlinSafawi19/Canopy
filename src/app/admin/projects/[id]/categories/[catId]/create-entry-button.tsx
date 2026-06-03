"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Modal, ModalRef } from "@/components/ui/modal";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { DatePicker } from "@/components/ui/date-picker";
import { LIMITS } from "@/lib/limits";

interface Field { name: string; type: string }

export function CreateEntryButton({
  categoryId,
  projectId,
  fields,
  basePath = "/api/admin/projects",
}: {
  categoryId: string;
  projectId: string;
  fields: Field[];
  basePath?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState(false);
  const modalRef = useRef<ModalRef>(null);

  function setValue(name: string, value: string) {
    setValues((v) => ({ ...v, [name]: value }));
    setTouched(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(
        `${basePath}/${projectId}/categories/${categoryId}/entries`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ values }),
        }
      );
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed"); return; }
      setOpen(false);
      setValues({});
      setTouched(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} disabled={fields.length === 0}>
        New Row
      </Button>
      <Modal ref={modalRef} open={open} onClose={() => { setOpen(false); setTouched(false); }} title="New Entry" isDirty={touched}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.length === 0 && (
            <p className="text-sm text-slate-500">
              No fields defined for this category. Add field schema first.
            </p>
          )}
          {fields.map((field) => {
            if (field.type === "rich_text") return (
              <RichTextEditor
                key={field.name}
                label={field.name}
                value={values[field.name] ?? ""}
                onChange={(v) => setValue(field.name, v)}
              />
            );
            if (field.type === "textarea") return (
              <Textarea
                key={field.name}
                label={field.name}
                value={values[field.name] ?? ""}
                onChange={(e) => setValue(field.name, e.target.value)}
                rows={2}
                maxLength={LIMITS.ENTRY_TEXTAREA}
              />
            );
            if (field.type === "date") return (
              <DatePicker
                key={field.name}
                label={field.name}
                value={values[field.name] ?? null}
                onChange={(v) => setValue(field.name, v ?? "")}
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
                      onClick={() => setValue(field.name, "true")}
                      className={`px-4 py-1.5 text-sm font-medium transition-colors ${isTrue ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                    >
                      True
                    </button>
                    <button
                      type="button"
                      onClick={() => setValue(field.name, "false")}
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
              <Input
                key={field.name}
                label={field.name}
                type={field.type === "number" ? "number" : field.type === "url" ? "url" : "text"}
                inputMode={field.type === "email" ? "email" : undefined}
                value={values[field.name] ?? ""}
                onChange={(e) => setValue(field.name, e.target.value)}
                maxLength={maxLengthByType[field.type]}
              />
            );
          })}
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => modalRef.current?.attemptClose()}>Cancel</Button>
            <Button type="submit" loading={loading}>Create Entry</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
