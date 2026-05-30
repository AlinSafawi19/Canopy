import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "client") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const contributor = await prisma.contributor.findFirst({
    where: { id, parentClientUsername: session.username },
  });
  if (!contributor) {
    return NextResponse.json({ error: "Contributor not found" }, { status: 404 });
  }

  try {
    const { action } = await request.json();

    if (action === "archive") {
      await prisma.contributor.update({
        where: { id },
        data: { archivedAt: new Date(), archivedBy: session.id },
      });
      await logActivity({ session, action: "archived", resource: "contributor", resourceId: id, resourceName: contributor.displayName });
    } else if (action === "restore") {
      await prisma.contributor.update({
        where: { id },
        data: { archivedAt: null, archivedBy: null },
      });
      await logActivity({ session, action: "restored", resource: "contributor", resourceId: id, resourceName: contributor.displayName });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[client/contributors PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "client") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const contributor = await prisma.contributor.findFirst({
    where: { id, parentClientUsername: session.username },
  });
  if (!contributor) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.contributor.delete({ where: { id } });
  await logActivity({ session, action: "deleted", resource: "contributor", resourceId: id, resourceName: contributor.displayName });
  return NextResponse.json({ ok: true });
}
