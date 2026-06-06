"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, X, Search } from "lucide-react";

interface RelationOption { id: string; label: string }

const DROPDOWN_MAX_H = 280;

export function RelationMultiSelect({
  label,
  value,
  onChange,
  projectId,
  targetCategoryId,
  basePath,
  valueLabels,
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  projectId: string;
  targetCategoryId: string;
  basePath: string;
  /** id → label for values that may be archived / beyond the fetch limit. */
  valueLabels?: Record<string, string>;
}) {
  const [options, setOptions] = useState<RelationOption[]>([]);
  const [status, setStatus]   = useState<"loading" | "ready" | "error">("loading");
  const [open, setOpen]       = useState(false);
  const [search, setSearch]   = useState("");
  const [pos, setPos]         = useState<{ top: number; left: number; width: number } | null>(null);

  const triggerRef  = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!targetCategoryId) { setStatus("ready"); return; }
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
      .catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; };
  }, [basePath, projectId, targetCategoryId]);

  // position dropdown (fixed, flips above when needed) — escapes modal overflow
  useEffect(() => {
    if (!open || !triggerRef.current) { setPos(null); return; }
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const showBelow  = spaceBelow >= DROPDOWN_MAX_H || spaceBelow >= rect.top - 8;
    setPos({
      top:  showBelow ? rect.bottom + 4 : Math.max(8, rect.top - DROPDOWN_MAX_H - 4),
      left: rect.left,
      width: rect.width,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (dropdownRef.current?.contains(e.target as Node) || triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") { e.stopImmediatePropagation(); setOpen(false); } }
    function onScroll(e: Event) { if (dropdownRef.current?.contains(e.target as Node)) return; setOpen(false); }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const labelFor = (id: string) =>
    options.find((o) => o.id === id)?.label ?? valueLabels?.[id] ?? id;

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }
  function remove(id: string) {
    onChange(value.filter((v) => v !== id));
  }

  const filtered = options.filter((o) => o.label.toLowerCase().includes(search.trim().toLowerCase()));

  if (status === "error") {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          Failed to load related entries
        </p>
      </div>
    );
  }

  const dropdown = open && pos ? (
    <div
      ref={dropdownRef}
      style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
      className="rounded-lg border border-slate-200 bg-white shadow-xl overflow-hidden flex flex-col"
    >
      <div className="flex items-center gap-2 px-2.5 py-2 border-b border-slate-100">
        <Search size={13} className="text-slate-400 flex-shrink-0" />
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="flex-1 min-w-0 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
        />
      </div>
      <div className="max-h-56 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <p className="px-3 py-3 text-xs text-slate-400 text-center">
            {options.length === 0 ? "No entries yet" : "No matches"}
          </p>
        ) : filtered.map((opt) => {
          const checked = value.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggle(opt.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors ${checked ? "bg-indigo-50/60" : ""}`}
            >
              <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${checked ? "bg-indigo-600 border-indigo-600" : "border-slate-300"}`}>
                {checked && <Check size={11} className="text-white" />}
              </span>
              <span className="flex-1 truncate text-slate-900">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div
        ref={triggerRef}
        onClick={() => status !== "loading" && setOpen((o) => !o)}
        className={`min-h-9 w-full rounded-lg border px-2 py-1.5 flex flex-wrap items-center gap-1.5 transition-colors ${
          status === "loading"
            ? "bg-slate-50 border-slate-200 cursor-not-allowed"
            : "bg-white border-slate-300 hover:border-slate-400 cursor-pointer"
        } ${open ? "ring-2 ring-indigo-500 border-indigo-500" : ""}`}
      >
        {value.length === 0 ? (
          <span className="text-sm text-slate-400 px-1">
            {status === "loading" ? "Loading…" : "Select…"}
          </span>
        ) : (
          value.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-pink-50 border border-pink-200 text-pink-700 text-xs font-medium max-w-full"
            >
              <span className="truncate">{labelFor(id)}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); remove(id); }}
                className="text-pink-400 hover:text-pink-700 transition-colors leading-none flex-shrink-0"
              >
                <X size={11} />
              </button>
            </span>
          ))
        )}
        <ChevronDown
          size={14}
          className={`ml-auto shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </div>

      {typeof document !== "undefined" && dropdown && createPortal(dropdown, document.body)}
    </div>
  );
}
