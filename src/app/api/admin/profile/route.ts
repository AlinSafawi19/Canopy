import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email-verification";
import { validateEmail, validateDisplayName } from "@/lib/validation";
import { performPasswordChange } from "@/lib/password-change-helper";

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id } = session;

    if (body.newPassword) {
      if (!body.currentPassword) {
        return NextResponse.json({ error: "Current password is required." }, { status: 400 });
      }

      const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
      const userAgent = request.headers.get("user-agent") || undefined;

      const result = await performPasswordChange(id, "admin", body.currentPassword, body.newPassword, ipAddress, userAgent);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
    } else {
      const nameErr = validateDisplayName(body.displayName);
      if (nameErr) return NextResponse.json({ error: nameErr }, { status: 400 });

      const emailErr = validateEmail(body.email);
      if (emailErr) return NextResponse.json({ error: emailErr }, { status: 400 });

      const current = await prisma.adminIdentity.findUnique({ where: { id }, select: { email: true, displayName: true } });
      const newEmail = body.email.trim().toLowerCase();
      const emailChanged = newEmail !== current?.email?.toLowerCase();

      await prisma.adminIdentity.update({
        where: { id },
        data: {
          displayName: body.displayName.trim(),
          email: newEmail,
          ...(emailChanged ? { emailVerifiedAt: null } : {}),
        },
      });

      if (emailChanged) {
        try {
          await sendVerificationEmail("admin", id, newEmail, body.displayName.trim());
        } catch (mailErr) {
          console.error("[admin/profile] verification email failed:", mailErr);
        }
        if (current?.email) {
          sendSecurityAlertEmail(current.email, current.displayName, "email_changed").catch(() => {});
        }
        return NextResponse.json({ ok: true, emailChanged: true });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/profile PATCH]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
