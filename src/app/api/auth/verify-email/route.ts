import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { code } = await request.json();

    if (!code || typeof code !== "string" || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: "Enter a valid 6-digit code" }, { status: 400 });
    }

    const { id, role } = session;

    const challenge = await prisma.emailVerificationChallenge.findFirst({
      where: { targetId: id, targetKind: role },
    });

    if (!challenge) {
      return NextResponse.json(
        { error: "No pending verification found. Request a new code." },
        { status: 400 }
      );
    }

    if (challenge.expiresAt < new Date()) {
      await prisma.emailVerificationChallenge.delete({ where: { id: challenge.id } });
      return NextResponse.json(
        { error: "Code has expired. Request a new one." },
        { status: 400 }
      );
    }

    const valid = await bcrypt.compare(code, challenge.codeHash);
    if (!valid) {
      return NextResponse.json({ error: "Incorrect code. Please try again." }, { status: 400 });
    }

    const now = new Date();
    let mustChangePassword = false;
    if (role === "owner") {
      const u = await prisma.platformOwner.update({ where: { id }, data: { emailVerifiedAt: now } });
      mustChangePassword = !!u.mustChangePassword;
    } else if (role === "admin") {
      const u = await prisma.adminIdentity.update({ where: { id }, data: { emailVerifiedAt: now } });
      mustChangePassword = !!u.mustChangePassword;
    } else if (role === "client") {
      const u = await prisma.clientIdentity.update({ where: { id }, data: { emailVerifiedAt: now } });
      mustChangePassword = !!u.mustChangePassword;
    } else if (role === "contributor") {
      const u = await prisma.contributor.update({ where: { id }, data: { emailVerifiedAt: now } });
      mustChangePassword = !!u.mustChangePassword;
    }

    await prisma.emailVerificationChallenge.delete({ where: { id: challenge.id } });
    return NextResponse.json({ ok: true, mustChangePassword });
  } catch (err) {
    console.error("[verify-email]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
