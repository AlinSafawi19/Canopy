import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth";

export type AuditSeverity = "info" | "warning" | "critical";

interface AuditLogOptions {
  session: SessionPayload;
  action: string;
  resource: string;
  severity?: AuditSeverity;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAuditEvent(options: AuditLogOptions): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: options.session.id,
        actorRole: options.session.role,
        action: options.action,
        resource: options.resource,
        severity: options.severity || "info",
        details: options.details as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
      },
    });
  } catch (err) {
    console.error("[audit-log] failed to create audit log:", err);
  }
}

export async function cleanupOldAuditLogs(): Promise<void> {
  // Delete audit logs older than 90 days (configurable per compliance requirements)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  try {
    await prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: ninetyDaysAgo },
      },
    });
  } catch (err) {
    console.error("[audit-log cleanup] failed:", err);
  }
}

export async function getSuspiciousActivity(actorId: string, windowMs: number = 15 * 60_000): Promise<number> {
  const since = new Date(Date.now() - windowMs);
  const count = await prisma.auditLog.count({
    where: {
      actorId,
      severity: { in: ["warning", "critical"] },
      createdAt: { gte: since },
    },
  });
  return count;
}

export async function logSecurityEvent(
  actorId: string,
  actorRole: string,
  action: string,
  details: Record<string, unknown>,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        actorRole,
        action,
        resource: "security",
        severity: "critical",
        details: details as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        ipAddress,
        userAgent,
      },
    });
  } catch (err) {
    console.error("[security-event] failed to log:", err);
  }
}
