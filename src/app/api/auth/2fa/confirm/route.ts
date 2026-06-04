import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  verifyTOTP,
  setTwoFactorEnabled,
  generateBackupCodes,
  saveBackupCodes,
} from "@/lib/two-factor";
import { prisma } from "@/lib/prisma";
import { sendSecurityAlertEmail, getUserEmailAndName } from "@/lib/security-alerts";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await request.json();

  if (!code) {
    return NextResponse.json({ error: "Code is required" }, { status: 400 });
  }

  try {
    const pending = await prisma.pendingTwoFactorSetup.findUnique({
      where: { targetKind_targetId: { targetKind: session.role, targetId: session.id } },
    });

    if (!pending) {
      return NextResponse.json({ error: "No pending 2FA setup. Start setup again." }, { status: 400 });
    }

    if (pending.expiresAt < new Date()) {
      await prisma.pendingTwoFactorSetup.delete({ where: { id: pending.id } });
      return NextResponse.json({ error: "Setup session expired. Start setup again." }, { status: 400 });
    }

    if (!verifyTOTP(pending.secret, code)) {
      return NextResponse.json({ error: "Invalid code. Make sure your device clock is correct." }, { status: 400 });
    }

    const backupCodes = generateBackupCodes(10);

    await setTwoFactorEnabled(session.id, session.role, pending.secret, true);
    await saveBackupCodes(session.role, session.id, backupCodes);
    await prisma.pendingTwoFactorSetup.delete({ where: { id: pending.id } });

    getUserEmailAndName(session.id, session.role).then((user) => {
      if (user) sendSecurityAlertEmail(user.email, user.displayName, "2fa_enabled").catch(() => {});
    });

    return NextResponse.json({ backupCodes });
  } catch (err) {
    console.error("[2fa/confirm]", err);
    return NextResponse.json({ error: "Failed to confirm 2FA" }, { status: 500 });
  }
}
