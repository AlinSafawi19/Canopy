import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleExport } from "@/lib/entries-io";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; catId: string }> },
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

  return handleExport(request, category);
}
