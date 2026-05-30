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
  const excludeProjectId = searchParams.get("excludeProjectId") ?? "";
  const skip = (page - 1) * limit;

  // If excludeProjectId: find contributor IDs already assigned to that project
  let excludeContributorIds: string[] = [];
  if (excludeProjectId) {
    const assigned = await prisma.contributorAssignment.findMany({
      where: { projectId: excludeProjectId },
      select: { contributorId: true },
    });
    excludeContributorIds = assigned.map((a) => a.contributorId);
  }

  const where = {
    parentClientUsername: session.username,
    archivedAt: null,
    ...(excludeContributorIds.length > 0 ? { id: { notIn: excludeContributorIds } } : {}),
    ...(search ? {
      OR: [
        { displayName: { contains: search, mode: "insensitive" as const } },
        { username: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
      ],
    } : {}),
  };

  const [total, contributors] = await Promise.all([
    prisma.contributor.count({ where }),
    prisma.contributor.findMany({
      where,
      orderBy: { displayName: "asc" },
      skip,
      take: limit,
      select: { id: true, displayName: true, username: true },
    }),
  ]);

  return NextResponse.json({
    items: contributors.map((c) => ({
      id: c.id,
      label: c.displayName,
      sublabel: `@${c.username}`,
    })),
    total,
    hasMore: skip + contributors.length < total,
  });
}
