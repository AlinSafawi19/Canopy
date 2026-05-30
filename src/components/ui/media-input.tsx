"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useRef, useState } from "react";
import { Link2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface MediaInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  accept?: string;
  placeholder?: string;
  maxLength?: number;
}

const ACCEPT_LABEL: Record<string, string> = {
  "image/*": "PNG, JPG, GIF, WebP, SVG",
  "video/*": "MP4, WebM, MOV",
  "image/*,video/*": "Image or video file",
};

export function MediaInput({
  label,
  value,
  onChange,
  accept = "image/*",
  placeholder = "https://...",
  maxLength,
}: MediaInputProps) {
  const [tab, setTab] = useState<"url" | "upload">("url");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    if (isGcsUrl(value)) {
      fetch("/api/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: value }),
      }).catch(() => {});
    }
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) { setUploadError(data.error ?? "Upload failed"); return; }
      onChange(data.url);
      setTab("url");
    } catch {
      setUploadError("Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function isGcsUrl(url: string) {
    return url.startsWith("https://storage.googleapis.com/");
  }

  async function handleClear() {
    if (isGcsUrl(value)) {
      fetch("/api/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: value }),
      }).catch(() => {});
    }
    onChange("");
  }

  const looksLikeImage = accept.includes("image") && value &&
    (/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(value) || value.includes("drive.google.com/uc"));

  const looksLikeVideo = accept.includes("video") && value &&
    /\.(mp4|webm|mov|ogg)(\?|$)/i.test(value);

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-slate-700">{label}</label>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 text-xs">
        <button
          type="button"
          onClick={() => setTab("url")}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors",
            tab === "url"
              ? "bg-indigo-100 text-indigo-700 font-medium"
              : "text-slate-500 hover:bg-slate-100"
          )}
        >
          <Link2 size={11} /> URL
        </button>
        <button
          type="button"
          onClick={() => setTab("upload")}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors",
            tab === "upload"
              ? "bg-indigo-100 text-indigo-700 font-medium"
              : "text-slate-500 hover:bg-slate-100"
          )}
        >
          <Upload size={11} /> Upload
        </button>
      </div>

      {tab === "url" ? (
        <div className="flex items-center gap-1.5">
          <input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            readOnly={isGcsUrl(value)}
            placeholder={placeholder}
            maxLength={maxLength}
            className={cn(
              "flex-1 text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent",
              isGcsUrl(value) && "bg-slate-50 text-slate-500 cursor-default select-none"
            )}
          />
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ) : (
        <div>
          <label
            className={cn(
              "flex flex-col items-center gap-1.5 border-2 border-dashed rounded-lg py-4 px-3 cursor-pointer transition-colors",
              uploading
                ? "border-indigo-300 bg-indigo-50/40 cursor-wait"
                : "border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30"
            )}
          >
            <Upload size={16} className={uploading ? "text-indigo-400" : "text-slate-400"} />
            <span className="text-xs text-slate-600 font-medium">
              {uploading ? "Uploading…" : "Click to choose file"}
            </span>
            <span className="text-[11px] text-slate-400">
              {ACCEPT_LABEL[accept] ?? accept}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept={accept}
              className="hidden"
              onChange={handleFile}
              disabled={uploading}
            />
          </label>
          {uploadError && (
            <p className="text-xs text-red-600 mt-1">{uploadError}</p>
          )}
        </div>
      )}

      {/* Image preview */}
      {looksLikeImage && (
        <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-50 h-20 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="preview" className="max-h-full max-w-full object-contain" />
        </div>
      )}

      {/* Video preview */}
      {looksLikeVideo && (
        <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-950 h-28 flex items-center justify-center">
          <video
            src={value}
            controls
            className="max-h-full max-w-full"
          />
        </div>
      )}
    </div>
  );
}
