import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LIMITS, maxLen } from "@/lib/limits";
import { firstError } from "@/lib/validation";

async function getAssignedCategory(catId: string, projectId: string, clientId: string) {
  const assignment = await prisma.clientAssignment.findFirst({
    where: { projectId, clientId, archivedAt: null },
  });
  if (!assignment) return null;
  return prisma.contentCategory.findFirst({ where: { id: catId, projectId } });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; catId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "client") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId, catId } = await params;
  const category = await getAssignedCategory(catId, projectId, session.id);
  if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();

  if (body.action === "archive") {
    await prisma.contentCategory.update({
      where: { id: catId },
      data: { archivedAt: new Date(), archivedBy: session.id },
    });
  } else if (body.action === "restore") {
    await prisma.contentCategory.update({
      where: { id: catId },
      data: { archivedAt: null, archivedBy: null },
    });
  } else if (body.fields !== undefined) {
    await prisma.contentCategory.update({ where: { id: catId }, data: { fields: body.fields } });
  } else {
    const { name, slug, description } = body;
    const lenErr = firstError(
      maxLen(name, LIMITS.CATEGORY_NAME, "Category name"),
      maxLen(slug, LIMITS.CATEGORY_SLUG, "Slug"),
      maxLen(description, LIMITS.CATEGORY_DESCRIPTION, "Description"),
    );
    if (lenErr) return NextResponse.json({ error: lenErr }, { status: 400 });
    await prisma.contentCategory.update({
      where: { id: catId },
      data: {
        ...(name && { name }),
        ...(slug !== undefined && { slug }),
        ...(description !== undefined && { description }),
      },
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; catId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "client") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId, catId } = await params;
  const category = await getAssignedCategory(catId, projectId, session.id);
  if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.contentCategory.delete({ where: { id: catId } });
  return NextResponse.json({ ok: true });
}
