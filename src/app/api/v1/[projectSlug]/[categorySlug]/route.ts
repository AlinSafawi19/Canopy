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

  if (request.nextUrl.searchParams.has("key")) {
    return NextResponse.json(
      { error: "API key in URL is not supported. Use Authorization: Bearer <key> header instead." },
      { status: 400, headers: CORS }
    );
  }

  const rawKey = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";

  if (!rawKey) {
    return NextResponse.json({ error: "API key required" }, { status: 401, headers: CORS });
  }

  const keyHash = hashApiKey(rawKey);

  try {
    const [apiKey] = await prisma.$queryRaw<Array<{ id: string; projectId: string }>>`
      SELECT id, "projectId" FROM "ApiKey" WHERE "keyHash" = ${keyHash} AND "revokedAt" IS NULL AND ("expiresAt" IS NULL OR "expiresAt" > NOW()) LIMIT 1
    `;

    if (!apiKey) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: CORS });
    }

    const responseHeaders: Record<string, string> = { ...CORS };

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
      ? (category.fields as Array<{ name: string; type: string; relationCategoryId?: string }>)
      : [];

    // Resolve relation fields: replace raw entry IDs with the referenced entry's values
    const relationFields = fields.filter((f) => f.type === "relation" && f.relationCategoryId);
    const resolvedMap = new Map<string, Record<string, unknown>>();
    if (relationFields.length > 0) {
      const referencedIds = new Set<string>();
      for (const entry of entries) {
        const vals = entry.values as Record<string, unknown>;
        for (const f of relationFields) {
          const v = vals[f.name];
          if (typeof v === "string" && v) referencedIds.add(v);
        }
      }
      if (referencedIds.size > 0) {
        const referencedRows = await prisma.contentCategoryEntry.findMany({
          where: { id: { in: Array.from(referencedIds) } },
          select: { id: true, values: true },
        });
        for (const row of referencedRows) {
          resolvedMap.set(row.id, { id: row.id, ...(row.values as Record<string, unknown>) });
        }
      }
    }

    const data = entries.map((entry) => {
      const values = { ...(entry.values as Record<string, unknown>) };
      for (const f of relationFields) {
        const refId = values[f.name];
        if (typeof refId === "string" && resolvedMap.has(refId)) {
          values[f.name] = resolvedMap.get(refId);
        }
      }
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
      { headers: responseHeaders }
    );
  } catch (err) {
    console.error("[v1/category GET]", err);
    return NextResponse.json(
      {
        error: "Internal server error",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500, headers: CORS }
    );
  }
}
