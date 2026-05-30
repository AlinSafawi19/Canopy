import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { hashApiKey } from "@/lib/api-key";
import { parsePage, paginationArgs, paginationMeta } from "@/lib/pagination";
import { LIMITS, maxLen } from "@/lib/limits";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, adminTenantId: session.tenantId! },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sp = request.nextUrl.searchParams;
  const page = parsePage(sp.get("page") ?? undefined);
  const rawLimit = parseInt(sp.get("limit") ?? "20", 10);
  const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, 100) : 20;
  const { skip: offset, take } = paginationArgs(page, limit);

  const [countResult, keys] = await Promise.all([
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM "ApiKey"
      WHERE "projectId" = ${id} AND "adminTenantId" = ${session.tenantId!}
    `,
    prisma.$queryRaw<
      Array<{ id: string; name: string; keyPrefix: string; createdAt: Date; lastUsedAt: Date | null }>
    >`
      SELECT id, name, "keyPrefix", "createdAt", "lastUsedAt"
      FROM "ApiKey"
      WHERE "projectId" = ${id} AND "adminTenantId" = ${session.tenantId!}
      ORDER BY "createdAt" DESC
      LIMIT ${take} OFFSET ${offset}
    `,
  ]);

  const total = Number(countResult[0].count);

  return NextResponse.json({ keys, pagination: paginationMeta(total, page, limit) });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, adminTenantId: session.tenantId! },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { name } = await request.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  const lenErr = maxLen(name, LIMITS.API_KEY_NAME, "API key name");
  if (lenErr) return NextResponse.json({ error: lenErr }, { status: 400 });

  const key = "cms_" + crypto.randomBytes(32).toString("hex");
  const keyHash = hashApiKey(key);
  const keyPrefix = key.slice(0, 12);
  const newId = crypto.randomUUID();
  const now = new Date();

  await prisma.$executeRaw`
    INSERT INTO "ApiKey" (id, name, "keyHash", "keyPrefix", "projectId", "adminTenantId", "createdAt")
    VALUES (${newId}, ${name.trim()}, ${keyHash}, ${keyPrefix}, ${id}, ${session.tenantId!}, ${now})
  `;

  // Return the plaintext key exactly once — it is not stored and cannot be recovered
  return NextResponse.json({ id: newId, name: name.trim(), key }, { status: 201 });
}
