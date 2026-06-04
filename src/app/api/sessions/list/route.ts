import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sessions = await prisma.session.findMany({
      where: {
        targetId: session.id,
        revokedAt: null,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
      },
    });

    return NextResponse.json(sessions);
  } catch (err) {
    console.error("[sessions/list]", err);
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
}
