import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateUserStillExists } from "@/lib/validate-user";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login");

  const adminExists = await validateUserStillExists(session.id, "admin");
  if (!adminExists) redirect("/login");

  const admin = await prisma.adminIdentity.findUnique({
    where: { id: session.id },
    select: { walkthroughSeenAt: true, emailVerifiedAt: true, tenantId: true, lastSeenReleaseId: true },
  });

  const tenantId = admin?.tenantId ?? "";

  // Fetch project IDs first so change-request count can be parallelised with the rest
  const adminProjects = await prisma.project.findMany({
    where: { adminTenantId: tenantId, archivedAt: null },
    select: { id: true },
  });
  const adminProjectIds = adminProjects.map((p) => p.id);

  const [
    clientsCount, owner,
    archivedProjectsCount, archivedCategoriesCount, archivedEntriesCount,
    logsCount, latestRelease, pendingRequestsCount,
  ] = await Promise.all([
    prisma.clientIdentity.count({ where: { tenantId, archivedAt: null } }),
    prisma.platformOwner.findFirst({ select: { email: true } }),
    prisma.project.count({ where: { adminTenantId: tenantId, archivedAt: { not: null } } }),
    prisma.contentCategory.count({ where: { archivedAt: { not: null }, project: { adminTenantId: tenantId } } }),
    prisma.contentCategoryEntry.count({ where: { archivedAt: { not: null }, category: { project: { adminTenantId: tenantId } } } }),
    prisma.activityLog.count({ where: { adminTenantId: tenantId, actorId: session.id } }),
    prisma.release.findFirst({ where: { status: "published" }, orderBy: { publishedAt: "desc" } }),
    adminProjectIds.length > 0
      ? prisma.changeRequest.count({ where: { resolvedAt: null, projectId: { in: adminProjectIds } } })
      : Promise.resolve(0),
  ]);

  const projectsCount = adminProjectIds.length;
  const archiveCount = archivedProjectsCount + archivedCategoriesCount + archivedEntriesCount;
  const pendingRelease =
    latestRelease && latestRelease.id !== admin?.lastSeenReleaseId ? latestRelease : null;

  return (
    <AppShell
      role="admin"
      displayName={session.displayName}
      username={session.username}
      emailVerified={!!admin?.emailVerifiedAt}
      navCounts={{ "/admin/projects": projectsCount, "/admin/clients": clientsCount, "/admin/archive": archiveCount, "/admin/logs": logsCount }}
      contactEmail={owner?.email || undefined}
      walkthroughActive={!admin?.walkthroughSeenAt}
      pendingRelease={pendingRelease}
      pendingRequestsCount={pendingRequestsCount}
    >
      {children}
    </AppShell>
  );
}
