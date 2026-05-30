import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email-verification";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, role, displayName } = session;
    let email: string | null = null;

    if (role === "owner") {
      const u = await prisma.platformOwner.findUnique({ where: { id }, select: { email: true } });
      email = u?.email ?? null;
    } else if (role === "admin") {
      const u = await prisma.adminIdentity.findUnique({ where: { id }, select: { email: true } });
      email = u?.email ?? null;
    } else if (role === "client") {
      const u = await prisma.clientIdentity.findUnique({ where: { id }, select: { email: true } });
      email = u?.email ?? null;
    } else if (role === "contributor") {
      const u = await prisma.contributor.findUnique({ where: { id }, select: { email: true } });
      email = u?.email ?? null;
    }

    if (!email) {
      return NextResponse.json({ error: "No email on file" }, { status: 400 });
    }

    await sendVerificationEmail(role, id, email, displayName);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[send-verification]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
