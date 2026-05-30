import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generateTOTPSecret, buildTOTP, generateQRCode } from "@/lib/two-factor";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const secret = generateTOTPSecret();
  const totp = buildTOTP(secret, session.username);
  const uri = totp.toString();
  const qrCode = await generateQRCode(uri);

  return NextResponse.json({
    secret: secret.base32,
    qrCode,
    uri,
  });
}
