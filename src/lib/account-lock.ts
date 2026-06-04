import { prisma } from "@/lib/prisma";
import type { SessionRole } from "@/lib/auth";

const FAILED_ATTEMPT_THRESHOLD = 10;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export async function checkAccountLock(
  targetKind: SessionRole,
  targetId: string
): Promise<{ locked: boolean; retryAfter: number }> {
  const lock = await prisma.accountLock.findUnique({
    where: { targetKind_targetId: { targetKind, targetId } },
  });

  if (!lock || !lock.lockedUntil) {
    return { locked: false, retryAfter: 0 };
  }

  const now = new Date();
  if (lock.lockedUntil > now) {
    const retryAfter = Math.ceil((lock.lockedUntil.getTime() - now.getTime()) / 1000);
    return { locked: true, retryAfter };
  }

  await prisma.accountLock.delete({ where: { id: lock.id } });
  return { locked: false, retryAfter: 0 };
}

export async function recordFailedLoginAttempt(
  targetKind: SessionRole,
  targetId: string
): Promise<void> {
  const lock = await prisma.accountLock.findUnique({
    where: { targetKind_targetId: { targetKind, targetId } },
  });

  let newFailedCount = 1;
  let lockedUntil: Date | null = null;

  if (lock) {
    newFailedCount = lock.failedCount + 1;
  }

  if (newFailedCount >= FAILED_ATTEMPT_THRESHOLD) {
    lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
  }

  await prisma.accountLock.upsert({
    where: { targetKind_targetId: { targetKind, targetId } },
    create: {
      targetKind,
      targetId,
      failedCount: newFailedCount,
      lockedUntil,
    },
    update: {
      failedCount: newFailedCount,
      lockedUntil,
    },
  });
}

export async function clearAccountLock(
  targetKind: SessionRole,
  targetId: string
): Promise<void> {
  await prisma.accountLock.deleteMany({
    where: { targetKind, targetId },
  });
}
