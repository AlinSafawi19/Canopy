import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateUserStillExists } from "@/lib/validate-user";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ContributorLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "contributor") redirect("/login");

  const contributorExists = await validateUserStillExists(session.id, "contributor");
  if (!contributorExists) redirect("/login");

  const [contributor, assignments] = await Promise.all([
    prisma.contributor.findUnique({
      where: { id: session.id },
      select: { walkthroughSeenAt: true, emailVerifiedAt: true, parentClientUsername: true, tenantId: true, lastSeenReleaseId: true },
    }),
    prisma.contributorAssignment.findMany({
      where: { contributorId: session.id },
      select: { projectId: true },
    }),
  ]);

  const projectIds = assignments.map((a) => a.projectId);
  const projectsCount = projectIds.length;

  const [clientContact, archivedEntriesCount, logsCount, latestRelease, pendingRequestsCount] = await Promise.all([
    contributor?.parentClientUsername
      ? prisma.clientIdentity.findFirst({ where: { username: contributor.parentClientUsername }, select: { email: true } })
      : Promise.resolve(null),
    projectIds.length > 0
      ? prisma.contentCategoryEntry.count({ where: { archivedAt: { not: null }, category: { projectId: { in: projectIds } } } })
      : Promise.resolve(0),
    prisma.activityLog.count({ where: { actorId: session.id } }),
    prisma.release.findFirst({ where: { status: "published" }, orderBy: { publishedAt: "desc" } }),
    projectIds.length > 0
      ? prisma.changeRequest.count({ where: { resolvedAt: null, projectId: { in: projectIds } } })
      : Promise.resolve(0),
  ]);

  const pendingRelease =
    latestRelease && latestRelease.id !== contributor?.lastSeenReleaseId ? latestRelease : null;

  return (
    <AppShell
      role="contributor"
      displayName={session.displayName}
      username={session.username}
      emailVerified={!!contributor?.emailVerifiedAt}
      navCounts={{ "/contributor/projects": projectsCount, "/contributor/archive": archivedEntriesCount, "/contributor/logs": logsCount }}
      contactEmail={clientContact?.email || undefined}
      walkthroughActive={!contributor?.walkthroughSeenAt}
      pendingRelease={pendingRelease}
      pendingRequestsCount={pendingRequestsCount}
    >
      {children}
    </AppShell>
  );
}
