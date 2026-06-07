"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Link2, Copy, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScrollLock } from "@/lib/use-scroll-lock";

interface InviteLinkPopupProps {
  inviteUrl: string;
  displayName: string;
  onClose: () => void;
}

export function InviteLinkPopup({ inviteUrl, displayName, onClose }: InviteLinkPopupProps) {
  const [copied, setCopied] = useState(false);
  useScrollLock(true);

  function handleCopy() {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <Link2 size={18} className="text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Account created</p>
            <p className="text-xs text-slate-500">Share this link with {displayName} to let them set their password.</p>
          </div>
        </div>

        {/* URL box */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Invite link</p>
          <p className="text-xs text-slate-700 break-all font-mono leading-relaxed">{inviteUrl}</p>
        </div>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="w-full flex items-center justify-center gap-2 h-10 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          {copied ? (
            <><Check size={15} className="text-emerald-500" /> Copied!</>
          ) : (
            <><Copy size={15} /> Copy invite link</>
          )}
        </button>

        {/* Expiry notice */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Clock size={12} className="flex-shrink-0" />
          This link expires in 7 days. You can generate a new one from the admin table if it expires.
        </div>

        {/* Done */}
        <Button className="w-full" onClick={onClose}>Done</Button>
      </div>
    </div>,
    document.body
  );
}
