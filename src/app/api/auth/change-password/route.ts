import { NextRequest, NextResponse } from "next/server";
import { getSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validatePassword } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { password } = await request.json();

    const pwErr = validatePassword(password);
    if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });

    const hashed = await hashPassword(password);
    const { id, role } = session;

    if (role === "owner") {
      await prisma.platformOwner.update({
        where: { id },
        data: { password: hashed, mustChangePassword: false, updatedBy: id },
      });
    } else if (role === "admin") {
      await prisma.adminIdentity.update({
        where: { id },
        data: { password: hashed, mustChangePassword: false, updatedBy: id },
      });
    } else if (role === "client") {
      await prisma.clientIdentity.update({
        where: { id },
        data: { password: hashed, mustChangePassword: false, updatedBy: id },
      });
    } else if (role === "contributor") {
      await prisma.contributor.update({
        where: { id },
        data: { password: hashed, mustChangePassword: false, updatedBy: id },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[change-password]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
