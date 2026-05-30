import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { nanoid } from "nanoid";
import { sendVerificationEmail } from "@/lib/email-verification";
import { validateUsername, validatePassword, validateEmail, validateDisplayName, firstError } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const { username, email, displayName, password } = await request.json();

    const err = firstError(
      validateDisplayName(displayName),
      validateUsername(username),
      validateEmail(email),
      validatePassword(password),
    );
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const [existingAdmin, existingOwner] = await Promise.all([
      prisma.adminIdentity.findUnique({ where: { username } }),
      prisma.platformOwner.findUnique({ where: { username } }),
    ]);

    if (existingAdmin || existingOwner) {
      return NextResponse.json({ error: "Username is already taken." }, { status: 409 });
    }

    const id = nanoid();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = displayName.trim();

    await prisma.adminIdentity.create({
      data: {
        id,
        username,
        email: normalizedEmail,
        displayName: normalizedName,
        password: await hashPassword(password),
        tenantId: nanoid(),
        updatedBy: "signup",
      },
    });

    try {
      await sendVerificationEmail("admin", id, normalizedEmail, normalizedName);
    } catch (mailErr) {
      console.error("[signup] failed to send verification email:", mailErr);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[signup]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
