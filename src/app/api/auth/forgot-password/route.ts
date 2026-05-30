import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    let targetKind: string | null = null;
    let targetId: string | null = null;
    let toEmail: string | null = null;
    let displayName: string | null = null;

    const owner = await prisma.platformOwner.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    });
    if (owner) { targetKind = "owner"; targetId = owner.id; toEmail = owner.email; displayName = owner.displayName; }

    if (!targetKind) {
      const admin = await prisma.adminIdentity.findFirst({
        where: { email: { equals: normalizedEmail, mode: "insensitive" }, archivedAt: null },
      });
      if (admin) { targetKind = "admin"; targetId = admin.id; toEmail = admin.email; displayName = admin.displayName; }
    }

    if (!targetKind) {
      const client = await prisma.clientIdentity.findFirst({
        where: { email: { equals: normalizedEmail, mode: "insensitive" }, archivedAt: null },
      });
      if (client) { targetKind = "client"; targetId = client.id; toEmail = client.email; displayName = client.displayName; }
    }

    if (!targetKind) {
      const contributor = await prisma.contributor.findFirst({
        where: { email: { equals: normalizedEmail, mode: "insensitive" }, archivedAt: null },
      });
      if (contributor) { targetKind = "contributor"; targetId = contributor.id; toEmail = contributor.email; displayName = contributor.displayName; }
    }

    // Always return success to prevent email enumeration
    if (!targetKind || !targetId || !toEmail) {
      return NextResponse.json({ ok: true });
    }

    await prisma.passwordResetChallenge.deleteMany({ where: { targetKind, targetId } });

    const code = String(crypto.randomInt(100000, 1000000));
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes

    await prisma.passwordResetChallenge.create({ data: { targetKind, targetId, codeHash, expiresAt } });

    await sendMail({
      to: toEmail,
      subject: "Reset your Canopy password",
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:24px;">
          <h2 style="font-size:18px;font-weight:600;color:#0f172a;margin-bottom:8px;">Reset your password</h2>
          <p style="color:#475569;margin-bottom:24px;">Hi ${displayName},<br><br>Enter the code below to reset your password. This code expires in <strong>15 minutes</strong>.</p>
          <div style="text-align:center;margin:32px 0;">
            <div style="display:inline-block;background:#f8fafc;border:2px solid #e2e8f0;border-radius:12px;padding:20px 40px;">
              <span style="font-size:36px;font-weight:700;letter-spacing:0.15em;color:#0f172a;font-family:monospace;">${code}</span>
            </div>
          </div>
          <p style="color:#94a3b8;font-size:13px;margin-top:32px;">If you didn't request a password reset, you can safely ignore this email.</p>
        </div>
      `,
      text: `Your Canopy password reset code is: ${code}\n\nExpires in 15 minutes.`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[forgot-password]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
