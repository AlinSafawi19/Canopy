import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

const EXPIRY_DAYS = 7;

export type InviteStatus = "pending" | "used" | "expired";

export interface InviteInfo {
  id: string;
  token: string;
  targetKind: string;
  targetId: string;
  usedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  status: InviteStatus;
}

export function inviteStatus(invite: { usedAt: Date | null; expiresAt: Date }): InviteStatus {
  if (invite.usedAt) return "used";
  if (invite.expiresAt < new Date()) return "expired";
  return "pending";
}

export async function createInviteToken(targetKind: string, targetId: string): Promise<string> {
  // Invalidate any existing unused tokens for this user
  await prisma.inviteToken.deleteMany({ where: { targetKind, targetId, usedAt: null } });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await prisma.inviteToken.create({ data: { token, targetKind, targetId, expiresAt } });
  return token;
}

export async function getLatestInvite(targetKind: string, targetId: string): Promise<InviteInfo | null> {
  const invite = await prisma.inviteToken.findFirst({
    where: { targetKind, targetId },
    orderBy: { createdAt: "desc" },
  });
  if (!invite) return null;
  return { ...invite, status: inviteStatus(invite) };
}

export async function getInviteByToken(token: string): Promise<InviteInfo | null> {
  const invite = await prisma.inviteToken.findUnique({ where: { token } });
  if (!invite) return null;
  return { ...invite, status: inviteStatus(invite) };
}

export async function redeemInviteToken(
  token: string,
  password: string
): Promise<{ ok: true; targetKind: string; targetId: string } | { ok: false; error: string }> {
  const invite = await getInviteByToken(token);
  if (!invite) return { ok: false, error: "Invalid invite link." };
  if (invite.status === "used") return { ok: false, error: "This invite link has already been used." };
  if (invite.status === "expired") return { ok: false, error: "This invite link has expired." };

  const hashed = await hashPassword(password);

  await prisma.$transaction(async (tx) => {
    if (invite.targetKind === "admin") {
      await tx.adminIdentity.update({ where: { id: invite.targetId }, data: { password: hashed } });
    } else if (invite.targetKind === "client") {
      await tx.clientIdentity.update({ where: { id: invite.targetId }, data: { password: hashed } });
    } else if (invite.targetKind === "contributor") {
      await tx.contributor.update({ where: { id: invite.targetId }, data: { password: hashed } });
    }
    await tx.inviteToken.update({ where: { id: invite.id }, data: { usedAt: new Date() } });
  });

  return { ok: true, targetKind: invite.targetKind, targetId: invite.targetId };
}
