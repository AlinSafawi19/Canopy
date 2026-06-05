"use client";

import { useEffect, useState } from "react";
import { Select } from "./select";

interface RelationOption {
  id: string;
  label: string;
}

export function RelationSelect({
  label,
  value,
  onChange,
  projectId,
  targetCategoryId,
  basePath,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  projectId: string;
  targetCategoryId: string;
  basePath: string;
}) {
  const [options, setOptions] = useState<RelationOption[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!targetCategoryId) {
      setStatus("ready");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    fetch(`${basePath}/${projectId}/categories/${targetCategoryId}/entries/select?limit=200`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setOptions(Array.isArray(data.items) ? data.items : []);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => { cancelled = true; };
  }, [basePath, projectId, targetCategoryId]);

  if (status === "error") {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          Failed to load related entries
        </p>
      </div>
    );
  }

  return (
    <Select
      label={label}
      value={value}
      onChange={onChange}
      disabled={status === "loading"}
      options={[
        { value: "", label: status === "loading" ? "Loading…" : options.length === 0 ? "No entries yet" : "Select…" },
        ...options.map((o) => ({ value: o.id, label: o.label })),
      ]}
    />
  );
}
