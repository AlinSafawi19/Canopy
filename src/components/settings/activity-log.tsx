"use client";

import { AlertCircle, LogIn, LogOut, Lock, Shield, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AuditEvent {
  id: string;
  action: string;
  resource: string;
  severity: "info" | "warning" | "critical";
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
  createdAt: Date;
}

interface ActivityLogProps {
  events: AuditEvent[];
  isLoading?: boolean;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  login: <LogIn className="w-4 h-4 text-blue-600" />,
  logout: <LogOut className="w-4 h-4 text-slate-600" />,
  password_changed: <Lock className="w-4 h-4 text-green-600" />,
  password_reset: <Lock className="w-4 h-4 text-green-600" />,
  "2fa_enabled": <Shield className="w-4 h-4 text-green-600" />,
  "2fa_disabled": <Shield className="w-4 h-4 text-red-600" />,
  email_changed: <AlertCircle className="w-4 h-4 text-amber-600" />,
  login_failed: <AlertCircle className="w-4 h-4 text-red-600" />,
};

const ACTION_LABELS: Record<string, string> = {
  login: "Signed in",
  logout: "Signed out",
  password_changed: "Password changed",
  password_reset: "Password reset",
  "2fa_enabled": "2FA enabled",
  "2fa_disabled": "2FA disabled",
  email_changed: "Email changed",
  login_failed: "Failed sign-in attempt",
};

const SEVERITY_COLORS: Record<string, string> = {
  info: "bg-blue-50 border-blue-200",
  warning: "bg-amber-50 border-amber-200",
  critical: "bg-red-50 border-red-200",
};

const SEVERITY_BADGES: Record<string, React.ReactNode> = {
  info: <Badge variant="info">Info</Badge>,
  warning: <Badge variant="warning">Warning</Badge>,
  critical: <Badge variant="danger">Critical</Badge>,
};

export function ActivityLog({ events, isLoading }: ActivityLogProps) {
  if (isLoading) {
    return (
      <div className="text-center py-8 text-slate-500">
        <p>Loading activity...</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <p>No activity yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event) => {
        const eventDate = new Date(event.createdAt);
        const timeStr = eventDate.toLocaleTimeString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        return (
          <div
            key={event.id}
            className={`flex items-start gap-3 p-4 rounded-lg border ${SEVERITY_COLORS[event.severity]}`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {ACTION_ICONS[event.action] || <Eye className="w-4 h-4 text-slate-600" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-slate-900">
                  {ACTION_LABELS[event.action] || event.action}
                </span>
                {SEVERITY_BADGES[event.severity]}
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                <span>{timeStr}</span>
                {event.ipAddress && (
                  <>
                    <span>•</span>
                    <span title="IP Address">{event.ipAddress}</span>
                  </>
                )}
              </div>
              {event.userAgent && (
                <p className="text-xs text-slate-500 mt-1 truncate" title={event.userAgent}>
                  {event.userAgent}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
