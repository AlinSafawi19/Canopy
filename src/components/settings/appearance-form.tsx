"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState } from "react";
import { Monitor, Sun, Moon, Check } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Theme = "auto" | "light" | "dark";

const THEMES = [
  {
    value: "auto" as const,
    label: "Auto",
    description: "Default light appearance",
    icon: Monitor,
  },
  {
    value: "light" as const,
    label: "Light",
    description: "Light appearance",
    icon: Sun,
  },
  {
    value: "dark" as const,
    label: "Dark",
    description: "Dark appearance",
    icon: Moon,
  },
];

interface AppearanceFormProps {
  initialTheme: Theme;
  apiPath: string;
}

export function AppearanceForm({ apiPath }: AppearanceFormProps) {
  const { theme, setTheme } = useTheme();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await apiFetch(apiPath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save."); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-slate-700">Theme</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Select a theme. Changes preview immediately — click Save to keep them.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {THEMES.map(({ value, label, description, icon: Icon }) => {
          const selected = theme === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              className={cn(
                "relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all duration-150",
                selected
                  ? "border-indigo-600 bg-indigo-50"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              {selected && (
                <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                selected ? "bg-indigo-100" : "bg-slate-100"
              )}>
                <Icon size={20} className={selected ? "text-indigo-600" : "text-slate-500"} />
              </div>
              <div className="text-center">
                <p className={cn("text-sm font-semibold", selected ? "text-indigo-700" : "text-slate-900")}>
                  {label}
                </p>
                <p className="text-xs text-slate-500 mt-0.5 leading-snug">{description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <Button onClick={handleSave} loading={saving}>
          Save
        </Button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
            <Check size={15} />
            Saved
          </span>
        )}
      </div>
    </div>
  );
}
