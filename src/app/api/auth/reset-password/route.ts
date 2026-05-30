import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { validatePassword } from "@/lib/validation";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const { email, code, password } = await request.json();

    if (!email || !code) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: "Invalid code format." }, { status: 400 });
    }

    const pwErr = validatePassword(password);
    if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });

    const normalizedEmail = email.trim().toLowerCase();

    let targetKind: string | null = null;
    let targetId: string | null = null;

    const owner = await prisma.platformOwner.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    });
    if (owner) { targetKind = "owner"; targetId = owner.id; }

    if (!targetKind) {
      const admin = await prisma.adminIdentity.findFirst({
        where: { email: { equals: normalizedEmail, mode: "insensitive" }, archivedAt: null },
      });
      if (admin) { targetKind = "admin"; targetId = admin.id; }
    }

    if (!targetKind) {
      const client = await prisma.clientIdentity.findFirst({
        where: { email: { equals: normalizedEmail, mode: "insensitive" }, archivedAt: null },
      });
      if (client) { targetKind = "client"; targetId = client.id; }
    }

    if (!targetKind) {
      const contributor = await prisma.contributor.findFirst({
        where: { email: { equals: normalizedEmail, mode: "insensitive" }, archivedAt: null },
      });
      if (contributor) { targetKind = "contributor"; targetId = contributor.id; }
    }

    if (!targetKind || !targetId) {
      return NextResponse.json({ error: "Invalid or expired code." }, { status: 400 });
    }

    const challenge = await prisma.passwordResetChallenge.findFirst({
      where: { targetId, targetKind },
    });

    if (!challenge || challenge.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invalid or expired code." }, { status: 400 });
    }

    const valid = await bcrypt.compare(code, challenge.codeHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid or expired code." }, { status: 400 });
    }

    const newHash = await hashPassword(password);

    if (targetKind === "owner") {
      await prisma.platformOwner.update({ where: { id: targetId }, data: { password: newHash } });
    } else if (targetKind === "admin") {
      await prisma.adminIdentity.update({ where: { id: targetId }, data: { password: newHash } });
    } else if (targetKind === "client") {
      await prisma.clientIdentity.update({ where: { id: targetId }, data: { password: newHash } });
    } else {
      await prisma.contributor.update({ where: { id: targetId }, data: { password: newHash } });
    }

    await prisma.passwordResetChallenge.delete({ where: { id: challenge.id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[reset-password]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
