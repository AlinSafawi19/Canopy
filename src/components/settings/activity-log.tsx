"use client";

import { LogIn, LogOut, Lock, Shield, Mail, AlertTriangle, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDeviceInfo } from "@/lib/parse-user-agent";

interface AuditEvent {
  id: string;
  action: string;
  resource: string;
  severity: string;
  ipAddress: string | null;
  userAgent: string | null;
  details: unknown;
  createdAt: Date;
}

interface ActivityLogProps {
  events: AuditEvent[];
  isLoading?: boolean;
}

const ACTION_CONFIG: Record<string, { label: string; icon: React.ReactNode; badge: React.ReactNode }> = {
  login:            { label: "Signed in",              icon: <LogIn className="w-4 h-4 text-indigo-500" />,  badge: <Badge variant="info">Auth</Badge> },
  logout:           { label: "Signed out",             icon: <LogOut className="w-4 h-4 text-slate-400" />,  badge: <Badge variant="default">Auth</Badge> },
  password_changed: { label: "Password changed",       icon: <Lock className="w-4 h-4 text-emerald-500" />,  badge: <Badge variant="success">Security</Badge> },
  password_reset:   { label: "Password reset",         icon: <Lock className="w-4 h-4 text-amber-500" />,    badge: <Badge variant="warning">Security</Badge> },
  "2fa_enabled":    { label: "Two-factor enabled",     icon: <Shield className="w-4 h-4 text-emerald-500" />,badge: <Badge variant="success">Security</Badge> },
  "2fa_disabled":   { label: "Two-factor disabled",    icon: <Shield className="w-4 h-4 text-red-400" />,    badge: <Badge variant="danger">Security</Badge> },
  email_changed:    { label: "Email address changed",  icon: <Mail className="w-4 h-4 text-amber-500" />,    badge: <Badge variant="warning">Account</Badge> },
  login_failed:     { label: "Failed sign-in attempt", icon: <AlertTriangle className="w-4 h-4 text-red-500" />, badge: <Badge variant="danger">Alert</Badge> },
};

function formatDate(date: Date): string {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ActivityLog({ events, isLoading }: ActivityLogProps) {
  if (isLoading) {
    return <p className="text-sm text-slate-500 py-4">Loading activity…</p>;
  }

  if (events.length === 0) {
    return <p className="text-sm text-slate-500 py-4">No activity recorded yet.</p>;
  }

  return (
    <div className="divide-y divide-slate-100">
      {events.map((event) => {
        const config = ACTION_CONFIG[event.action] ?? {
          label: event.action,
          icon: <Eye className="w-4 h-4 text-slate-400" />,
          badge: <Badge variant="default">Event</Badge>,
        };

        return (
          <div key={event.id} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
            <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center mt-0.5">
              {config.icon}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-slate-900">{config.label}</span>
                {config.badge}
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-400 flex-wrap">
                <span>{formatDate(event.createdAt)}</span>
                {event.ipAddress && (
                  <>
                    <span>·</span>
                    <span>{event.ipAddress}</span>
                  </>
                )}
                {event.userAgent && (
                  <>
                    <span>·</span>
                    <span>{formatDeviceInfo(event.userAgent)}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
