import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import type { SessionRole } from "@/lib/auth";

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function trackSession(
  targetKind: SessionRole,
  targetId: string,
  token: string,
  ipAddress?: string,
  userAgent?: string
): Promise<string> {
  const tokenHash = hashToken(token);
  const record = await prisma.session.create({
    data: {
      targetKind,
      targetId,
      tokenHash,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    },
    select: { id: true },
  });
  return record.id;
}

export async function isSessionValid(token: string): Promise<boolean> {
  const tokenHash = hashToken(token);
  const session = await prisma.session.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
    },
  });
  return session !== null;
}

export async function revokeAllUserSessions(
  targetKind: SessionRole,
  targetId: string
): Promise<void> {
  await prisma.session.updateMany({
    where: {
      targetKind,
      targetId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

export async function revokeSession(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await prisma.session.updateMany({
    where: { tokenHash },
    data: { revokedAt: new Date() },
  });
}

export async function cleanupExpiredSessions(): Promise<void> {
  // Delete sessions older than 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await prisma.session.deleteMany({
    where: {
      createdAt: { lt: thirtyDaysAgo },
    },
  });
}
