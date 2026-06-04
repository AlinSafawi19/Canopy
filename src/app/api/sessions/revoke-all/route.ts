import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Revoke all sessions except the current one
    const result = await prisma.session.updateMany({
      where: {
        targetId: session.id,
        revokedAt: null,
        NOT: {
          id: session.id, // Keep current session active
        },
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, revokedCount: result.count });
  } catch (err) {
    console.error("[sessions/revoke-all]", err);
    return NextResponse.json({ error: "Failed to revoke sessions" }, { status: 500 });
  }
}
