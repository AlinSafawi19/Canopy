import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateId } from "@/lib/utils";
import { validateEntryValues } from "@/lib/limits";
import { logActivity } from "@/lib/activity-log";

async function getAssignedCategory(catId: string, projectId: string, clientId: string) {
  const assignment = await prisma.clientAssignment.findFirst({
    where: { projectId, clientId, archivedAt: null },
  });
  if (!assignment) return null;
  return prisma.contentCategory.findFirst({ where: { id: catId, projectId } });
}

export async function POST(
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

  const { values, sortIndex } = await request.json();

  if (sortIndex !== undefined && (!Number.isInteger(sortIndex) || sortIndex < 0)) {
    return NextResponse.json({ error: "sortIndex must be a non-negative integer" }, { status: 400 });
  }

  const valErr = validateEntryValues(values, category.fields as Array<{ name: string; type: string }>);
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

  await logActivity({ session, action: "created", resource: "entry", resourceId: entry.id });

  return NextResponse.json({ id: entry.id }, { status: 201 });
}

export async function DELETE(
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

  const { ids } = await request.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }

  const { count } = await prisma.contentCategoryEntry.deleteMany({
    where: { id: { in: ids }, categoryId: catId },
  });

  await logActivity({ session, action: "deleted", resource: "entry", resourceName: `${count} entries` });
  return NextResponse.json({ ok: true, deleted: count });
}
