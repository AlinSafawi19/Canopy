import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchInput } from "@/components/ui/search-input";
import { Pagination } from "@/components/ui/pagination";
import { RestoreReleaseButton } from "./restore-release-button";
import { formatDate } from "@/lib/utils";
import { parsePage, parseLimit, parseSearch } from "@/lib/pagination";

const PATH = "/owner/archive/releases";

export default async function OwnerArchiveReleasesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; limit?: string }>;
}) {
  const { search: rs, page: rp, limit: rl } = await searchParams;
  const search = parseSearch(rs);
  const page = parsePage(rp);
  const limit = parseLimit(rl);
  const skip = (page - 1) * limit;

  const where = {
    status: "archived",
    ...(search ? {
      OR: [
        { version: { contains: search, mode: "insensitive" as const } },
        { title:   { contains: search, mode: "insensitive" as const } },
      ],
    } : {}),
  };

  const [total, releases] = await Promise.all([
    prisma.release.count({ where }),
    prisma.release.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
      select: { id: true, version: true, title: true, updatedAt: true },
    }),
  ]);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>{total} archived {total === 1 ? "release" : "releases"}</CardTitle>
        <SearchInput value={search} placeholder="Search releases…" basePath={PATH} extraParams={{ limit: String(limit) }} />
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Version</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Archived On</TableHead>
              <TableHead className="sticky right-0 bg-slate-50">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {releases.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-slate-400 text-center">
                  {search ? `No archived releases found for "${search}"` : "Nothing archived yet"}
                </TableCell>
              </TableRow>
            )}
            {releases.map((release) => (
              <TableRow key={release.id}>
                <TableCell>
                  <span className="inline-flex items-center bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                    {release.version}
                  </span>
                </TableCell>
                <TableCell className="font-medium text-slate-900">{release.title}</TableCell>
                <TableCell className="text-xs text-slate-500 whitespace-nowrap">{formatDate(release.updatedAt)}</TableCell>
                <TableCell className="sticky right-0 bg-white">
                  <RestoreReleaseButton id={release.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {total > 0 && (
          <div className="px-4 border-t border-slate-100">
            <Pagination total={total} page={page} limit={limit} basePath={PATH} extraParams={{ limit: String(limit), ...(search ? { search } : {}) }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
