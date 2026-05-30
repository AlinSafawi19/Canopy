import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import type { SessionRole } from "@/lib/auth";

const ISSUER = "Canopy";

export function generateTOTPSecret() {
  return new OTPAuth.Secret();
}

export function buildTOTP(secret: OTPAuth.Secret | string, label: string) {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: typeof secret === "string" ? OTPAuth.Secret.fromBase32(secret) : secret,
  });
}

export async function generateQRCode(uri: string): Promise<string> {
  return QRCode.toDataURL(uri, { width: 200, margin: 1 });
}

export function verifyTOTP(secret: string, token: string): boolean {
  const totp = buildTOTP(secret, "");
  const delta = totp.validate({ token: token.replace(/\s/g, ""), window: 1 });
  return delta !== null;
}

export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const bytes = crypto.randomBytes(4).toString("hex").toUpperCase();
    return `${bytes.slice(0, 4)}-${bytes.slice(4)}`;
  });
}

export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((c) => bcrypt.hash(c, 10)));
}

export async function saveBackupCodes(targetKind: string, targetId: string, codes: string[]) {
  await prisma.twoFactorBackupCode.deleteMany({ where: { targetKind, targetId } });
  const hashes = await hashBackupCodes(codes);
  await prisma.twoFactorBackupCode.createMany({
    data: hashes.map((codeHash) => ({ targetKind, targetId, codeHash })),
  });
}

export async function verifyAndConsumeBackupCode(
  targetKind: string,
  targetId: string,
  code: string
): Promise<boolean> {
  const normalized = code.replace(/\s/g, "").toUpperCase();
  const stored = await prisma.twoFactorBackupCode.findMany({ where: { targetKind, targetId } });
  for (const record of stored) {
    if (await bcrypt.compare(normalized, record.codeHash)) {
      // Atomic delete: if a concurrent request already consumed this code,
      // deleteMany returns count=0 and we treat it as a failed attempt.
      const { count } = await prisma.twoFactorBackupCode.deleteMany({
        where: { id: record.id },
      });
      return count > 0;
    }
  }
  return false;
}

export async function getTwoFactorSecret(id: string, role: SessionRole): Promise<string | null> {
  if (role === "owner") {
    const u = await prisma.platformOwner.findUnique({ where: { id }, select: { twoFactorSecret: true } });
    return u?.twoFactorSecret ?? null;
  } else if (role === "admin") {
    const u = await prisma.adminIdentity.findUnique({ where: { id }, select: { twoFactorSecret: true } });
    return u?.twoFactorSecret ?? null;
  } else if (role === "client") {
    const u = await prisma.clientIdentity.findUnique({ where: { id }, select: { twoFactorSecret: true } });
    return u?.twoFactorSecret ?? null;
  } else {
    const u = await prisma.contributor.findUnique({ where: { id }, select: { twoFactorSecret: true } });
    return u?.twoFactorSecret ?? null;
  }
}

export async function setTwoFactorEnabled(id: string, role: SessionRole, secret: string | null, enabled: boolean) {
  const data = {
    twoFactorSecret: secret,
    twoFactorEnabled: enabled,
    ...(enabled ? { mustShow2faReminder: false } : {}),
  };
  if (role === "owner") {
    await prisma.platformOwner.update({ where: { id }, data });
  } else if (role === "admin") {
    await prisma.adminIdentity.update({ where: { id }, data });
  } else if (role === "client") {
    await prisma.clientIdentity.update({ where: { id }, data });
  } else {
    await prisma.contributor.update({ where: { id }, data });
  }
}
