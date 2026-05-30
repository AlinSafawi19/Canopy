import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "client") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const excludeContributorId = searchParams.get("excludeContributorId") ?? "";
  const skip = (page - 1) * limit;

  // Get projects assigned to this client
  const clientAssignments = await prisma.clientAssignment.findMany({
    where: { clientId: session.id, archivedAt: null },
    select: { projectId: true },
  });
  let projectIds = clientAssignments.map((a) => a.projectId);

  // If excludeContributorId: exclude projects already assigned to that contributor
  if (excludeContributorId) {
    const contribAssignments = await prisma.contributorAssignment.findMany({
      where: { contributorId: excludeContributorId },
      select: { projectId: true },
    });
    const excludeSet = new Set(contribAssignments.map((a) => a.projectId));
    projectIds = projectIds.filter((id) => !excludeSet.has(id));
  }

  const where = {
    id: { in: projectIds },
    archivedAt: null,
    ...(search ? {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { slug: { contains: search, mode: "insensitive" as const } },
      ],
    } : {}),
  };

  const [total, projects] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: limit,
      select: { id: true, name: true, slug: true },
    }),
  ]);

  return NextResponse.json({
    items: projects.map((p) => ({
      id: p.id,
      label: p.name,
      sublabel: p.slug ?? undefined,
    })),
    total,
    hasMore: skip + projects.length < total,
  });
}
