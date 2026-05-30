"use client";

import { useEffect, useRef, useState } from "react";
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
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  label,
  placeholder = "Pick a date",
  disabled,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = value ? parseISO(value) : undefined;
  const display = selected ? format(selected, "MMM d, yyyy") : null;

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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
    <div className={cn("flex flex-col gap-1.5", className)} ref={ref}>
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
      <div className="relative">
        <button
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
          {value && (
            <X
              size={14}
              className="text-slate-400 hover:text-slate-700 flex-shrink-0"
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
            />
          )}
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg p-3">
            <DayPicker
              mode="single"
              selected={selected}
              onSelect={(date) => {
                onChange(date ? format(date, "yyyy-MM-dd") : null);
                setOpen(false);
              }}
              defaultMonth={selected}
            />
          </div>
        )}
      </div>
    </div>
  );
}
