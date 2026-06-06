import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const LIMIT = 15;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; catId: string; entryId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "contributor") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId, catId, entryId } = await params;

  const assignment = await prisma.contributorAssignment.findFirst({
    where: { contributorId: session.id, projectId },
  });
  if (!assignment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const entry = await prisma.contentCategoryEntry.findFirst({
    where: { id: entryId, categoryId: catId, category: { projectId } },
  });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sp     = request.nextUrl.searchParams;
  const status = sp.get("status");
  const page   = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const skip   = (page - 1) * LIMIT;

  const where = {
    entryId,
    categoryId: catId,
    projectId,
    ...(status === "open"     ? { resolvedAt: null }          : {}),
    ...(status === "resolved" ? { resolvedAt: { not: null } } : {}),
  };

  const [total, requests] = await Promise.all([
    prisma.changeRequest.count({ where }),
    prisma.changeRequest.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: LIMIT }),
  ]);

  return NextResponse.json({ requests, total, hasMore: skip + requests.length < total });
}
