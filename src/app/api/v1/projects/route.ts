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

export async function GET(request: NextRequest) {
  const rawKey =
    request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ??
    request.nextUrl.searchParams.get("key") ??
    "";

  if (!rawKey) {
    return NextResponse.json({ error: "API key required" }, { status: 401, headers: CORS });
  }

  const keyHash = hashApiKey(rawKey);
  const [apiKey] = await prisma.$queryRaw<Array<{ adminTenantId: string }>>`
    SELECT "adminTenantId" FROM "ApiKey" WHERE "keyHash" = ${keyHash} AND "revokedAt" IS NULL LIMIT 1
  `;

  if (!apiKey) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: CORS });
  }

  const sp = request.nextUrl.searchParams;
  const page = parsePage(sp.get("page") ?? undefined);
  const rawLimit = parseInt(sp.get("limit") ?? "20", 10);
  const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, 100) : 20;
  const { skip, take } = paginationArgs(page, limit);

  const where = { adminTenantId: apiKey.adminTenantId, archivedAt: null };

  const [total, projects] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        description: true,
        shortDescription: true,
        industry: true,
        techStack: true,
        githubUrl: true,
        liveUrl: true,
        role: true,
        teamSize: true,
        highlights: true,
        featured: true,
        startDate: true,
        endDate: true,
        imageBg: true,
        coverImageAlt: true,
      },
    }),
  ]);

  await prisma.$executeRaw`
    UPDATE "ApiKey" SET "lastUsedAt" = NOW() WHERE "keyHash" = ${keyHash}
  `;

  return NextResponse.json(
    {
      projects: projects.map((p) => ({
        ...p,
        techStack: Array.isArray(p.techStack) ? p.techStack : [],
        highlights: Array.isArray(p.highlights) ? p.highlights : [],
      })),
      pagination: paginationMeta(total, page, limit),
    },
    { headers: CORS }
  );
}
