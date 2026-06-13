"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";

interface SelectOption { value: string; label: string }

interface Props {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  size?: "sm" | "md";
  autoWidth?: boolean;
}

// Matches max-h-52 (13rem at 16px base)
const DROPDOWN_MAX_H = 208;

export function Select({ label, value, onChange, options, placeholder, required, disabled, error, size = "md", autoWidth = false }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; minWidth: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const correctedRef = useRef(false);

  const selectedLabel = options.find((o) => o.value === value)?.label;

  // Step 1: compute initial position using max estimated height
  useEffect(() => {
    if (!open || !triggerRef.current) {
      setPos(null);
      correctedRef.current = false;
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const showBelow = spaceBelow >= DROPDOWN_MAX_H || spaceBelow >= spaceAbove;
    correctedRef.current = false;
    setPos({
      top: showBelow ? rect.bottom + 4 : rect.top - DROPDOWN_MAX_H - 4,
      left: rect.left,
      minWidth: rect.width,
    });
  }, [open]);

  // Step 2: after first render, correct top using actual dropdown height
  useEffect(() => {
    if (!pos || correctedRef.current || !dropdownRef.current || !triggerRef.current) return;
    correctedRef.current = true;
    const dropRect = dropdownRef.current.getBoundingClientRect();
    const btnRect = triggerRef.current.getBoundingClientRect();

    if (dropRect.bottom < btnRect.top) {
      // Opened above — fine-tune with actual height
      const corrected = Math.max(8, btnRect.top - dropRect.height - 4);
      if (Math.abs(corrected - pos.top) > 2) {
        setPos((p) => p && { ...p, top: corrected });
      }
    } else if (dropRect.bottom > window.innerHeight - 8) {
      // Still overflowing below — flip above with actual height
      setPos((p) => p && { ...p, top: Math.max(8, btnRect.top - dropRect.height - 4) });
    }
  }, [pos]);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (
        dropdownRef.current?.contains(e.target as Node) ||
        triggerRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.stopImmediatePropagation(); setOpen(false); }
    }
    function handleScroll(e: Event) {
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey, true);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey, true);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  const dropdown = open && pos ? (
    <div
      ref={dropdownRef}
      style={{ position: "fixed", top: pos.top, left: pos.left, minWidth: pos.minWidth, zIndex: 9999 }}
      className="rounded-lg border border-slate-200 bg-white shadow-xl overflow-hidden"
    >
      <div className="max-h-52 overflow-y-auto">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => { onChange(opt.value); setOpen(false); }}
            className={[
              "w-full flex items-center gap-2 text-left hover:bg-slate-50 transition-colors",
              size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2.5 text-sm",
              opt.value === value ? "bg-indigo-50/60" : "",
            ].join(" ")}
          >
            <span className="flex-1 font-medium text-slate-900 truncate">{opt.label}</span>
            {opt.value === value && <Check size={size === "sm" ? 11 : 13} className="text-indigo-600 shrink-0" />}
          </button>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <div className="relative flex flex-col gap-1">
      {label && (
        <label className="text-xs sm:text-sm font-medium text-slate-700">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={[
          "flex items-center justify-between gap-1.5 rounded-lg border text-left transition-colors focus:outline-none",
          autoWidth ? "" : "w-full",
          size === "sm" ? "px-2 py-1 text-xs" : "px-2.5 py-1.5 text-sm sm:px-3 sm:py-2",
          disabled
            ? "bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200"
            : "bg-white border-slate-300 hover:border-slate-400 cursor-pointer",
          open ? "ring-2 ring-indigo-500 border-indigo-500" : "",
          error ? "border-red-400" : "",
        ].join(" ")}
      >
        <span className={`truncate ${selectedLabel ? "text-slate-900" : "text-slate-400"}`}>
          {selectedLabel ?? placeholder ?? "Select…"}
        </span>
        <ChevronDown
          size={size === "sm" ? 12 : 14}
          className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {typeof document !== "undefined" && dropdown && createPortal(dropdown, document.body)}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
