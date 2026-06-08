"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DayPicker } from "react-day-picker";
import { format, parseISO } from "date-fns";
import { Calendar, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  value?: string | null;
  onChange: (value: string | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  disablePast?: boolean;
  /** Disable all days before this date */
  minDate?: Date;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  label,
  placeholder = "Pick a date",
  disabled,
  disablePast,
  minDate,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const selected = value ? parseISO(value) : undefined;
  const display = selected ? format(selected, "MMM d, yyyy") : null;

  function openPicker() {
    if (buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect();
      setCoords({ top: r.bottom + 4, left: r.left });
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (
        buttonRef.current?.contains(e.target as Node) ||
        popoverRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
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

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          onClick={() => (open ? setOpen(false) : openPicker())}
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
          {value && (
            <X
              size={14}
              className="text-slate-400 hover:text-slate-700 flex-shrink-0"
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
            />
          )}
        </button>

        {open && coords && typeof document !== "undefined" && createPortal(
          <div
            ref={popoverRef}
            className="fixed z-[9999] bg-white border border-slate-200 rounded-xl shadow-lg p-3"
            style={{ top: coords.top, left: coords.left }}
          >
            <DayPicker
              mode="single"
              selected={selected}
              disabled={minDate ? { before: minDate } : disablePast ? { before: new Date() } : undefined}
              onSelect={(date) => {
                onChange(date ? format(date, "yyyy-MM-dd") : null);
                setOpen(false);
              }}
              defaultMonth={selected}
            />
          </div>,
          document.body,
        )}
      </div>
    </div>
  );
}
