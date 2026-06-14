"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useRef, useState } from "react";
import { Plus, Trash2, Upload, X } from "lucide-react";

export interface TechStackItem {
  icon: string;
  name: string;
}

export function TechIconImg({ src, className }: { src: string; className?: string }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className={className} onError={() => setHidden(true)} />;
}

interface Props {
  value: TechStackItem[];
  onChange: (items: TechStackItem[]) => void;
}

export function parseTechStack(raw: unknown): TechStackItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) =>
    typeof item === "string"
      ? { icon: "", name: item }
      : { icon: (item as Record<string, string>).icon ?? "", name: (item as Record<string, string>).name ?? "" }
  );
}

function isGcsUrl(url: string) {
  return url.startsWith("https://storage.googleapis.com/");
}

function IconUploadButton({
  currentUrl,
  onUploaded,
  onLocalPreview,
}: {
  currentUrl: string;
  onUploaded: (url: string) => void;
  onLocalPreview: (url: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const blobUrl = URL.createObjectURL(file);
    onLocalPreview(blobUrl);
    setUploading(true);
    if (isGcsUrl(currentUrl)) {
      fetch("/api/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: currentUrl }),
      }).catch(() => {});
    }
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (res.ok) {
        URL.revokeObjectURL(blobUrl);
        onLocalPreview(null);
        onUploaded(data.url);
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <label
      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors flex-shrink-0 cursor-pointer"
      title="Upload icon image"
    >
      <Upload size={14} className={uploading ? "animate-pulse text-indigo-400" : ""} />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
    </label>
  );
}

export function TechStackInput({ value, onChange }: Props) {
  const [localPreviews, setLocalPreviews] = useState<(string | null)[]>([]);

  function setLocalPreview(index: number, url: string | null) {
    setLocalPreviews((prev) => {
      const next = [...prev];
      if (url === null && prev[index]) URL.revokeObjectURL(prev[index]!);
      next[index] = url;
      return next;
    });
  }

  function update(index: number, field: keyof TechStackItem, val: string) {
    const next = value.map((item, i) => (i === index ? { ...item, [field]: val } : item));
    onChange(next);
  }

  function add() {
    onChange([...value, { icon: "", name: "" }]);
  }

  function remove(index: number) {
    if (localPreviews[index]) URL.revokeObjectURL(localPreviews[index]!);
    setLocalPreviews((prev) => prev.filter((_, i) => i !== index));
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      {value.map((item, i) => {
        const previewSrc = localPreviews[i] ?? item.icon;
        return (
        <div key={i} className="flex items-center gap-2">
          {/* Name */}
          <input
            type="text"
            value={item.name}
            onChange={(e) => update(i, "name", e.target.value)}
            placeholder="Name"
            className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {/* Icon URL or emoji */}
          <input
            type="text"
            value={item.icon}
            onChange={(e) => update(i, "icon", e.target.value)}
            readOnly={isGcsUrl(item.icon)}
            placeholder="Icon URL or emoji"
            className={`flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500${isGcsUrl(item.icon) ? " bg-slate-50 text-slate-500 cursor-default" : ""}`}
          />
          {/* Upload / clear */}
          {isGcsUrl(item.icon) ? (
            <button
              type="button"
              title="Remove uploaded icon"
              onClick={() => {
                fetch("/api/upload", {
                  method: "DELETE",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ url: item.icon }),
                }).catch(() => {});
                update(i, "icon", "");
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
            >
              <X size={14} />
            </button>
          ) : (
            <IconUploadButton
              currentUrl={item.icon}
              onUploaded={(url) => update(i, "icon", url)}
              onLocalPreview={(url) => setLocalPreview(i, url)}
            />
          )}
          {/* Icon preview */}
          <div className="w-7 h-7 flex items-center justify-center flex-shrink-0 rounded border border-slate-200 bg-slate-50 overflow-hidden">
            {previewSrc ? (
              /^https?:\/\/|^\/|^blob:/.test(previewSrc) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewSrc} alt="" className="w-5 h-5 object-contain" />
              ) : (
                <span className="text-sm leading-none">{previewSrc}</span>
              )
            ) : (
              <span className="text-slate-300 text-xs">?</span>
            )}
          </div>
          {/* Delete */}
          <button
            type="button"
            onClick={() => remove(i)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
          >
            <Trash2 size={14} />
          </button>
        </div>
        );
      })}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium mt-1"
      >
        <Plus size={14} />
        Add technology
      </button>
    </div>
  );
}
