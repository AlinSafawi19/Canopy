import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
      return NextResponse.json({ requests: [], total: 0 });
    }

    const where = {
      resolvedAt: null,
      projectId: { in: projectIds },
      ...authorFilter,
    };

    const [total, requests] = await Promise.all([
      prisma.changeRequest.count({ where }),
      prisma.changeRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    if (requests.length === 0) {
      return NextResponse.json({ requests: [], total });
    }

    const uniqueProjectIds = [...new Set(requests.map((r) => r.projectId))];
    const uniqueCategoryIds = [...new Set(requests.map((r) => r.categoryId))];

    const [projects, categories] = await Promise.all([
      prisma.project.findMany({
        where: { id: { in: uniqueProjectIds } },
        select: { id: true, name: true },
      }),
      prisma.contentCategory.findMany({
        where: { id: { in: uniqueCategoryIds } },
        select: { id: true, name: true },
      }),
    ]);

    const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));
    const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

    return NextResponse.json({
      total,
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
