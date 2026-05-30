import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashApiKey } from "@/lib/api-key";
import { parsePage, paginationArgs, paginationMeta } from "@/lib/pagination";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectSlug: string; categorySlug: string }> }
) {
  const { projectSlug, categorySlug } = await params;

  const rawKey =
    request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ??
    request.nextUrl.searchParams.get("key") ??
    "";

  if (!rawKey) {
    return NextResponse.json({ error: "API key required" }, { status: 401, headers: CORS });
  }

  const keyHash = hashApiKey(rawKey);
  const [apiKey] = await prisma.$queryRaw<Array<{ id: string; projectId: string }>>`
    SELECT id, "projectId" FROM "ApiKey" WHERE "keyHash" = ${keyHash} AND "revokedAt" IS NULL LIMIT 1
  `;

  if (!apiKey) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: CORS });
  }

  const project = await prisma.project.findFirst({
    where: { slug: projectSlug, id: apiKey.projectId },
    select: { id: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404, headers: CORS });
  }

  const category = await prisma.contentCategory.findFirst({
    where: { projectId: project.id, slug: categorySlug, archivedAt: null },
    select: { id: true, name: true, slug: true, description: true, fields: true },
  });

  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404, headers: CORS });
  }

  const sp = request.nextUrl.searchParams;
  const page = parsePage(sp.get("page") ?? undefined);
  const rawLimit = parseInt(sp.get("limit") ?? "20", 10);
  const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, 100) : 20;
  const { skip, take } = paginationArgs(page, limit);

  const entryWhere = { categoryId: category.id, archivedAt: null };

  const [total, entries] = await Promise.all([
    prisma.contentCategoryEntry.count({ where: entryWhere }),
    prisma.contentCategoryEntry.findMany({
      where: entryWhere,
      orderBy: { sortIndex: "asc" },
      skip,
      take,
      select: { id: true, values: true, sortIndex: true },
    }),
  ]);

  await prisma.$executeRaw`
    UPDATE "ApiKey" SET "lastUsedAt" = NOW() WHERE "keyHash" = ${keyHash}
  `;

  const fields = Array.isArray(category.fields)
    ? (category.fields as Array<{ name: string; type: string }>)
    : [];

  const data = entries.map((entry) => {
    const values = entry.values as Record<string, unknown>;
    return { id: entry.id, ...values };
  });

  return NextResponse.json(
    {
      category: {
        name: category.name,
        slug: category.slug,
        description: category.description,
        fields,
      },
      data,
      pagination: paginationMeta(total, page, limit),
    },
    { headers: CORS }
  );
}
