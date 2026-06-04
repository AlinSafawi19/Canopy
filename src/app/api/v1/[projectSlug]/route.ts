import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashApiKey } from "@/lib/api-key";

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
  { params }: { params: Promise<{ projectSlug: string }> }
) {
  const { projectSlug } = await params;

  const authHeader = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  const queryKey = request.nextUrl.searchParams.get("key");
  const rawKey = authHeader ?? queryKey ?? "";

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

  const responseHeaders: Record<string, string> = { ...CORS };
  if (queryKey) {
    responseHeaders["X-Deprecation-Warning"] =
      "API key in URL is deprecated; use Authorization: Bearer <key> instead";
  }

  const project = await prisma.project.findFirst({
    where: { slug: projectSlug, id: apiKey.projectId },
    select: {
      id: true, name: true, slug: true, status: true, description: true,
      shortDescription: true, industry: true, techStack: true,
      contentCategories: {
        where: { archivedAt: null },
        orderBy: { name: "asc" },
        select: {
          name: true, slug: true, description: true,
          fields: true,
          _count: { select: { entries: { where: { archivedAt: null } } } },
        },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404, headers: CORS });
  }

  await prisma.$executeRaw`
    UPDATE "ApiKey" SET "lastUsedAt" = NOW() WHERE "keyHash" = ${keyHash}
  `;

  return NextResponse.json(
    {
      project: {
        name: project.name,
        slug: project.slug,
        status: project.status,
        description: project.description,
        shortDescription: project.shortDescription,
        industry: project.industry,
        techStack: project.techStack,
      },
      categories: project.contentCategories.map((cat) => ({
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        fields: cat.fields,
        entryCount: cat._count.entries,
      })),
    },
    { headers: responseHeaders }
  );
}
