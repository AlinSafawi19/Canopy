import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Globe, GitBranch, ExternalLink, Server, Tag, Users, Key } from "lucide-react";
import { AssignContributorsButton } from "./assign-contributors-button";
import { parsePermissions } from "@/lib/contributor-permissions";
import { ApiKeysSection } from "@/app/admin/projects/[id]/api-keys-section";
import { CreateApiKeyButton } from "@/app/admin/projects/[id]/create-api-key-button";
import { CreateCategoryButton } from "@/app/admin/projects/[id]/create-category-button";
import { CategoryActions } from "@/app/admin/projects/[id]/category-actions";
import { SearchInput } from "@/components/ui/search-input";
import { SortableHeader } from "@/components/ui/sortable-header";
import { Pagination } from "@/components/ui/pagination";
import { parsePage, parseLimit, parseSearch } from "@/lib/pagination";

const BASE = "/client/projects";
const CAT_SORTS = ["name"] as const;
const KEY_SORTS = ["name", "createdAt", "lastUsedAt"] as const;
type CatSort = typeof CAT_SORTS[number];
type KeySort = typeof KEY_SORTS[number];

export default async function ClientProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    catSearch?: string; catPage?: string; catLimit?: string; catSort?: string; catDir?: string;
    keySearch?: string; keyPage?: string; keyLimit?: string; keySort?: string; keyDir?: string;
  }>;
}) {
  const { id } = await params;
  const session = await getSession();

  const assignment = await prisma.clientAssignment.findFirst({
    where: { clientId: session!.id, projectId: id, archivedAt: null },
  });
  if (!assignment) notFound();

  const {
    catSearch: rcs, catPage: rcp, catLimit: rcl, catSort: rcso, catDir: rcd,
    keySearch: rks, keyPage: rkp, keyLimit: rkl, keySort: rkso, keyDir: rkd,
  } = await searchParams;

  const catSearch = parseSearch(rcs);
  const catPage = parsePage(rcp);
  const catLimit = parseLimit(rcl);
  const catSort: CatSort = CAT_SORTS.includes(rcso as CatSort) ? (rcso as CatSort) : "name";
  const catDir = (rcd === "desc" ? "desc" : "asc") as "asc" | "desc";
  const catSkip = (catPage - 1) * catLimit;

  const keySearch = parseSearch(rks);
  const keyPage = parsePage(rkp);
  const keyLimit = parseLimit(rkl);
  const keySort: KeySort = KEY_SORTS.includes(rkso as KeySort) ? (rkso as KeySort) : "createdAt";
  const keyDir = (rkd === "asc" ? "asc" : "desc") as "asc" | "desc";
  const keySkip = (keyPage - 1) * keyLimit;

  const basePath = `${BASE}/${id}`;

  const catExtraParams: Record<string, string> = {
    ...(catSearch ? { catSearch } : {}),
    catLimit: String(catLimit),
    catSort,
    catDir,
    ...(keySearch ? { keySearch } : {}),
    keyLimit: String(keyLimit),
    keySort,
    keyDir,
    keyPage: String(keyPage),
  };
  const keyExtraParams: Record<string, string> = {
    ...(keySearch ? { keySearch } : {}),
    keyLimit: String(keyLimit),
    keySort,
    keyDir,
    ...(catSearch ? { catSearch } : {}),
    catLimit: String(catLimit),
    catSort,
    catDir,
    catPage: String(catPage),
  };

  const catWhere = {
    projectId: id,
    archivedAt: null,
    ...(catSearch ? {
      OR: [
        { name: { contains: catSearch, mode: "insensitive" as const } },
        { slug: { contains: catSearch, mode: "insensitive" as const } },
      ],
    } : {}),
  };

  const keyWhere = {
    projectId: id,
    ...(keySearch ? { name: { contains: keySearch, mode: "insensitive" as const } } : {}),
  };

  const [project, contributorAssignments, catTotal, categories, keyTotal, apiKeys] = await Promise.all([
    prisma.project.findFirst({ where: { id } }),
    prisma.contributorAssignment.findMany({
      where: { projectId: id },
      include: { contributor: { select: { id: true, displayName: true, email: true, username: true } } },
    }),
    prisma.contentCategory.count({ where: catWhere }),
    prisma.contentCategory.findMany({
      where: catWhere,
      orderBy: { [catSort]: catDir },
      skip: catSkip,
      take: catLimit,
      include: { _count: { select: { entries: { where: { archivedAt: null } } } } },
    }),
    prisma.apiKey.count({ where: keyWhere }),
    prisma.apiKey.findMany({
      where: keyWhere,
      orderBy: { [keySort]: keyDir },
      skip: keySkip,
      take: keyLimit,
      select: { id: true, name: true, keyPrefix: true, createdAt: true, lastUsedAt: true },
    }),
  ]);
  if (!project) notFound();

  const assignedContributors = contributorAssignments.map((a) => ({
    ...a.contributor,
    permissions: parsePermissions(a.permissions as unknown),
  }));

  const statusVariant: Record<string, "success" | "warning" | "danger"> = {
    live: "success",
    in_progress: "warning",
    archived: "danger",
  };

  const techStack = Array.isArray(project.techStack) ? (project.techStack as string[]) : [];
  const highlights = Array.isArray(project.highlights) ? project.highlights : [];
  const hasMedia = project.imageBg || project.videoBg || project.coverImageAlt;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/client/projects">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft size={14} />
            Projects
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold text-slate-900">{project.name}</h2>
            <Badge variant={statusVariant[project.status] ?? "default"}>{project.status}</Badge>
            {project.featured && <Badge variant="info">Featured</Badge>}
            {project.archivedAt && <Badge variant="danger">Archived</Badge>}
          </div>
          {project.shortDescription && (
            <p className="text-slate-500 text-sm mt-0.5">{project.shortDescription}</p>
          )}
        </div>
      </div>

      {/* Assigned Contributors */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users size={16} className="text-slate-400" />
            <CardTitle>Assigned Contributors</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <AssignContributorsButton projectId={project.id} assignedContributors={assignedContributors} />
        </CardContent>
      </Card>

      {/* Public API */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key size={16} className="text-slate-400" />
            <CardTitle>Public API</CardTitle>
          </div>
          <div className="flex items-center justify-between gap-2 w-full sm:w-auto">
            <SearchInput
              value={keySearch}
              placeholder="Search keys…"
              basePath={basePath}
              extraParams={keyExtraParams}
              searchParam="keySearch"
              pageParam="keyPage"
            />
            <CreateApiKeyButton projectId={project.id} basePath="/api/client/projects" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ApiKeysSection
            projectId={project.id}
            projectSlug={project.slug}
            basePath="/api/client/projects"
            initialKeys={apiKeys.map((k) => ({
              ...k,
              createdAt: k.createdAt.toISOString(),
              lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
            }))}
          />
          {keySearch && keyTotal === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">No keys found for &quot;{keySearch}&quot;</p>
          )}
          {keyTotal > 0 && (
            <div className="px-4 border-t border-slate-100">
              <Pagination
                total={keyTotal}
                page={keyPage}
                limit={keyLimit}
                basePath={basePath}
                extraParams={keyExtraParams}
                pageParam="keyPage"
                limitParam="keyLimit"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Media */}
      {hasMedia && (
        <Card>
          <CardHeader><CardTitle>Media</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {project.imageBg && (
              <div>
                <p className="text-xs text-slate-500 mb-2">Image Background</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={project.imageBg} alt={project.coverImageAlt ?? "Project background"} className="w-full max-h-56 object-cover rounded-lg border border-slate-200" />
                {project.coverImageAlt && <p className="text-xs text-slate-400 mt-1.5 italic">{project.coverImageAlt}</p>}
              </div>
            )}
            {project.videoBg && (
              <div>
                <p className="text-xs text-slate-500 mb-2">Video Background</p>
                <video src={project.videoBg} controls muted className="w-full max-h-56 rounded-lg border border-slate-200 bg-slate-900" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Details meta */}
      {(project.slug || project.industry || project.role || project.teamSize) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {project.slug && <Card><CardContent className="py-4"><p className="text-xs text-slate-500 mb-1">Slug</p><p className="text-sm font-medium text-slate-800 truncate">{project.slug}</p></CardContent></Card>}
          {project.industry && <Card><CardContent className="py-4"><p className="text-xs text-slate-500 mb-1">Industry</p><p className="text-sm font-medium text-slate-800">{project.industry}</p></CardContent></Card>}
          {project.role && <Card><CardContent className="py-4"><p className="text-xs text-slate-500 mb-1">Role</p><p className="text-sm font-medium text-slate-800">{project.role}</p></CardContent></Card>}
          {project.teamSize && <Card><CardContent className="py-4"><p className="text-xs text-slate-500 mb-1">Team Size</p><p className="text-sm font-medium text-slate-800">{project.teamSize}</p></CardContent></Card>}
        </div>
      )}

      {/* Links meta */}
      {(project.domain || project.host || project.liveUrl || project.githubUrl) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {project.domain && <Card><CardContent className="py-4"><p className="text-xs text-slate-500 mb-1">Domain</p><div className="flex items-center gap-1.5 text-sm font-medium text-slate-800"><Globe size={14} className="text-slate-400 flex-shrink-0" /><span className="truncate">{project.domain}</span></div></CardContent></Card>}
          {project.host && <Card><CardContent className="py-4"><p className="text-xs text-slate-500 mb-1">Host</p><div className="flex items-center gap-1.5 text-sm font-medium text-slate-800"><Server size={14} className="text-slate-400 flex-shrink-0" /><span className="truncate">{project.host}</span></div></CardContent></Card>}
          {project.liveUrl && <Card><CardContent className="py-4"><p className="text-xs text-slate-500 mb-1">Live URL</p><div className="flex items-center gap-1.5 text-sm font-medium text-slate-800"><ExternalLink size={14} className="text-slate-400 flex-shrink-0" /><span className="truncate">{project.liveUrl}</span></div></CardContent></Card>}
          {project.githubUrl && <Card><CardContent className="py-4"><p className="text-xs text-slate-500 mb-1">GitHub</p><div className="flex items-center gap-1.5 text-sm font-medium text-slate-800"><GitBranch size={14} className="text-slate-400 flex-shrink-0" /><span className="truncate">{project.githubUrl}</span></div></CardContent></Card>}
        </div>
      )}

      {/* Description */}
      {project.description && (
        <Card>
          <CardHeader><CardTitle>Description</CardTitle></CardHeader>
          <CardContent><p className="text-slate-700 text-sm leading-relaxed">{project.description}</p></CardContent>
        </Card>
      )}

      {/* Tech Stack */}
      {techStack.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Tag size={16} className="text-slate-400" />
              <CardTitle>Tech Stack</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {techStack.map((tech) => <Badge key={tech} variant="default">{tech}</Badge>)}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Highlights */}
      {highlights.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Highlights</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                  {h}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Content Categories */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 w-full flex-wrap">
            <CardTitle>Content Categories ({catTotal})</CardTitle>
            <div className="flex items-center justify-between gap-2 w-full sm:w-auto">
              <SearchInput
                value={catSearch}
                placeholder="Search categories…"
                basePath={basePath}
                extraParams={catExtraParams}
                searchParam="catSearch"
                pageParam="catPage"
              />
              <CreateCategoryButton projectId={id} basePath="/api/client/projects" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortableHeader label="Name" field="name" sortBy={catSort} sortDir={catDir} basePath={basePath} extraParams={catExtraParams} sortByParam="catSort" sortDirParam="catDir" pageParam="catPage" />
                </TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Entries</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.length === 0 && (
                <TableRow>
                  <TableCell className="text-slate-400 text-center" colSpan={4}>
                    {catSearch ? `No categories found for "${catSearch}"` : "No categories yet"}
                  </TableCell>
                </TableRow>
              )}
              {categories.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell className="font-medium text-slate-900">
                    <Link href={`${basePath}/categories/${cat.id}`} className="hover:text-indigo-600 transition-colors">
                      <p>{cat.name}</p>
                      {cat.description && <p className="text-xs text-slate-400 mt-0.5">{cat.description}</p>}
                    </Link>
                  </TableCell>
                  <TableCell className="text-slate-500">{cat.slug || "—"}</TableCell>
                  <TableCell className="text-slate-700">{cat._count.entries}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Link href={`${basePath}/categories/${cat.id}`}>
                        <Button variant="outline" size="sm">Manage</Button>
                      </Link>
                      <CategoryActions category={cat} projectId={id} basePath="/api/client/projects" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {catTotal > 0 && (
            <div className="px-4 border-t border-slate-100">
              <Pagination
                total={catTotal}
                page={catPage}
                limit={catLimit}
                basePath={basePath}
                extraParams={catExtraParams}
                pageParam="catPage"
                limitParam="catLimit"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
