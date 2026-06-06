import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ApiIntegrationDocs } from "@/components/api-integration-docs";
import { ApiDocsToc } from "@/components/api-docs-toc";
import { ApiPlayground } from "@/components/ui/api-playground";

export default async function AdminApiIntegrationPage() {
  const session = await getSession();

  const rawProjects = await prisma.project.findMany({
    where: { adminTenantId: session!.tenantId!, archivedAt: null, slug: { not: null } },
    select: {
      id: true,
      name: true,
      slug: true,
      contentCategories: {
        where: { archivedAt: null, slug: { not: null } },
        orderBy: { name: "asc" },
        select: { name: true, slug: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const projects = rawProjects.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug as string,
    categories: p.contentCategories.map((c) => ({ name: c.name, slug: c.slug as string })),
  }));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900">API Integration</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          Live playground and documentation for your CMS content API
        </p>
      </div>

      <ApiPlayground projects={projects} />

      <div className="flex flex-col md:flex-row gap-6 md:gap-10 md:items-start">
        <div className="flex-1 min-w-0 order-2 md:order-1">
          <ApiIntegrationDocs />
        </div>
        <div className="w-full md:w-48 md:flex-shrink-0 order-1 md:order-2 md:sticky md:top-20 md:self-start">
          <ApiDocsToc />
        </div>
      </div>
    </div>
  );
}
