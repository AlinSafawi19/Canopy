import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePermissions } from "@/lib/contributor-permissions";
import { validateEntryValues } from "@/lib/limits";
import { logActivity } from "@/lib/activity-log";

async function getAssignedEntry(entryId: string, catId: string, projectId: string, contributorId: string) {
  const assignment = await prisma.contributorAssignment.findFirst({
    where: { contributorId, projectId },
  });
  if (!assignment) return null;
  const entry = await prisma.contentCategoryEntry.findFirst({
    where: { id: entryId, categoryId: catId, category: { projectId } },
    include: { category: { select: { fields: true } } },
  });
  return entry ? { entry, permissions: parsePermissions(assignment.permissions as unknown) } : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; catId: string; entryId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "contributor") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId, catId, entryId } = await params;
  const result = await getAssignedEntry(entryId, catId, projectId, session.id);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!result.permissions.canEditEntries) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();

  const contributorRecord = await prisma.contributor.findUnique({
    where: { id: session.id },
    select: { parentClientUsername: true },
  });
  const parentClientUsername = contributorRecord?.parentClientUsername ?? undefined;

  if (body.action === "archive") {
    await prisma.contentCategoryEntry.update({ where: { id: entryId }, data: { archivedAt: new Date(), archivedBy: session.id } });
    await logActivity({ session, action: "archived", resource: "entry", resourceId: entryId, parentClientUsername });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "restore") {
    await prisma.contentCategoryEntry.update({
      where: { id: entryId },
      data: { archivedAt: null, archivedBy: null },
    });
    await logActivity({ session, action: "restored", resource: "entry", resourceId: entryId, parentClientUsername });
    return NextResponse.json({ ok: true });
  }
  if (body.values !== undefined) {
    const valErr = validateEntryValues(body.values, result.entry.category.fields as Array<{ name: string; type: string }>);
    if (valErr) return NextResponse.json({ error: valErr }, { status: 400 });
    await prisma.contentCategoryEntry.update({ where: { id: entryId }, data: { values: body.values } });
    await logActivity({ session, action: "updated", resource: "entry", resourceId: entryId, parentClientUsername });
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; catId: string; entryId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "contributor") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId, catId, entryId } = await params;
  const result = await getAssignedEntry(entryId, catId, projectId, session.id);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!result.permissions.canDeleteEntries) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const contributorRecordForDelete = await prisma.contributor.findUnique({
    where: { id: session.id },
    select: { parentClientUsername: true },
  });
  const parentClientUsernameForDelete = contributorRecordForDelete?.parentClientUsername ?? undefined;
  await prisma.contentCategoryEntry.delete({ where: { id: entryId } });
  await logActivity({ session, action: "deleted", resource: "entry", resourceId: entryId, parentClientUsername: parentClientUsernameForDelete });
  return NextResponse.json({ ok: true });
}
