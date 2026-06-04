"use client";

import { useState } from "react";
import { LogOut, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api-fetch";
import { formatDeviceInfo } from "@/lib/parse-user-agent";

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

export function SessionList({ sessions, currentSessionId }: SessionListProps) {
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokedBulk, setRevokedBulk] = useState(false);
  const [revoked, setRevoked] = useState<Set<string>>(new Set());

  async function revokeSession(sessionId: string) {
    if (sessionId === currentSessionId) {
      alert("Cannot revoke current session. Use logout instead.");
      return;
    }

    setRevoking(sessionId);
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}`, {
        method: "DELETE",
      });
      setRevoking(null);
      if (res.ok) {
        setRevoked((prev) => new Set(prev).add(sessionId));
      } else {
        const data = await res.json();
        console.error("Failed to revoke session:", data.error);
      }
    } catch (err) {
      setRevoking(null);
      console.error("Failed to revoke session:", err);
    }
  }

  async function revokeAllOthers() {
    if (
      !confirm(
        "Are you sure? This will revoke all other sessions and you'll need to sign in again on those devices."
      )
    ) {
      return;
    }

    setRevokedBulk(true);
    try {
      const res = await apiFetch("/api/sessions/revoke-all", {
        method: "POST",
      });

      if (res.ok) {
        const otherSessions = activeSessions.filter((s) => s.id !== currentSessionId);
        for (const session of otherSessions) {
          setRevoked((prev) => new Set(prev).add(session.id));
        }
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

  if (activeSessions.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <p>No active sessions found</p>
      </div>
    );
  }

  const otherSessionsCount = activeSessions.filter((s) => s.id !== currentSessionId).length;

  return (
    <div className="space-y-4">
      {otherSessionsCount > 0 && (
        <Button
          variant="danger"
          size="sm"
          onClick={revokeAllOthers}
          disabled={revokedBulk}
          className="w-full"
        >
          <Zap className="w-4 h-4 mr-2" />
          {revokedBulk ? "Revoking..." : `Revoke All Other Sessions (${otherSessionsCount})`}
        </Button>
      )}

      <div className="space-y-3">
        {activeSessions.map((session) => {
          const isCurrent = session.id === currentSessionId;
          const lastActivity = new Date(session.lastActivityAt);
          const now = new Date();
          const minutesAgo = Math.round((now.getTime() - lastActivity.getTime()) / (1000 * 60));
          const hoursAgo = Math.round(minutesAgo / 60);
          const daysAgo = Math.round(hoursAgo / 24);

          let timeStr = "Just now";
          if (minutesAgo > 0 && minutesAgo < 60) timeStr = `${minutesAgo} min ago`;
          else if (hoursAgo > 0 && hoursAgo < 24) timeStr = `${hoursAgo} hour${hoursAgo !== 1 ? "s" : ""} ago`;
          else if (daysAgo > 0) timeStr = `${daysAgo} day${daysAgo !== 1 ? "s" : ""} ago`;

          const deviceInfo = formatDeviceInfo(session.userAgent);

          return (
            <div
              key={session.id}
              className={`flex items-start justify-between p-4 rounded-lg border ${
                isCurrent ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className={`w-4 h-4 flex-shrink-0 ${isCurrent ? "text-blue-600" : "text-slate-600"}`} />
                  <span className="font-medium text-slate-900">
                    {isCurrent ? "This Device" : "Active Session"}
                  </span>
                  {isCurrent && <Badge variant="success">Current</Badge>}
                </div>

                <p className="text-sm text-slate-600 mb-1">{deviceInfo}</p>

                <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                  {session.ipAddress && <span>{session.ipAddress}</span>}
                  <span>•</span>
                  <span>{timeStr}</span>
                </div>
              </div>

              {!isCurrent && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => revokeSession(session.id)}
                  disabled={revoking === session.id || revokedBulk}
                  className="ml-4 text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                >
                  <LogOut className="w-4 h-4 mr-1" />
                  {revoking === session.id ? "Revoking..." : "Revoke"}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
