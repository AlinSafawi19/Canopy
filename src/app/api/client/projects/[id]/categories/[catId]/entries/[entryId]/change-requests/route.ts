import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

async function getAssignedEntry(entryId: string, catId: string, projectId: string, clientId: string) {
  const assignment = await prisma.clientAssignment.findFirst({
    where: { projectId, clientId, archivedAt: null },
  });
  if (!assignment) return null;
  return prisma.contentCategoryEntry.findFirst({
    where: { id: entryId, categoryId: catId, category: { projectId } },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; catId: string; entryId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "client") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId, catId, entryId } = await params;
  const entry = await getAssignedEntry(entryId, catId, projectId, session.id);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const requests = await prisma.changeRequest.findMany({
    where: { entryId, categoryId: catId, projectId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ requests });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; catId: string; entryId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "client") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId, catId, entryId } = await params;
  const entry = await getAssignedEntry(entryId, catId, projectId, session.id);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();
    const note = typeof body.note === "string" ? body.note.trim() : "";

    if (!note) return NextResponse.json({ error: "Note is required" }, { status: 400 });
    if (note.length > 1000) return NextResponse.json({ error: "Note must be 1000 characters or less" }, { status: 400 });

    await prisma.changeRequest.create({
      data: {
        entryId,
        categoryId: catId,
        projectId,
        authorId: session.id,
        authorRole: "client",
        authorName: session.displayName,
        note,
      },
    });

    await logActivity({ session, action: "requested_change", resource: "entry", resourceId: entryId });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[client/change-requests POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
