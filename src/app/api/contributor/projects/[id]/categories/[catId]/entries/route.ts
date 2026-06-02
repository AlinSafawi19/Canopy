import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateId } from "@/lib/utils";
import { parsePermissions } from "@/lib/contributor-permissions";
import { validateEntryValues } from "@/lib/limits";
import { logActivity } from "@/lib/activity-log";

async function getAssignedCategory(catId: string, projectId: string, contributorId: string) {
  const assignment = await prisma.contributorAssignment.findFirst({
    where: { contributorId, projectId },
  });
  if (!assignment) return null;
  const category = await prisma.contentCategory.findFirst({ where: { id: catId, projectId } });
  return category ? { category, permissions: parsePermissions(assignment.permissions as unknown) } : null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; catId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "contributor") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId, catId } = await params;
  const result = await getAssignedCategory(catId, projectId, session.id);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!result.permissions.canCreateEntries) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { values, sortIndex } = await request.json();

  if (sortIndex !== undefined && (!Number.isInteger(sortIndex) || sortIndex < 0)) {
    return NextResponse.json({ error: "sortIndex must be a non-negative integer" }, { status: 400 });
  }

  const valErr = validateEntryValues(values, result.category.fields as Array<{ name: string; type: string }>);
  if (valErr) return NextResponse.json({ error: valErr }, { status: 400 });

  const lastEntry = await prisma.contentCategoryEntry.findFirst({
    where: { categoryId: catId },
    orderBy: { sortIndex: "desc" },
    select: { sortIndex: true },
  });

  const entry = await prisma.contentCategoryEntry.create({
    data: {
      id: generateId(),
      categoryId: catId,
      values: values ?? {},
      sortIndex: sortIndex ?? (lastEntry ? lastEntry.sortIndex + 1 : 0),
    },
  });

  const contributorRecord = await prisma.contributor.findUnique({
    where: { id: session.id },
    select: { parentClientUsername: true },
  });
  const parentClientUsername = contributorRecord?.parentClientUsername ?? undefined;
  await logActivity({ session, action: "created", resource: "entry", resourceId: entry.id, parentClientUsername });

  return NextResponse.json({ id: entry.id }, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; catId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "contributor") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: projectId, catId } = await params;

  const result = await getAssignedCategory(catId, projectId, session.id);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!result.permissions.canDeleteEntries) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { ids } = await request.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }

  const { count } = await prisma.contentCategoryEntry.deleteMany({
    where: { id: { in: ids }, categoryId: catId },
  });

  const contributorRecord = await prisma.contributor.findUnique({
    where: { id: session.id },
    select: { parentClientUsername: true },
  });
  const parentClientUsername = contributorRecord?.parentClientUsername ?? undefined;
  await logActivity({ session, action: "deleted", resource: "entry", resourceName: `${count} entries`, parentClientUsername });
  return NextResponse.json({ ok: true, deleted: count });
}
