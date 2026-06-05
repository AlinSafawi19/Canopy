"use client";

import { useState } from "react";
import { LogOut, Monitor, Smartphone, Tablet, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { apiFetch } from "@/lib/api-fetch";
import { parseUserAgent } from "@/lib/parse-user-agent";

interface Session {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  lastActivityAt: Date;
}

interface SessionListProps {
  sessions: Session[];
  currentSessionId: string;
}

function DeviceIcon({ userAgent }: { userAgent: string | null }) {
  const { device } = parseUserAgent(userAgent);
  if (device === "Mobile") return <Smartphone className="w-4 h-4" />;
  if (device === "Tablet") return <Tablet className="w-4 h-4" />;
  return <Monitor className="w-4 h-4" />;
}

function timeAgo(date: Date): string {
  const minutes = Math.round((Date.now() - new Date(date).getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function SessionList({ sessions, currentSessionId }: SessionListProps) {
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokedBulk, setRevokedBulk] = useState(false);
  const [revoked, setRevoked] = useState<Set<string>>(new Set());
  const [showRevokeAllModal, setShowRevokeAllModal] = useState(false);

  async function revokeSession(sessionId: string) {
    setRevoking(sessionId);
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
      if (res.ok) {
        setRevoked((prev) => new Set(prev).add(sessionId));
      } else {
        const data = await res.json();
        console.error("Failed to revoke session:", data.error);
      }
    } catch (err) {
      console.error("Failed to revoke session:", err);
    } finally {
      setRevoking(null);
    }
  }

  async function revokeAllOthers() {
    setRevokedBulk(true);
    setShowRevokeAllModal(false);
    try {
      const res = await apiFetch("/api/sessions/revoke-all", { method: "POST" });
      if (res.ok) {
        activeSessions
          .filter((s) => s.id !== currentSessionId)
          .forEach((s) => setRevoked((prev) => new Set(prev).add(s.id)));
      } else {
        const data = await res.json();
        console.error("Failed to revoke sessions:", data.error);
      }
    } catch (err) {
      console.error("Failed to revoke sessions:", err);
    } finally {
      setRevokedBulk(false);
    }
  }

  const activeSessions = sessions.filter((s) => !revoked.has(s.id));
  const otherCount = activeSessions.filter((s) => s.id !== currentSessionId).length;

  if (activeSessions.length === 0) {
    return (
      <p className="text-sm text-slate-500 py-4">No active sessions found.</p>
    );
  }

  return (
    <>
      <div className="divide-y divide-slate-100">
        {activeSessions.map((session) => {
          const isCurrent = session.id === currentSessionId;
          const { browser, os } = parseUserAgent(session.userAgent);

          return (
            <div key={session.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
              <div
                className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
                  isCurrent ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-500"
                }`}
              >
                <DeviceIcon userAgent={session.userAgent} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">
                    {browser} on {os}
                  </span>
                  {isCurrent && <Badge variant="info">Current</Badge>}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                  {session.ipAddress && <span>{session.ipAddress}</span>}
                  {session.ipAddress && <span>·</span>}
                  <span>{timeAgo(session.lastActivityAt)}</span>
                </div>
              </div>

              {!isCurrent && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => revokeSession(session.id)}
                  disabled={revoking === session.id || revokedBulk}
                  className="flex-shrink-0 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  {revoking === session.id ? "Revoking…" : "Revoke"}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {otherCount > 0 && (
        <div className="pt-4 mt-2 border-t border-slate-100">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRevokeAllModal(true)}
            disabled={revokedBulk}
            className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
          >
            <Zap className="w-3.5 h-3.5" />
            {revokedBulk ? "Revoking…" : `Revoke all other sessions (${otherCount})`}
          </Button>
        </div>
      )}

      <ConfirmModal
        open={showRevokeAllModal}
        onClose={() => setShowRevokeAllModal(false)}
        onConfirm={revokeAllOthers}
        title="Revoke All Other Sessions"
        message={`This will sign out ${otherCount} other device${otherCount !== 1 ? "s" : ""}. Your current session will stay active.`}
        confirmLabel="Revoke All"
        variant="danger"
        loading={revokedBulk}
      />
    </>
  );
}
