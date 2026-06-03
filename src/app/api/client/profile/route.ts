import { NextRequest, NextResponse } from "next/server";
import { getSession, hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email-verification";
import { validatePassword, validateEmail, validateDisplayName } from "@/lib/validation";
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
      const pwErr = validatePassword(body.newPassword);
      if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });

      const client = await prisma.clientIdentity.findUnique({ where: { id } });
      if (!client) return NextResponse.json({ error: "Not found." }, { status: 404 });
      const valid = await verifyPassword(body.currentPassword, client.password);
      if (!valid) return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });

      await prisma.clientIdentity.update({ where: { id }, data: { password: await hashPassword(body.newPassword) } });
      sendSecurityAlertEmail(client.email, client.displayName, "password_changed").catch(() => {});
    } else {
      const nameErr = validateDisplayName(body.displayName);
      if (nameErr) return NextResponse.json({ error: nameErr }, { status: 400 });

      const emailErr = validateEmail(body.email);
      if (emailErr) return NextResponse.json({ error: emailErr }, { status: 400 });

      const current = await prisma.clientIdentity.findUnique({ where: { id }, select: { email: true, displayName: true } });
      const newEmail = body.email.trim().toLowerCase();
      const emailChanged = newEmail !== current?.email?.toLowerCase();

      await prisma.clientIdentity.update({
        where: { id },
        data: {
          displayName: body.displayName.trim(),
          email: newEmail,
          ...(emailChanged ? { emailVerifiedAt: null } : {}),
        },
      });

      if (emailChanged) {
        try {
          await sendVerificationEmail("client", id, newEmail, body.displayName.trim());
        } catch (mailErr) {
          console.error("[client/profile] verification email failed:", mailErr);
        }
        if (current?.email) {
          sendSecurityAlertEmail(current.email, current.displayName, "email_changed").catch(() => {});
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
