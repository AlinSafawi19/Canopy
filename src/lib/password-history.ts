import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth";
import type { SessionRole } from "@/lib/auth";

const PASSWORD_HISTORY_COUNT = 5; // Prevent reuse of last 5 passwords

export async function addPasswordToHistory(
  targetKind: SessionRole,
  targetId: string,
  passwordHash: string
): Promise<void> {
  await prisma.passwordHistory.create({
    data: {
      targetKind,
      targetId,
      passwordHash,
    },
  });

  // Keep only the last PASSWORD_HISTORY_COUNT entries
  const allRecords = await prisma.passwordHistory.findMany({
    where: { targetKind, targetId },
    orderBy: { createdAt: "desc" },
    skip: PASSWORD_HISTORY_COUNT,
  });

  if (allRecords.length > 0) {
    await prisma.passwordHistory.deleteMany({
      where: { id: { in: allRecords.map((r) => r.id) } },
    });
  }
}

export async function checkPasswordNotInHistory(
  targetKind: SessionRole,
  targetId: string,
  password: string
): Promise<boolean> {
  const history = await prisma.passwordHistory.findMany({
    where: { targetKind, targetId },
    orderBy: { createdAt: "desc" },
    take: PASSWORD_HISTORY_COUNT,
  });

  for (const record of history) {
    const matches = await verifyPassword(password, record.passwordHash);
    if (matches) {
      return false; // Password is in history
    }
  }

  return true; // Password is not in history
}

export async function clearPasswordHistory(
  targetKind: SessionRole,
  targetId: string
): Promise<void> {
  await prisma.passwordHistory.deleteMany({
    where: { targetKind, targetId },
  });
}
