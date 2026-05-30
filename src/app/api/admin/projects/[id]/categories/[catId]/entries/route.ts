import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateId } from "@/lib/utils";
import { validateEntryValues } from "@/lib/limits";
import { logActivity } from "@/lib/activity-log";

export async function POST(
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

    await logActivity({ session, action: "created", resource: "entry", resourceId: entry.id, adminTenantId: session.tenantId! });

    return NextResponse.json({ id: entry.id }, { status: 201 });
  } catch (err) {
    console.error("[admin/projects/:id/categories/:catId/entries POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
