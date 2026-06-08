import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePermissions } from "@/lib/contributor-permissions";

const LOCK_DURATION_MS = 15 * 60 * 1000;

async function getAssignedEntry(entryId: string, catId: string, projectId: string, contributorId: string) {
  const assignment = await prisma.contributorAssignment.findFirst({
    where: { contributorId, projectId },
  });
  if (!assignment) return null;
  const permissions = parsePermissions(assignment.permissions as unknown);
  if (!permissions.canEditEntries) return null;

  return prisma.contentCategoryEntry.findFirst({
    where: { id: entryId, categoryId: catId, category: { projectId } },
    select: { id: true, lockedBy: true, lockedByName: true, lockedUntil: true },
  });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; catId: string; entryId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "contributor") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, catId, entryId } = await params;
  const entry = await getAssignedEntry(entryId, catId, projectId, session.id);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date();
  const isLockedByOther =
    entry.lockedBy &&
    entry.lockedBy !== session.id &&
    entry.lockedUntil &&
    entry.lockedUntil > now;

  if (isLockedByOther) {
    return NextResponse.json(
      { error: "locked", lockedByName: entry.lockedByName ?? "someone else" },
      { status: 409 }
    );
  }

  await prisma.contentCategoryEntry.update({
    where: { id: entryId },
    data: {
      lockedBy: session.id,
      lockedByName: session.displayName,
      lockedUntil: new Date(now.getTime() + LOCK_DURATION_MS),
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; catId: string; entryId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "contributor") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, catId, entryId } = await params;
  const entry = await getAssignedEntry(entryId, catId, projectId, session.id);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (entry.lockedBy === session.id) {
    await prisma.contentCategoryEntry.update({
      where: { id: entryId },
      data: { lockedBy: null, lockedByName: null, lockedUntil: null },
    });
  }

  return NextResponse.json({ ok: true });
}
