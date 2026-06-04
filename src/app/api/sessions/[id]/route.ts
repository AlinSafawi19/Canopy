import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: sessionId } = params;

  try {
    // Verify the session belongs to the current user
    const targetSession = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { targetId: true, id: true },
    });

    if (!targetSession || targetSession.targetId !== session.id) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Prevent revoking the current session
    if (sessionId === session.id) {
      return NextResponse.json(
        { error: "Cannot revoke current session" },
        { status: 400 }
      );
    }

    // Revoke the session
    await prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[sessions/revoke]", err);
    return NextResponse.json({ error: "Failed to revoke session" }, { status: 500 });
  }
}
