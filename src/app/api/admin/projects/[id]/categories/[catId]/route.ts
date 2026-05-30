import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LIMITS, maxLen } from "@/lib/limits";
import { firstError } from "@/lib/validation";
import { logActivity } from "@/lib/activity-log";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; catId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: projectId, catId } = await params;

  const category = await prisma.contentCategory.findFirst({
    where: { id: catId, projectId, project: { adminTenantId: session.tenantId! } },
  });
  if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();

    if (body.action === "archive") {
      await prisma.contentCategory.update({
        where: { id: catId },
        data: { archivedAt: new Date(), archivedBy: session.id },
      });
      await logActivity({ session, action: "archived", resource: "category", resourceId: catId, resourceName: category.name, adminTenantId: session.tenantId! });
    } else if (body.action === "restore") {
      await prisma.contentCategory.update({
        where: { id: catId },
        data: { archivedAt: null, archivedBy: null },
      });
      await logActivity({ session, action: "restored", resource: "category", resourceId: catId, resourceName: category.name, adminTenantId: session.tenantId! });
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
      await logActivity({ session, action: "updated", resource: "category", resourceId: catId, resourceName: name ?? category.name, adminTenantId: session.tenantId! });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/projects/:id/categories/:catId PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; catId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: projectId, catId } = await params;

  const category = await prisma.contentCategory.findFirst({
    where: { id: catId, projectId, project: { adminTenantId: session.tenantId! } },
  });
  if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.contentCategory.delete({ where: { id: catId } });
  await logActivity({ session, action: "deleted", resource: "category", resourceId: catId, resourceName: category.name, adminTenantId: session.tenantId! });
  return NextResponse.json({ ok: true });
}
