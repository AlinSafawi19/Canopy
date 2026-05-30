import { prisma } from "./prisma";
import type { SessionPayload } from "./auth";

interface LogOptions {
  session: SessionPayload;
  action: string;
  resource: string;
  resourceId?: string;
  resourceName?: string;
  adminTenantId?: string;
  parentClientUsername?: string;
}

export async function logActivity(opts: LogOptions): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        actorId: opts.session.id,
        actorRole: opts.session.role,
        actorName: opts.session.displayName,
        action: opts.action,
        resource: opts.resource,
        resourceId: opts.resourceId ?? null,
        resourceName: opts.resourceName ?? null,
        adminTenantId: opts.adminTenantId ?? null,
        parentClientUsername: opts.parentClientUsername ?? null,
      },
    });
  } catch (err) {
    console.error("[logActivity]", err);
  }
}
