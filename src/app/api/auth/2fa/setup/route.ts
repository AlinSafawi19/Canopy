import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generateTOTPSecret, buildTOTP, generateQRCode } from "@/lib/two-factor";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const secret = generateTOTPSecret();
    const totp = buildTOTP(secret, session.username);
    const uri = totp.toString();
    const qrCode = await generateQRCode(uri);

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.pendingTwoFactorSetup.upsert({
      where: { targetKind_targetId: { targetKind: session.role, targetId: session.id } },
      create: {
        targetKind: session.role,
        targetId: session.id,
        secret: secret.base32,
        expiresAt,
      },
      update: {
        secret: secret.base32,
        expiresAt,
      },
    });

    return NextResponse.json({
      secret: secret.base32,
      qrCode,
      uri,
    });
  } catch (err) {
    console.error("[2fa/setup]", err);
    return NextResponse.json({ error: "Failed to setup 2FA" }, { status: 500 });
  }
}
