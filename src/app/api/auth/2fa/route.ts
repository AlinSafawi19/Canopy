import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  verifyTOTP,
  verifyAndConsumeBackupCode,
  getTwoFactorSecret,
  setTwoFactorEnabled,
} from "@/lib/two-factor";
import { prisma } from "@/lib/prisma";
import { sendSecurityAlertEmail, getUserEmailAndName } from "@/lib/security-alerts";

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await request.json();
  if (!code) return NextResponse.json({ error: "Code required" }, { status: 400 });

  const secret = await getTwoFactorSecret(session.id, session.role);
  if (!secret) return NextResponse.json({ error: "2FA not enabled" }, { status: 400 });

  const validTOTP = verifyTOTP(secret, code);
  const validBackup = validTOTP
    ? false
    : await verifyAndConsumeBackupCode(session.role, session.id, code);

  if (!validTOTP && !validBackup) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  await setTwoFactorEnabled(session.id, session.role, null, false);
  await prisma.twoFactorBackupCode.deleteMany({
    where: { targetKind: session.role, targetId: session.id },
  });

  getUserEmailAndName(session.id, session.role).then((user) => {
    if (user) sendSecurityAlertEmail(user.email, user.displayName, "2fa_disabled").catch(() => {});
  });

  return NextResponse.json({ ok: true });
}
