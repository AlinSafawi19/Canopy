import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
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

  const requests = await prisma.changeRequest.findMany({
    where: { entryId, categoryId: catId, projectId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ requests });
}
