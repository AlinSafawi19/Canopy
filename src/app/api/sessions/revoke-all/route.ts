import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { hashToken } from "@/lib/session-management";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Identify the current session from the cookie — never trust client-supplied ID
    const cookieStore = await cookies();
    const token = cookieStore.get("cms_session")?.value;
    const currentTokenHash = token ? hashToken(token) : null;

    const currentDbSession = currentTokenHash
      ? await prisma.session.findFirst({
          where: { tokenHash: currentTokenHash, targetId: session.id, revokedAt: null },
          select: { id: true },
        })
      : null;

    const result = await prisma.session.updateMany({
      where: {
        targetId: session.id,
        revokedAt: null,
        ...(currentDbSession ? { id: { not: currentDbSession.id } } : {}),
      },
      data: { revokedAt: new Date() },
    });

    return NextResponse.json({ ok: true, revokedCount: result.count });
  } catch (err) {
    console.error("[sessions/revoke-all]", err);
    return NextResponse.json({ error: "Failed to revoke sessions" }, { status: 500 });
  }
}
