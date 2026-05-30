import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateId, slugify } from "@/lib/utils";
import { LIMITS, maxLen } from "@/lib/limits";
import { firstError } from "@/lib/validation";
import { logActivity } from "@/lib/activity-log";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id: projectId } = await params;

  const project = await prisma.project.findFirst({
    where: { id: projectId, adminTenantId: session.tenantId! },
  });
  if (!project) return NextResponse.json({ error: "Not found." }, { status: 404 });

  try {
    const { name, slug, description } = await request.json();

    if (!name?.trim()) return NextResponse.json({ error: "Category name is required." }, { status: 400 });

    const lenErr = firstError(
      maxLen(name, LIMITS.CATEGORY_NAME, "Category name"),
      maxLen(slug, LIMITS.CATEGORY_SLUG, "Slug"),
      maxLen(description, LIMITS.CATEGORY_DESCRIPTION, "Description"),
    );
    if (lenErr) return NextResponse.json({ error: lenErr }, { status: 400 });

    const category = await prisma.contentCategory.create({
      data: {
        id: generateId(),
        projectId,
        name,
        slug: slug || slugify(name),
        description: description || null,
        fields: [],
      },
    });

    await logActivity({ session, action: "created", resource: "category", resourceId: category.id, resourceName: category.name, adminTenantId: session.tenantId! });

    return NextResponse.json({ id: category.id }, { status: 201 });
  } catch (err) {
    console.error("[admin/projects/:id/categories POST]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
