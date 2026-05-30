import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const tenantId = session.tenantId!;
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const unassigned = searchParams.get("unassigned") === "true";
  const skip = (page - 1) * limit;

  // If unassigned=true, get IDs of projects that already have a client assignment
  let excludeIds: string[] = [];
  if (unassigned) {
    const assigned = await prisma.clientAssignment.findMany({
      where: { tenantId },
      select: { projectId: true },
    });
    excludeIds = assigned.map((a) => a.projectId);
  }

  const where = {
    adminTenantId: tenantId,
    archivedAt: null,
    ...(unassigned ? { id: { notIn: excludeIds } } : {}),
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
