"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, Check, Loader2 } from "lucide-react";

interface SelectItem {
  id: string;
  label: string;
  sublabel?: string;
}

interface Props {
  endpoint: string;
  extraParams?: Record<string, string>;
  value: string;
  onChange: (id: string, label: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  initialLabel?: string;
}

export function ComboSelect({
  endpoint,
  extraParams,
  value,
  onChange,
  placeholder = "Select…",
  label,
  required,
  disabled,
  initialLabel = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SelectItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(initialLabel);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const correctedRef = useRef(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  // Refs to avoid stale closures in callbacks
  const busyRef = useRef(false);
  const hasMoreRef = useRef(false);
  const pageRef = useRef(0);
  const queryRef = useRef("");
  const endpointRef = useRef(endpoint);
  const extraRef = useRef(extraParams);

  // Keep refs in sync with latest props/state
  useEffect(() => { endpointRef.current = endpoint; });
  useEffect(() => { extraRef.current = extraParams; });
  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);

  // Reset selectedLabel when value is cleared externally
  useEffect(() => {
    if (!value) setSelectedLabel("");
  }, [value]);

  function buildUrl(q: string, page: number) {
    const params = new URLSearchParams({
      search: q,
      page: String(page),
      limit: "20",
      ...(extraRef.current ?? {}),
    });
    return `${endpointRef.current}?${params}`;
  }

  async function doFetch(q: string, page: number, append: boolean) {
    if (busyRef.current) return;
    busyRef.current = true;
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const res = await apiFetch(buildUrl(q, page));
      if (!res.ok) return;
      const data: { items: SelectItem[]; hasMore: boolean } = await res.json();
      setItems((prev) => append ? [...prev, ...data.items] : data.items);
      setHasMore(data.hasMore);
      pageRef.current = page;
    } catch {
      // ignore
    } finally {
      busyRef.current = false;
      if (append) setLoadingMore(false); else setLoading(false);
    }
  }

  function loadMore() {
    if (!hasMoreRef.current || busyRef.current) return;
    doFetch(queryRef.current, pageRef.current + 1, true);
  }

  // Step 1: estimate position using max expected height
  const DROPDOWN_MAX_H = 320;
  useEffect(() => {
    if (!open || !triggerRef.current) { setPos(null); correctedRef.current = false; return; }
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const showBelow = spaceBelow >= DROPDOWN_MAX_H || spaceBelow >= spaceAbove;
    correctedRef.current = false;
    setPos({
      top: showBelow ? rect.bottom + 4 : rect.top - DROPDOWN_MAX_H - 4,
      left: rect.left,
      width: rect.width,
    });
  }, [open]);

  // Step 2: correct top using actual rendered dropdown height
  useEffect(() => {
    if (!pos || correctedRef.current || !dropdownRef.current || !triggerRef.current) return;
    correctedRef.current = true;
    const dropRect = dropdownRef.current.getBoundingClientRect();
    const btnRect = triggerRef.current.getBoundingClientRect();
    if (dropRect.bottom < btnRect.top) {
      // Opened above — snap to just above trigger using real height
      const corrected = Math.max(8, btnRect.top - dropRect.height - 4);
      if (Math.abs(corrected - pos.top) > 2) setPos((p) => p && { ...p, top: corrected });
    } else if (dropRect.bottom > window.innerHeight - 8) {
      // Overflows below — flip above using real height
      setPos((p) => p && { ...p, top: Math.max(8, btnRect.top - dropRect.height - 4) });
    }
  }, [pos]);

  // When dropdown opens: reset and fetch first page
  useEffect(() => {
    if (!open) {
      busyRef.current = false;
      return;
    }
    setQuery("");
    setItems([]);
    setHasMore(false);
    pageRef.current = 0;
    queryRef.current = "";
    busyRef.current = false;
    doFetch("", 1, false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  function handleQuery(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      queryRef.current = q;
      pageRef.current = 0;
      busyRef.current = false;
      setItems([]);
      doFetch(q, 1, false);
    }, 300);
  }

  // Infinite scroll sentinel
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click (check both trigger container and portal dropdown)
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    const scrollHandler = (e: Event) => {
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    window.addEventListener("scroll", scrollHandler, true);
    return () => {
      document.removeEventListener("mousedown", handler);
      window.removeEventListener("scroll", scrollHandler, true);
    };
  }, [open]);

  // Escape closes combo (capture phase so modal Escape doesn't fire too)
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [open]);

  function selectItem(item: SelectItem) {
    onChange(item.id, item.label);
    setSelectedLabel(item.label);
    setOpen(false);
  }

  const displayLabel = value ? selectedLabel : "";

  return (
    <div ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : setOpen(true))}
        className={[
          "w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm text-left transition-colors focus:outline-none",
          disabled
            ? "bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200"
            : "bg-white border-slate-300 hover:border-slate-400 cursor-pointer",
          open ? "ring-2 ring-indigo-500 border-indigo-500" : "",
        ].join(" ")}
      >
        <span className={`truncate ${displayLabel ? "text-slate-900" : "text-slate-400"}`}>
          {displayLabel || placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
          className="rounded-lg border border-slate-200 bg-white shadow-xl overflow-hidden"
        >
          {/* Search bar */}
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleQuery}
                placeholder="Search…"
                className="w-full h-8 rounded-md border border-slate-200 pl-8 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-52 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={16} className="animate-spin text-slate-400" />
              </div>
            ) : items.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">
                {query ? `No results for "${query}"` : "Nothing to show"}
              </p>
            ) : (
              <>
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectItem(item)}
                    className={[
                      "w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-slate-50 transition-colors",
                      item.id === value ? "bg-indigo-50/60" : "",
                    ].join(" ")}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 truncate">{item.label}</div>
                      {item.sublabel && (
                        <div className="text-xs text-slate-400 truncate">{item.sublabel}</div>
                      )}
                    </div>
                    {item.id === value && (
                      <Check size={13} className="text-indigo-600 shrink-0" />
                    )}
                  </button>
                ))}
                {/* Sentinel for infinite scroll */}
                <div ref={sentinelRef} className="h-1" />
                {loadingMore && (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 size={14} className="animate-spin text-slate-400" />
                  </div>
                )}
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
