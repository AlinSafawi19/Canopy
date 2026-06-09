import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEntryLabel } from "@/lib/utils";
import { parsePermissions } from "@/lib/contributor-permissions";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; catId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "contributor") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: projectId, catId } = await params;

  const assignment = await prisma.contributorAssignment.findFirst({
    where: { contributorId: session.id, projectId },
  });
  if (!assignment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const perms = parsePermissions(assignment.permissions as unknown);
  if (!perms.canEditEntries && !perms.canCreateEntries) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const category = await prisma.contentCategory.findFirst({
    where: { id: catId, projectId },
  });
  if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const limit = Math.min(200, Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") ?? "100", 10)));

  const entries = await prisma.contentCategoryEntry.findMany({
    where: { categoryId: catId, archivedAt: null },
    orderBy: { sortIndex: "asc" },
    take: limit,
    select: { id: true, values: true },
  });

  return NextResponse.json({
    items: entries.map((e) => ({
      id: e.id,
      label: getEntryLabel(e.values as Record<string, unknown>),
    })),
  });
}
