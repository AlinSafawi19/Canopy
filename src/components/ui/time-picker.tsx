"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimePickerProps {
  value: string; // "HH:MM" 24-hour
  onChange: (value: string) => void;
  label?: string;
  /** "HH:MM" 24-hour — times before this are disabled */
  minTime?: string;
  className?: string;
}

const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

function to12h(hh: number): { hour: number; ampm: "AM" | "PM" } {
  return { hour: hh === 0 ? 12 : hh > 12 ? hh - 12 : hh, ampm: hh < 12 ? "AM" : "PM" };
}
function to24h(hour: number, ampm: "AM" | "PM"): number {
  if (ampm === "AM") return hour === 12 ? 0 : hour;
  return hour === 12 ? 12 : hour + 12;
}
function fmt24(h: number, m: string) {
  return `${String(h).padStart(2, "0")}:${m}`;
}

export function TimePicker({ value, onChange, label, minTime, className }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [hh, mm] = value.split(":").map(Number);
  const { hour, ampm } = to12h(hh ?? 9);
  const minuteStr = String(mm ?? 0).padStart(2, "0");
  const minuteSnapped = MINUTES.reduce((a, b) =>
    Math.abs(parseInt(b) - (mm ?? 0)) < Math.abs(parseInt(a) - (mm ?? 0)) ? b : a
  );
  const display = `${String(hour).padStart(2, "0")}:${minuteStr} ${ampm}`;

  // Returns true if the given 24h time is before minTime
  function isPast(h24: number, m: string) {
    if (!minTime) return false;
    return fmt24(h24, m) < minTime;
  }
  // Returns true if ALL minutes for this hour are in the past
  function hourAllPast(h: number, ap: "AM" | "PM") {
    const h24 = to24h(h, ap);
    return MINUTES.every((m) => isPast(h24, m));
  }

  function openPicker() {
    if (buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect();
      setCoords({ top: r.bottom + 4, left: r.left });
    }
    setOpen(true);
  }

  function setHour(h: number) {
    const next24 = to24h(h, ampm);
    // If selected minute is now in the past, bump to first valid minute
    if (minTime) {
      const validMinute = MINUTES.find((m) => !isPast(next24, m)) ?? minuteStr;
      onChange(fmt24(next24, validMinute));
    } else {
      onChange(fmt24(next24, minuteStr));
    }
  }
  function setMinute(m: string) {
    const h24 = to24h(hour, ampm);
    if (isPast(h24, m)) return;
    onChange(fmt24(h24, m));
  }
  function setAmPm(a: "AM" | "PM") {
    const next24 = to24h(hour, a);
    if (minTime) {
      const validMinute = MINUTES.find((m) => !isPast(next24, m)) ?? minuteStr;
      onChange(fmt24(next24, validMinute));
    } else {
      onChange(fmt24(next24, minuteStr));
    }
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
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openPicker())}
        className={cn(
          "h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-left flex items-center gap-2",
          "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow duration-150",
          open && "ring-2 ring-indigo-500 border-transparent",
        )}
      >
        <Clock size={14} className="text-slate-400 flex-shrink-0" />
        <span className="flex-1">{display}</span>
      </button>

      {open && coords && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-[9999] bg-white border border-slate-200 rounded-xl shadow-lg p-3"
          style={{ top: coords.top, left: coords.left }}
        >
          <div className="flex items-stretch gap-1">
            {/* Hours */}
            <div className="flex flex-col w-12 max-h-48 overflow-y-auto scrollbar-none">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => {
                const disabled = hourAllPast(h, ampm);
                return (
                  <button key={h} type="button"
                    disabled={disabled}
                    onClick={() => setHour(h)}
                    className={cn(
                      "py-1.5 text-sm rounded-lg text-center transition-colors",
                      h === hour ? "bg-indigo-600 text-white font-semibold" :
                      disabled ? "text-slate-300 cursor-not-allowed" : "text-slate-700 hover:bg-slate-100"
                    )}>
                    {String(h).padStart(2, "0")}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center text-slate-300 text-lg font-light select-none">:</div>

            {/* Minutes */}
            <div className="flex flex-col w-12 max-h-48 overflow-y-auto scrollbar-none">
              {MINUTES.map((m) => {
                const disabled = isPast(to24h(hour, ampm), m);
                return (
                  <button key={m} type="button"
                    disabled={disabled}
                    onClick={() => setMinute(m)}
                    className={cn(
                      "py-1.5 text-sm rounded-lg text-center transition-colors",
                      m === minuteSnapped ? "bg-indigo-600 text-white font-semibold" :
                      disabled ? "text-slate-300 cursor-not-allowed" : "text-slate-700 hover:bg-slate-100"
                    )}>
                    {m}
                  </button>
                );
              })}
            </div>

            <div className="w-px bg-slate-100 mx-1 self-stretch" />

            {/* AM / PM */}
            <div className="flex flex-col gap-1 justify-center">
              {(["AM", "PM"] as const).map((a) => {
                const disabled = Array.from({ length: 12 }, (_, i) => i + 1).every((h) => hourAllPast(h, a));
                return (
                  <button key={a} type="button"
                    disabled={disabled}
                    onClick={() => setAmPm(a)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors",
                      a === ampm ? "bg-indigo-600 text-white" :
                      disabled ? "text-slate-300 cursor-not-allowed" : "text-slate-600 hover:bg-slate-100"
                    )}>
                    {a}
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
