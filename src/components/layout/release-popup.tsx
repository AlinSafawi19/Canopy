"use client";

"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { Button } from "@/components/ui/button";
import { useScrollLock } from "@/lib/use-scroll-lock";

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
  useScrollLock(visible);

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
          <div
            className={[
              "text-sm text-slate-600",
              "[&_p]:mb-2 [&_p:last-child]:mb-0",
              "[&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2 [&_ul_li]:mb-0.5",
              "[&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-2 [&_ol_li]:mb-0.5",
              "[&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-slate-900 [&_h2]:mb-1 [&_h2]:mt-3",
              "[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-slate-900 [&_h3]:mb-1 [&_h3]:mt-3",
              "[&_strong]:font-semibold [&_strong]:text-slate-900",
              "[&_blockquote]:border-l-2 [&_blockquote]:border-slate-200 [&_blockquote]:pl-3 [&_blockquote]:text-slate-500 [&_blockquote]:italic",
              "[&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono",
              "[&_hr]:border-slate-200 [&_hr]:my-3",
            ].join(" ")}
            dangerouslySetInnerHTML={{ __html: release.notes }}
          />
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
