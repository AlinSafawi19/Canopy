import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  verifyTOTP,
  setTwoFactorEnabled,
  generateBackupCodes,
  saveBackupCodes,
} from "@/lib/two-factor";
import { sendSecurityAlertEmail, getUserEmailAndName } from "@/lib/security-alerts";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { secret, code } = await request.json();

  if (!secret || !code) {
    return NextResponse.json({ error: "Missing secret or code" }, { status: 400 });
  }

  if (!verifyTOTP(secret, code)) {
    return NextResponse.json({ error: "Invalid code. Make sure your device clock is correct." }, { status: 400 });
  }

  const backupCodes = generateBackupCodes(10);

  await setTwoFactorEnabled(session.id, session.role, secret, true);
  await saveBackupCodes(session.role, session.id, backupCodes);

  getUserEmailAndName(session.id, session.role).then((user) => {
    if (user) sendSecurityAlertEmail(user.email, user.displayName, "2fa_enabled").catch(() => {});
  });

  return NextResponse.json({ backupCodes });
}
