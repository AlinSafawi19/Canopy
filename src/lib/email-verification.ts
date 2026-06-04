import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import bcrypt from "bcryptjs";

export async function sendVerificationEmail(
  targetKind: string,
  targetId: string,
  toEmail: string,
  displayName: string
) {
  const code = String(Math.floor(10000000 + Math.random() * 90000000));
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes

  // Atomic: delete all existing challenges and create the new one in one transaction.
  // Prevents concurrent resend/auto-send calls from leaving multiple valid challenges.
  await prisma.$transaction([
    prisma.emailVerificationChallenge.deleteMany({ where: { targetKind, targetId } }),
    prisma.emailVerificationChallenge.create({ data: { targetKind, targetId, codeHash, expiresAt } }),
  ]);

  await sendMail({
    to: toEmail,
    subject: "Your Canopy verification code",
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2 style="font-size:18px;font-weight:600;color:#0f172a;margin-bottom:8px;">Verify your email address</h2>
        <p style="color:#475569;margin-bottom:24px;">Hi ${displayName},<br><br>Enter the code below to verify your email address. This code expires in <strong>15 minutes</strong>.</p>
        <div style="text-align:center;margin:32px 0;">
          <div style="display:inline-block;background:#f8fafc;border:2px solid #e2e8f0;border-radius:12px;padding:20px 40px;">
            <span style="font-size:36px;font-weight:700;letter-spacing:0.15em;color:#0f172a;font-family:monospace;">${code}</span>
          </div>
        </div>
        <p style="color:#94a3b8;font-size:13px;margin-top:32px;">If you didn't create a Canopy account, you can safely ignore this email.</p>
      </div>
    `,
    text: `Your Canopy verification code is: ${code}\n\nEnter it to verify your email address. Expires in 15 minutes.`,
  });
}
