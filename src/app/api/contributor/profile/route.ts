import { NextRequest, NextResponse } from "next/server";
import { getSession, hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email-verification";
import { validatePassword, validateEmail, validateDisplayName } from "@/lib/validation";

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "contributor") {
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

      const contributor = await prisma.contributor.findUnique({ where: { id } });
      if (!contributor) return NextResponse.json({ error: "Not found." }, { status: 404 });
      const valid = await verifyPassword(body.currentPassword, contributor.password);
      if (!valid) return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });

      await prisma.contributor.update({ where: { id }, data: { password: await hashPassword(body.newPassword) } });
    } else {
      const nameErr = validateDisplayName(body.displayName);
      if (nameErr) return NextResponse.json({ error: nameErr }, { status: 400 });

      const emailErr = validateEmail(body.email);
      if (emailErr) return NextResponse.json({ error: emailErr }, { status: 400 });

      const current = await prisma.contributor.findUnique({ where: { id }, select: { email: true, displayName: true } });
      const newEmail = body.email.trim().toLowerCase();
      const emailChanged = newEmail !== current?.email?.toLowerCase();

      await prisma.contributor.update({
        where: { id },
        data: {
          displayName: body.displayName.trim(),
          email: newEmail,
          ...(emailChanged ? { emailVerifiedAt: null } : {}),
        },
      });

      if (emailChanged) {
        try {
          await sendVerificationEmail("contributor", id, newEmail, body.displayName.trim());
        } catch (mailErr) {
          console.error("[contributor/profile] verification email failed:", mailErr);
        }
        return NextResponse.json({ ok: true, emailChanged: true });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[contributor/profile PATCH]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
