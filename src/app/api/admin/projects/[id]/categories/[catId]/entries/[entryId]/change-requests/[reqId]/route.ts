import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; catId: string; entryId: string; reqId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId, catId, entryId, reqId } = await params;

  const entry = await prisma.contentCategoryEntry.findFirst({
    where: { id: entryId, categoryId: catId, category: { projectId, project: { adminTenantId: session.tenantId! } } },
  });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const changeRequest = await prisma.changeRequest.findFirst({
    where: { id: reqId, entryId, categoryId: catId, projectId },
  });
  if (!changeRequest) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();

    if (body.action === "resolve") {
      await prisma.changeRequest.update({
        where: { id: reqId },
        data: {
          resolvedAt: new Date(),
          resolvedBy: session.id,
          resolvedByName: session.displayName,
          after: entry.values ?? undefined,
        },
      });
      await logActivity({ session, action: "resolved_change_request", resource: "entry", resourceId: entryId, adminTenantId: session.tenantId! });
    } else if (body.action === "reopen") {
      await prisma.changeRequest.update({
        where: { id: reqId },
        data: { resolvedAt: null, resolvedBy: null, resolvedByName: null },
      });
      await logActivity({ session, action: "reopened_change_request", resource: "entry", resourceId: entryId, adminTenantId: session.tenantId! });
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/change-requests/:reqId PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
