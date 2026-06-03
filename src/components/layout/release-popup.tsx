"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { Button } from "@/components/ui/button";

interface PendingRelease {
  id: string;
  version: string;
  title: string;
  notes: string;
}

interface ReleasePopupProps {
  release: PendingRelease;
}

export function ReleasePopup({ release }: ReleasePopupProps) {
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(false);

  async function handleAck() {
    setLoading(true);
    await apiFetch("/api/auth/release-seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ releaseId: release.id }),
    }).catch(() => {});
    setVisible(false);
  }

  if (!visible) return null;

  const lines = release.notes
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex-shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-semibold px-2.5 py-1 rounded-full">
              <Sparkles size={11} />
              What&rsquo;s new
            </div>
            <span className="text-xs font-mono text-slate-400">{release.version}</span>
          </div>
          <h2 className="text-lg font-semibold text-slate-900 leading-snug">
            {release.title}
          </h2>
        </div>

        {/* Notes */}
        <div className="px-6 pb-4 overflow-y-auto flex-1 min-h-0">
          <div className="space-y-2">
            {lines.map((line, i) => {
              const isBullet = line.startsWith("- ") || line.startsWith("• ");
              const text = isBullet ? line.slice(2) : line;
              return isBullet ? (
                <div key={i} className="flex gap-2 text-sm text-slate-600">
                  <span className="text-indigo-400 mt-0.5 flex-shrink-0">•</span>
                  <span>{text}</span>
                </div>
              ) : (
                <p key={i} className="text-sm text-slate-600">{text}</p>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0">
          <Button className="w-full" onClick={handleAck} loading={loading}>
            Got it
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
