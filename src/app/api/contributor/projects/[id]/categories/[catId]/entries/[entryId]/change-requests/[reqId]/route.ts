import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; catId: string; entryId: string; reqId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "contributor") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId, catId, entryId, reqId } = await params;

  const assignment = await prisma.contributorAssignment.findFirst({
    where: { contributorId: session.id, projectId },
  });
  if (!assignment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const entry = await prisma.contentCategoryEntry.findFirst({
    where: { id: entryId, categoryId: catId, category: { projectId } },
  });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const changeRequest = await prisma.changeRequest.findFirst({
    where: { id: reqId, entryId, categoryId: catId, projectId },
  });
  if (!changeRequest) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();

    if (body.action !== "resolve") {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    await prisma.changeRequest.update({
      where: { id: reqId },
      data: { resolvedAt: new Date(), resolvedBy: session.id, resolvedByName: session.displayName },
    });

    await logActivity({ session, action: "resolved_change_request", resource: "entry", resourceId: entryId });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[contributor/change-requests/:reqId PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
