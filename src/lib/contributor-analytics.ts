import { prisma } from "@/lib/prisma";

export interface ContributorStat {
  id: string;
  name: string;
  username: string;
  totalRequests: number;
  resolvedRequests: number;
  pendingRequests: number;
  /** Resolved / total × 100, rounded */
  acceptanceRate: number;
  /** Average days from submission to resolution, null if no resolved requests */
  avgResolutionDays: number | null;
  lastActivityAt: Date | null;
  projects: { id: string; name: string }[];
}

export interface MonthBucket {
  month: string;
  submitted: number;
  resolved: number;
}

export interface ContributorAnalyticsReport {
  totalContributors: number;
  activeContributors: number;
  totalRequests: number;
  resolvedRequests: number;
  pendingRequests: number;
  overallAcceptanceRate: number;
  avgResolutionDays: number | null;
  contributors: ContributorStat[];
  requestsByMonth: MonthBucket[];
}

function buildEmptyMonths(): MonthBucket[] {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { month: d.toLocaleDateString("en-US", { month: "short", year: "numeric" }), submitted: 0, resolved: 0 };
  });
}

function emptyReport(totalContributors = 0): ContributorAnalyticsReport {
  return {
    totalContributors,
    activeContributors: 0,
    totalRequests: 0,
    resolvedRequests: 0,
    pendingRequests: 0,
    overallAcceptanceRate: 0,
    avgResolutionDays: null,
    contributors: [],
    requestsByMonth: buildEmptyMonths(),
  };
}

/**
 * Compute analytics scoped to a specific client's contributors.
 * clientTenantId + clientUsername identify which contributors belong to this client.
 */
export async function computeContributorAnalytics(
  clientTenantId: string,
  clientUsername: string
): Promise<ContributorAnalyticsReport> {
  const myContributors = await prisma.contributor.findMany({
    where: { tenantId: clientTenantId, parentClientUsername: clientUsername },
    select: { id: true, username: true, displayName: true },
  });

  if (myContributors.length === 0) return emptyReport(0);

  const contributorIds = myContributors.map((c) => c.id);
  const requests = await prisma.changeRequest.findMany({
    where: { authorId: { in: contributorIds }, authorRole: "contributor" },
    select: {
      authorId: true,
      authorName: true,
      projectId: true,
      createdAt: true,
      resolvedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Collect project names for projects referenced in requests
  const projectIds = [...new Set(requests.map((r) => r.projectId))];
  const projects = projectIds.length > 0
    ? await prisma.project.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, name: true },
      })
    : [];
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));

  // Group requests by authorId
  const grouped = new Map<string, typeof requests>();
  for (const req of requests) {
    const bucket = grouped.get(req.authorId) ?? [];
    bucket.push(req);
    grouped.set(req.authorId, bucket);
  }

  const stats: ContributorStat[] = [];

  // Also include contributors with zero requests so clients can see all
  for (const c of myContributors) {
    const reqs = grouped.get(c.id) ?? [];
    const resolved = reqs.filter((r) => r.resolvedAt !== null);
    const pending  = reqs.filter((r) => r.resolvedAt === null);

    let avgResolutionDays: number | null = null;
    if (resolved.length > 0) {
      const totalMs = resolved.reduce(
        (sum, r) => sum + (r.resolvedAt!.getTime() - r.createdAt.getTime()),
        0
      );
      avgResolutionDays =
        Math.round((totalMs / resolved.length / (1000 * 60 * 60 * 24)) * 10) / 10;
    }

    const projectSet = new Map<string, string>();
    for (const r of reqs) {
      const name = projectMap.get(r.projectId);
      if (name) projectSet.set(r.projectId, name);
    }

    stats.push({
      id: c.id,
      name: c.displayName ?? reqs[0]?.authorName ?? "Unknown",
      username: c.username,
      totalRequests: reqs.length,
      resolvedRequests: resolved.length,
      pendingRequests: pending.length,
      acceptanceRate:
        reqs.length > 0 ? Math.round((resolved.length / reqs.length) * 100) : 0,
      avgResolutionDays,
      lastActivityAt: reqs[0]?.createdAt ?? null,
      projects: [...projectSet.entries()].map(([id, name]) => ({ id, name })),
    });
  }

  stats.sort((a, b) => b.totalRequests - a.totalRequests);

  if (requests.length === 0) return emptyReport(myContributors.length);

  const totalRequests  = requests.length;
  const resolvedTotal  = requests.filter((r) => r.resolvedAt !== null).length;
  const pendingTotal   = requests.filter((r) => r.resolvedAt === null).length;

  let overallAvgDays: number | null = null;
  const resolvedReqs = requests.filter((r) => r.resolvedAt !== null);
  if (resolvedReqs.length > 0) {
    const totalMs = resolvedReqs.reduce(
      (sum, r) => sum + (r.resolvedAt!.getTime() - r.createdAt.getTime()),
      0
    );
    overallAvgDays =
      Math.round((totalMs / resolvedReqs.length / (1000 * 60 * 60 * 24)) * 10) / 10;
  }

  const now = new Date();
  const requestsByMonth: MonthBucket[] = Array.from({ length: 6 }, (_, i) => {
    const d     = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });

    const submitted = requests.filter((r) => r.createdAt >= d && r.createdAt <= end).length;
    const resolved  = requests.filter(
      (r) => r.resolvedAt !== null && r.resolvedAt >= d && r.resolvedAt <= end
    ).length;

    return { month: label, submitted, resolved };
  });

  return {
    totalContributors: myContributors.length,
    activeContributors: stats.filter((s) => s.totalRequests > 0).length,
    totalRequests,
    resolvedRequests: resolvedTotal,
    pendingRequests: pendingTotal,
    overallAcceptanceRate:
      totalRequests > 0 ? Math.round((resolvedTotal / totalRequests) * 100) : 0,
    avgResolutionDays: overallAvgDays,
    contributors: stats,
    requestsByMonth,
  };
}
