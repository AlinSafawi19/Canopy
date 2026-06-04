import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ITEMS_PER_PAGE = 50;

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const skip = (page - 1) * ITEMS_PER_PAGE;

  try {
    const events = await prisma.auditLog.findMany({
      where: { actorId: session.id },
      orderBy: { createdAt: "desc" },
      skip,
      take: ITEMS_PER_PAGE,
      select: {
        id: true,
        action: true,
        resource: true,
        severity: true,
        ipAddress: true,
        userAgent: true,
        details: true,
        createdAt: true,
      },
    });

    const total = await prisma.auditLog.count({
      where: { actorId: session.id },
    });

    return NextResponse.json({
      events,
      total,
      page,
      pages: Math.ceil(total / ITEMS_PER_PAGE),
    });
  } catch (err) {
    console.error("[activity]", err);
    return NextResponse.json({ error: "Failed to fetch activity" }, { status: 500 });
  }
}
