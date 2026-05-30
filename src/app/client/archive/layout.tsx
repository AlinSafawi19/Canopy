import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TabShell } from "@/components/layout/tab-shell";

export default async function ClientArchiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const clientId = session!.id;

  const clientFilter = {
    project: {
      clientAssignment: { clientId, archivedAt: null },
    },
  };

  const [categoriesCount, entriesCount] = await Promise.all([
    prisma.contentCategory.count({
      where: { archivedAt: { not: null }, ...clientFilter },
    }),
    prisma.contentCategoryEntry.count({
      where: { archivedAt: { not: null }, category: clientFilter },
    }),
  ]);

  const navItems = [
    { label: "Categories", segment: "categories", icon: "Layers", count: categoriesCount },
    { label: "Entries", segment: "entries", icon: "FileText", count: entriesCount },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Archive</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          All archived items across your projects
        </p>
      </div>
      <TabShell basePath="/client/archive" navItems={navItems}>
        {children}
      </TabShell>
    </div>
  );
}
