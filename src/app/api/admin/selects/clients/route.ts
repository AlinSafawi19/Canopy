import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const tenantId = session.tenantId!;
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const excludeId = searchParams.get("excludeId") ?? "";
  const skip = (page - 1) * limit;

  const where = {
    tenantId,
    archivedAt: null,
    ...(excludeId ? { id: { not: excludeId } } : {}),
    ...(search ? {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { username: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
      ],
    } : {}),
  };

  const [total, clients] = await Promise.all([
    prisma.clientIdentity.count({ where }),
    prisma.clientIdentity.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: limit,
      select: { id: true, name: true, username: true },
    }),
  ]);

  return NextResponse.json({
    items: clients.map((c) => ({
      id: c.id,
      label: c.name,
      sublabel: `@${c.username}`,
    })),
    total,
    hasMore: skip + clients.length < total,
  });
}
