"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-fetch";
import { InviteLinkPopup } from "./invite-link-popup";
import { RefreshCw, Copy, Check } from "lucide-react";

interface Props {
  targetKind: string;
  targetId: string;
  displayName: string;
  status: "pending" | "used" | "expired" | "none";
  token?: string;
}

const STATUS_STYLES = {
  pending:  { dot: "bg-amber-400",  label: "Pending",  text: "text-amber-700",  bg: "bg-amber-50 border-amber-200" },
  used:     { dot: "bg-emerald-400", label: "Used",     text: "text-emerald-700",bg: "bg-emerald-50 border-emerald-200" },
  expired:  { dot: "bg-red-400",    label: "Expired",  text: "text-red-700",    bg: "bg-red-50 border-red-200" },
  none:     { dot: "bg-slate-300",  label: "No invite", text: "text-slate-500",  bg: "bg-slate-50 border-slate-200" },
};

export function InviteStatusCell({ targetKind, targetId, displayName, status, token }: Props) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");

  const style = STATUS_STYLES[status];

  async function handleRegenerate() {
    setLoading(true);
    const res = await apiFetch("/api/auth/invite/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetKind, targetId }),
    }).catch(() => null);
    setLoading(false);
    if (!res?.ok) return;
    const data = await res.json();
    setInviteUrl(`${window.location.origin}/invite?token=${data.inviteToken}`);
  }

  function handleCopy() {
    if (!token) return;
    const url = `${window.location.origin}/invite?token=${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${style.bg} ${style.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
          {style.label}
        </span>

        {status === "pending" && token && (
          <button
            title="Copy invite link"
            onClick={handleCopy}
            className="p-1 rounded text-slate-400 hover:text-indigo-600 transition-colors"
          >
            {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
          </button>
        )}

        {(status === "expired" || status === "used" || status === "none") && (
          <button
            title="Generate new invite link"
            disabled={loading}
            onClick={handleRegenerate}
            className="p-1 rounded text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        )}
      </div>

      {inviteUrl && (
        <InviteLinkPopup
          inviteUrl={inviteUrl}
          displayName={displayName}
          onClose={() => setInviteUrl("")}
        />
      )}
    </>
  );
}
