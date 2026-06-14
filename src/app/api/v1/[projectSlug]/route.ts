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
  const [apiKey] = await prisma.$queryRaw<Array<{ id: string; projectId: string }>>`
    SELECT id, "projectId" FROM "ApiKey" WHERE "keyHash" = ${keyHash} AND "revokedAt" IS NULL AND ("expiresAt" IS NULL OR "expiresAt" > NOW()) LIMIT 1
  `;

  if (!apiKey) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: CORS });
  }

  const responseHeaders: Record<string, string> = { ...CORS };

  try {
  const project = await prisma.project.findFirst({
    where: { slug: projectSlug, id: apiKey.projectId },
    select: {
      id: true, name: true, slug: true, status: true, overview: true,
      tagline: true, industry: true, techStack: true,
      clientAssignment: {
        select: {
          client: {
            select: {
              name: true,
              slug: true,
              representativeName: true,
              representativeDesignation: true,
            },
          },
        },
      },
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
        overview: project.overview,
        tagline: project.tagline,
        industry: project.industry,
        techStack: project.techStack,
        client: project.clientAssignment?.client ?? null,
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
  } catch (err) {
    console.error("[v1/project GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: CORS });
  }
}
