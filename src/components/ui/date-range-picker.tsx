"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DayPicker } from "react-day-picker";
import type { DateRange } from "react-day-picker";
import { format, parseISO } from "date-fns";
import { Calendar, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Conservative height estimate for a 2-month DayPicker
const CALENDAR_H = 340;

interface DateRangePickerProps {
  startDate?: string | null;
  endDate?: string | null;
  onChange: (start: string | null, end: string | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DateRangePicker({
  startDate,
  endDate,
  onChange,
  label,
  placeholder = "Pick a date range",
  disabled,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  // null = not yet computed; portal doesn't render until pos is set
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // Prevents the correction effect from looping after it already adjusted once
  const correctedRef = useRef(false);

  const from = startDate ? parseISO(startDate) : undefined;
  const to = endDate ? parseISO(endDate) : undefined;
  const range: DateRange | undefined = from ? { from, to } : undefined;

  const display = from
    ? to
      ? `${format(from, "MMM d, yyyy")} – ${format(to, "MMM d, yyyy")}`
      : `${format(from, "MMM d, yyyy")} – …`
    : null;

  // Step 1: when open changes, compute initial position using estimated height.
  // Keeping this effect separate from the correction effect prevents them from
  // running in the same batch and reading stale DOM state.
  useEffect(() => {
    if (!open || !buttonRef.current) {
      setPos(null);
      correctedRef.current = false;
      return;
    }
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const showBelow = spaceBelow >= CALENDAR_H || spaceBelow >= spaceAbove;
    correctedRef.current = false;
    setPos({
      top: showBelow ? rect.bottom + 4 : Math.max(8, rect.top - CALENDAR_H - 4),
      left: rect.left,
    });
  }, [open]);

  // Step 2: after pos changes (i.e. after the calendar renders at the estimated
  // position), measure the actual rendered height and correct if needed.
  // Depends only on [pos] — NOT [open] — so it always runs on a fresh DOM state.
  useEffect(() => {
    if (!pos || correctedRef.current || !dropdownRef.current || !buttonRef.current) return;
    correctedRef.current = true;
    const dropRect = dropdownRef.current.getBoundingClientRect();
    const btnRect = buttonRef.current.getBoundingClientRect();

    if (dropRect.bottom < btnRect.top) {
      // Calendar is above the button: fine-tune with actual height
      const corrected = Math.max(8, btnRect.top - dropRect.height - 4);
      if (Math.abs(corrected - pos.top) > 2) {
        setPos((p) => p && { ...p, top: corrected });
      }
    } else if (dropRect.bottom > window.innerHeight - 8) {
      // Still overflowing below: flip above with actual height
      setPos((p) => p && { ...p, top: Math.max(8, btnRect.top - dropRect.height - 4) });
    }
  }, [pos]);

  // Outside click and Escape
  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (!wrapperRef.current?.contains(t) && !dropdownRef.current?.contains(t)) {
        setOpen(false);
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onEscape, true);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onEscape, true);
    };
  }, [open]);

  function handleSelect(r: DateRange | undefined) {
    onChange(
      r?.from ? format(r.from, "yyyy-MM-dd") : null,
      r?.to ? format(r.to, "yyyy-MM-dd") : null,
    );
    if (r?.from && r?.to) setOpen(false);
  }

  const hasValue = startDate || endDate;

  return (
    <div className={cn("flex flex-col gap-1.5", className)} ref={wrapperRef}>
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-left flex items-center gap-2",
          "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow duration-150",
          "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500",
          open && "ring-2 ring-indigo-500 border-transparent",
        )}
      >
        <Calendar size={14} className="text-slate-400 flex-shrink-0" />
        <span className={cn("flex-1 truncate", !display && "text-slate-400")}>
          {display ?? placeholder}
        </span>
        {hasValue && (
          <X
            size={14}
            className="text-slate-400 hover:text-slate-700 flex-shrink-0"
            onClick={(e) => { e.stopPropagation(); onChange(null, null); }}
          />
        )}
      </button>

      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] bg-white border border-slate-200 rounded-xl shadow-lg p-3 overflow-x-auto"
          style={{ top: pos.top, left: pos.left }}
        >
          <DayPicker
            mode="range"
            selected={range}
            onSelect={handleSelect}
            defaultMonth={from ?? new Date()}
            numberOfMonths={2}
          />
        </div>,
        document.body
      )}
    </div>
  );
}
