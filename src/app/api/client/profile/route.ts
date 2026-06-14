import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email-verification";
import { validateEmail, validateDisplayName } from "@/lib/validation";
import { performPasswordChange } from "@/lib/password-change-helper";
import { sendSecurityAlertEmail } from "@/lib/security-alerts";

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "client") {
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

      const result = await performPasswordChange(id, "client", body.currentPassword, body.newPassword, ipAddress, userAgent);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
    } else {
      const nameErr = validateDisplayName(body.name);
      if (nameErr) return NextResponse.json({ error: nameErr }, { status: 400 });

      const emailErr = validateEmail(body.email);
      if (emailErr) return NextResponse.json({ error: emailErr }, { status: 400 });

      const current = await prisma.clientIdentity.findUnique({ where: { id }, select: { email: true, name: true } });
      const newEmail = body.email.trim().toLowerCase();
      const emailChanged = newEmail !== current?.email?.toLowerCase();

      await prisma.clientIdentity.update({
        where: { id },
        data: {
          name: body.name.trim(),
          email: newEmail,
          ...(emailChanged ? { emailVerifiedAt: null } : {}),
          ...(body.representativeName !== undefined ? { representativeName: body.representativeName?.trim() || null } : {}),
          ...(body.representativeDesignation !== undefined ? { representativeDesignation: body.representativeDesignation?.trim() || null } : {}),
        },
      });

      if (emailChanged) {
        try {
          await sendVerificationEmail("client", id, newEmail, body.name.trim());
        } catch (mailErr) {
          console.error("[client/profile] verification email failed:", mailErr);
        }
        if (current?.email) {
          sendSecurityAlertEmail(current.email, current.name, "email_changed").catch(() => {});
        }
        return NextResponse.json({ ok: true, emailChanged: true });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[client/profile PATCH]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
