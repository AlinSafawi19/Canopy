import { NextRequest, NextResponse } from "next/server";
import { getSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validatePassword } from "@/lib/validation";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = await request.json();

    const contributor = await prisma.contributor.findFirst({
      where: { id, tenantId: session.tenantId! },
    });
    if (!contributor) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (body.action === "archive") {
      await prisma.contributor.update({ where: { id }, data: { archivedAt: new Date(), archivedBy: session.id } });
    } else if (body.action === "restore") {
      await prisma.contributor.update({ where: { id }, data: { archivedAt: null, archivedBy: null } });
    } else if (body.action === "reset-password" && body.newPassword) {
      const pwErr = validatePassword(body.newPassword);
      if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });
      const hashed = await hashPassword(body.newPassword);
      await prisma.contributor.update({ where: { id }, data: { password: hashed, updatedBy: session.id } });
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/contributors/:id PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const contributor = await prisma.contributor.findFirst({
    where: { id, tenantId: session.tenantId! },
  });
  if (!contributor) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.contributor.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
