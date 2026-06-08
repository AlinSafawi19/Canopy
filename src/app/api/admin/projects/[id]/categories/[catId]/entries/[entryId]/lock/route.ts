import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

async function getEntry(entryId: string, catId: string, projectId: string, tenantId: string) {
  return prisma.contentCategoryEntry.findFirst({
    where: { id: entryId, categoryId: catId, category: { projectId, project: { adminTenantId: tenantId } } },
    select: { id: true, lockedBy: true, lockedByName: true, lockedUntil: true },
  });
}

/** Acquire (or refresh) the edit lock. Returns 409 if locked by someone else. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; catId: string; entryId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, catId, entryId } = await params;
  const entry = await getEntry(entryId, catId, projectId, session.tenantId!);
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

/** Release the edit lock (only if held by the requester). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; catId: string; entryId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, catId, entryId } = await params;
  const entry = await getEntry(entryId, catId, projectId, session.tenantId!);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (entry.lockedBy === session.id) {
    await prisma.contentCategoryEntry.update({
      where: { id: entryId },
      data: { lockedBy: null, lockedByName: null, lockedUntil: null },
    });
  }

  return NextResponse.json({ ok: true });
}
