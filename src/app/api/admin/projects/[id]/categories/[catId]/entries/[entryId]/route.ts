import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateEntryValues, sanitizeEntryValues } from "@/lib/limits";
import { logActivity } from "@/lib/activity-log";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; catId: string; entryId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: projectId, catId, entryId } = await params;

  const entry = await prisma.contentCategoryEntry.findFirst({
    where: { id: entryId, categoryId: catId, category: { projectId, project: { adminTenantId: session.tenantId! } } },
    include: { category: { select: { fields: true } } },
  });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();

    if (body.action === "archive") {
      await prisma.contentCategoryEntry.update({ where: { id: entryId }, data: { archivedAt: new Date(), archivedBy: session.id } });
      await logActivity({ session, action: "archived", resource: "entry", resourceId: entryId, adminTenantId: session.tenantId! });
    } else if (body.action === "restore") {
      await prisma.contentCategoryEntry.update({ where: { id: entryId }, data: { archivedAt: null, archivedBy: null } });
      await logActivity({ session, action: "restored", resource: "entry", resourceId: entryId, adminTenantId: session.tenantId! });
    } else if (body.action === "schedule") {
      const publishAt = body.publishAt ? new Date(body.publishAt) : null;
      const archiveAt = body.archiveAt ? new Date(body.archiveAt) : null;
      const now = new Date();
      if (publishAt && publishAt <= now) return NextResponse.json({ error: "Publish date must be in the future" }, { status: 422 });
      if (archiveAt && archiveAt <= now) return NextResponse.json({ error: "Archive date must be in the future" }, { status: 422 });

      await prisma.contentCategoryEntry.update({
        where: { id: entryId },
        data: { publishAt, archiveAt },
      });

      // Approval gate: immediately create a change-request so a reviewer must sign off
      if (body.requireApproval && publishAt) {
        const publishStr = publishAt.toLocaleString("en-US", {
          month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
        });
        await prisma.changeRequest.create({
          data: {
            entryId,
            categoryId: catId,
            projectId,
            authorId: session.id,
            authorRole: session.role,
            authorName: session.displayName,
            note: `[pre-publish] Scheduled to publish on ${publishStr}. Resolve this request to allow the cron job to publish it.`,
            before: entry.values ?? undefined,
          },
        });
      }

      await logActivity({ session, action: "scheduled", resource: "entry", resourceId: entryId, adminTenantId: session.tenantId! });
    } else if (body.values !== undefined) {
      const fields = entry.category.fields as Array<{ name: string; type: string }>;
      const valErr = validateEntryValues(body.values, fields);
      if (valErr) return NextResponse.json({ error: valErr }, { status: 400 });
      await prisma.contentCategoryEntry.update({ where: { id: entryId }, data: { values: sanitizeEntryValues(body.values, fields) } });
      await logActivity({ session, action: "updated", resource: "entry", resourceId: entryId, adminTenantId: session.tenantId! });
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/projects/:id/categories/:catId/entries/:entryId PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; catId: string; entryId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: projectId, catId, entryId } = await params;

  const entry = await prisma.contentCategoryEntry.findFirst({
    where: { id: entryId, categoryId: catId, category: { projectId, project: { adminTenantId: session.tenantId! } } },
  });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.contentCategoryEntry.delete({ where: { id: entryId } });
  await logActivity({ session, action: "deleted", resource: "entry", resourceId: entryId, adminTenantId: session.tenantId! });
  return NextResponse.json({ ok: true });
}
