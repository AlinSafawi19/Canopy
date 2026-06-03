import { prisma } from "@/lib/prisma";
import { TabShell } from "@/components/layout/tab-shell";

export default async function OwnerArchiveLayout({ children }: { children: React.ReactNode }) {
  const [adminsCount, releasesCount] = await Promise.all([
    prisma.adminIdentity.count({ where: { archivedAt: { not: null } } }),
    prisma.release.count({ where: { status: "archived" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Archive</h2>
        <p className="text-slate-500 text-sm mt-0.5">Archived admins and releases</p>
      </div>
      <TabShell
        basePath="/owner/archive"
        navItems={[
          { label: "Admins",   segment: "admins",   icon: "UserCog",   count: adminsCount   },
          { label: "Releases", segment: "releases",  icon: "Megaphone", count: releasesCount },
        ]}
      >
        {children}
      </TabShell>
    </div>
  );
}
