"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, ChevronDown } from "lucide-react";

interface Props {
  projectId: string;
  categoryId: string;
  categoryName: string;
  basePath?: string;
}

export function ExportEntriesButton({
  projectId,
  categoryId,
  categoryName,
  basePath = "/api/admin/projects",
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<"csv" | "json" | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function doExport(format: "csv" | "json") {
    setOpen(false);
    setLoading(format);
    try {
      const url = `${basePath}/${projectId}/categories/${categoryId}/entries/export?format=${format}`;
      const res = await apiFetch(url);
      if (!res.ok) return;
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${categoryName.replace(/[^a-z0-9_-]/gi, "_")}-entries.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        loading={loading !== null}
        disabled={loading !== null}
        className="gap-1.5"
      >
        <Download size={14} />
        Export
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[130px] bg-white border border-slate-200 rounded-lg shadow-lg py-1 text-sm">
          <button
            className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 transition-colors"
            onClick={() => doExport("csv")}
          >
            Export as CSV
          </button>
          <button
            className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 transition-colors"
            onClick={() => doExport("json")}
          >
            Export as JSON
          </button>
        </div>
      )}
    </div>
  );
}
