import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePermissions } from "@/lib/contributor-permissions";
import { handleImport } from "@/lib/entries-io";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; catId: string }> },
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

  const permissions = parsePermissions(assignment.permissions as unknown);
  if (!permissions.canCreateEntries) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const category = await prisma.contentCategory.findFirst({
    where: { id: catId, projectId },
  });
  if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { rows, mode, columns } = await request.json();
  return handleImport(rows, category, mode, columns);
}
