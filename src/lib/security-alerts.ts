import { sendMail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";

type SecurityEvent = "password_changed" | "email_changed" | "2fa_enabled" | "2fa_disabled";

const SUBJECTS: Record<SecurityEvent, string> = {
  password_changed: "Your Canopy password was changed",
  email_changed:    "Your Canopy email address was changed",
  "2fa_enabled":    "Two-factor authentication enabled on your Canopy account",
  "2fa_disabled":   "Two-factor authentication disabled on your Canopy account",
};

const BODIES: Record<SecurityEvent, { detail: string; action: string }> = {
  password_changed: {
    detail: "Your account password was just changed.",
    action: "If this wasn't you, reset your password immediately to secure your account.",
  },
  email_changed: {
    detail: "The email address on your account was just changed to a new address.",
    action: "If this wasn't you, reset your password immediately to secure your account.",
  },
  "2fa_enabled": {
    detail: "Two-factor authentication (2FA) has been enabled on your account.",
    action: "If you didn't make this change, reset your password immediately.",
  },
  "2fa_disabled": {
    detail: "Two-factor authentication (2FA) has been disabled on your account.",
    action: "If you didn't make this change, re-enable 2FA and reset your password immediately.",
  },
};

export async function sendSecurityAlertEmail(
  to: string,
  displayName: string,
  event: SecurityEvent
): Promise<void> {
  const subject = SUBJECTS[event];
  const { detail, action } = BODIES[event];

  await sendMail({
    to,
    subject,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 16px;margin-bottom:24px;">
          <p style="margin:0;font-size:12px;font-weight:600;color:#991b1b;text-transform:uppercase;letter-spacing:0.05em;">Security alert</p>
        </div>
        <h2 style="font-size:18px;font-weight:600;color:#0f172a;margin:0 0 16px;">${subject}</h2>
        <p style="color:#475569;margin:0 0 12px;">Hi ${displayName},</p>
        <p style="color:#475569;margin:0 0 12px;">${detail}</p>
        <p style="color:#475569;margin:0 0 32px;">${action}</p>
        <p style="color:#94a3b8;font-size:12px;margin:0;">This is an automated security notification from Canopy.</p>
      </div>
    `,
    text: `Security alert: ${subject}\n\nHi ${displayName},\n\n${detail}\n\n${action}\n\nThis is an automated security notification from Canopy.`,
  });
}

export async function getUserEmailAndName(
  id: string,
  role: string
): Promise<{ email: string; displayName: string } | null> {
  if (role === "owner")
    return prisma.platformOwner.findUnique({ where: { id }, select: { email: true, displayName: true } });
  if (role === "admin")
    return prisma.adminIdentity.findUnique({ where: { id }, select: { email: true, displayName: true } });
  if (role === "client")
    return prisma.clientIdentity.findUnique({ where: { id }, select: { email: true, displayName: true } });
  if (role === "contributor")
    return prisma.contributor.findUnique({ where: { id }, select: { email: true, displayName: true } });
  return null;
}
