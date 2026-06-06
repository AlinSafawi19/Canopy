import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateUserStillExists } from "@/lib/validate-user";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "client") redirect("/login");

  const clientExists = await validateUserStillExists(session.id, "client");
  if (!clientExists) redirect("/login");

  const client = await prisma.clientIdentity.findUnique({
    where: { id: session.id },
    select: { walkthroughSeenAt: true, emailVerifiedAt: true, tenantId: true, lastSeenReleaseId: true },
  });

  const clientId = session.id;
  const assignedProjectFilter = { clientAssignment: { clientId, archivedAt: null } };

  const clientProjectIds = await prisma.clientAssignment.findMany({
    where: { clientId, archivedAt: null },
    select: { projectId: true },
  }).then((rows) => rows.map((r) => r.projectId));

  const [
    contributorsCount, adminContact,
    archivedCategoriesCount, archivedEntriesCount,
    logsCount, latestRelease, pendingRequestsCount,
  ] = await Promise.all([
    client?.tenantId
      ? prisma.contributor.count({ where: { tenantId: client.tenantId, parentClientUsername: session.username, archivedAt: null } })
      : Promise.resolve(0),
    client?.tenantId
      ? prisma.adminIdentity.findFirst({ where: { tenantId: client.tenantId }, select: { email: true } })
      : Promise.resolve(null),
    prisma.contentCategory.count({ where: { archivedAt: { not: null }, project: assignedProjectFilter } }),
    prisma.contentCategoryEntry.count({ where: { archivedAt: { not: null }, category: { project: assignedProjectFilter } } }),
    prisma.activityLog.count({
      where: { OR: [{ actorId: clientId }, { actorRole: "contributor", parentClientUsername: session.username }] },
    }),
    prisma.release.findFirst({ where: { status: "published" }, orderBy: { publishedAt: "desc" } }),
    clientProjectIds.length > 0
      ? prisma.changeRequest.count({ where: { authorId: clientId, resolvedAt: null, projectId: { in: clientProjectIds } } })
      : Promise.resolve(0),
  ]);

  const projectsCount = clientProjectIds.length;

  const archiveCount = archivedCategoriesCount + archivedEntriesCount;
  const pendingRelease =
    latestRelease && latestRelease.id !== client?.lastSeenReleaseId ? latestRelease : null;

  return (
    <AppShell
      role="client"
      displayName={session.displayName}
      username={session.username}
      emailVerified={!!client?.emailVerifiedAt}
      navCounts={{ "/client/projects": projectsCount, "/client/contributors": contributorsCount, "/client/archive": archiveCount, "/client/logs": logsCount }}
      contactEmail={adminContact?.email || undefined}
      walkthroughActive={!client?.walkthroughSeenAt}
      pendingRelease={pendingRelease}
      pendingRequestsCount={pendingRequestsCount}
    >
      {children}
    </AppShell>
  );
}
