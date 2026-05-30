import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, role } = session;
  const data = { mustShow2faReminder: false };

  if (role === "owner") {
    await prisma.platformOwner.update({ where: { id }, data });
  } else if (role === "admin") {
    await prisma.adminIdentity.update({ where: { id }, data });
  } else if (role === "client") {
    await prisma.clientIdentity.update({ where: { id }, data });
  } else if (role === "contributor") {
    await prisma.contributor.update({ where: { id }, data });
  }

  return NextResponse.json({ ok: true });
}
