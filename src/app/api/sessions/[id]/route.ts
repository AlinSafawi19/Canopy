import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/session-management";
import { cookies } from "next/headers";

export async function DELETE(
  _request: unknown,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: sessionId } = await params;

  try {
    // Verify the session belongs to the current user
    const targetSession = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { targetId: true, id: true },
    });

    if (!targetSession || targetSession.targetId !== session.id) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Find the current session by token hash
    const cookieStore = await cookies();
    const currentToken = cookieStore.get("cms_session")?.value;
    const currentSessionHash = currentToken ? hashToken(currentToken) : null;

    const currentSessionRecord = currentSessionHash
      ? await prisma.session.findFirst({
          where: { tokenHash: currentSessionHash, targetId: session.id },
          select: { id: true },
        })
      : null;

    // Prevent revoking the current session
    if (currentSessionRecord && sessionId === currentSessionRecord.id) {
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
