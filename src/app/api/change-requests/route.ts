import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const LIMIT = 10;

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const skip = (page - 1) * LIMIT;

  try {
    let projectIds: string[] = [];
    let authorFilter: { authorId?: string } = {};

    if (session.role === "admin") {
      const projects = await prisma.project.findMany({
        where: { adminTenantId: session.tenantId!, archivedAt: null },
        select: { id: true },
      });
      projectIds = projects.map((p) => p.id);
    } else if (session.role === "contributor") {
      const assignments = await prisma.contributorAssignment.findMany({
        where: { contributorId: session.id },
        select: { projectId: true },
      });
      projectIds = assignments.map((a) => a.projectId);
    } else if (session.role === "client") {
      const assignments = await prisma.clientAssignment.findMany({
        where: { clientId: session.id, archivedAt: null },
        select: { projectId: true },
      });
      projectIds = assignments.map((a) => a.projectId);
      authorFilter = { authorId: session.id };
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (projectIds.length === 0) {
      return NextResponse.json({ requests: [], total: 0, hasMore: false });
    }

    const where = { resolvedAt: null, projectId: { in: projectIds }, ...authorFilter };

    const [total, requests] = await Promise.all([
      prisma.changeRequest.count({ where }),
      prisma.changeRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: LIMIT,
      }),
    ]);

    if (requests.length === 0) {
      return NextResponse.json({ requests: [], total, hasMore: false });
    }

    const uniqueProjectIds  = [...new Set(requests.map((r) => r.projectId))];
    const uniqueCategoryIds = [...new Set(requests.map((r) => r.categoryId))];

    const [projects, categories] = await Promise.all([
      prisma.project.findMany({ where: { id: { in: uniqueProjectIds } }, select: { id: true, name: true } }),
      prisma.contentCategory.findMany({ where: { id: { in: uniqueCategoryIds } }, select: { id: true, name: true } }),
    ]);

    const projectMap  = Object.fromEntries(projects.map((p) => [p.id, p.name]));
    const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

    return NextResponse.json({
      total,
      hasMore: skip + requests.length < total,
      requests: requests.map((r) => ({
        id: r.id,
        note: r.note,
        authorName: r.authorName,
        createdAt: r.createdAt,
        projectId: r.projectId,
        projectName: projectMap[r.projectId] ?? "Unknown",
        categoryId: r.categoryId,
        categoryName: categoryMap[r.categoryId] ?? "Unknown",
        entryId: r.entryId,
      })),
    });
  } catch (err) {
    console.error("[change-requests GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
