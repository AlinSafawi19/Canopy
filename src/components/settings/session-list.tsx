"use client";

import { useState } from "react";
import { LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api-fetch";

interface Session {
  id: string;
  createdAt: Date;
}

interface SessionListProps {
  sessions: Session[];
  currentSessionId: string;
}

export function SessionList({ sessions, currentSessionId }: SessionListProps) {
  const [revoking, setRevoking] = useState<string | null>(null);
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
        // Optional: Show toast notification
        // toast.success("Session revoked");
      } else {
        const data = await res.json();
        console.error("Failed to revoke session:", data.error);
        // Optional: Show error toast
        // toast.error(data.error || "Failed to revoke session");
      }
    } catch (err) {
      setRevoking(null);
      console.error("Failed to revoke session:", err);
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

  return (
    <div className="space-y-3">
      {activeSessions.map((session) => {
        const isCurrent = session.id === currentSessionId;
        const createdDate = new Date(session.createdAt);
        const now = new Date();
        const hoursAgo = Math.round((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60));

        return (
          <div
            key={session.id}
            className={`flex items-center justify-between p-4 rounded-lg border ${
              isCurrent ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Shield className={`w-4 h-4 ${isCurrent ? "text-blue-600" : "text-slate-600"}`} />
                <span className="font-medium text-slate-900">
                  {isCurrent ? "This Device (Current Session)" : "Active Session"}
                </span>
                {isCurrent && <Badge variant="success">Current</Badge>}
              </div>
              <p className="text-sm text-slate-500 mt-1">
                {hoursAgo === 0 ? "Just now" : `${hoursAgo} hour${hoursAgo !== 1 ? "s" : ""} ago`}
              </p>
            </div>
            {!isCurrent && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => revokeSession(session.id)}
                disabled={revoking === session.id}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <LogOut className="w-4 h-4 mr-1" />
                {revoking === session.id ? "Revoking..." : "Logout"}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
