import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateId, slugify } from "@/lib/utils";
import { LIMITS, maxLen } from "@/lib/limits";
import { firstError } from "@/lib/validation";

async function getAssignedProject(projectId: string, clientId: string) {
  const assignment = await prisma.clientAssignment.findFirst({
    where: { projectId, clientId, archivedAt: null },
  });
  if (!assignment) return null;
  return prisma.project.findFirst({ where: { id: projectId, adminTenantId: assignment.tenantId } });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "client") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;
  const project = await getAssignedProject(projectId, session.id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { name, slug, description } = await request.json();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

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

  return NextResponse.json({ id: category.id }, { status: 201 });
}
