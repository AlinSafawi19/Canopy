import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createInviteToken } from "@/lib/invite-tokens";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { targetKind, targetId } = await request.json();
  if (!targetKind || !targetId) return NextResponse.json({ error: "Missing fields." }, { status: 400 });

  // Verify the caller has permission over this user
  if (targetKind === "admin" && session.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (targetKind === "client" && session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (targetKind === "contributor" && session.role !== "client") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // Ensure target exists and belongs to caller's workspace
  if (targetKind === "admin") {
    const u = await prisma.adminIdentity.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!u) return NextResponse.json({ error: "Not found." }, { status: 404 });
  } else if (targetKind === "client") {
    const u = await prisma.clientIdentity.findUnique({ where: { id: targetId, tenantId: session.tenantId! }, select: { id: true } });
    if (!u) return NextResponse.json({ error: "Not found." }, { status: 404 });
  } else if (targetKind === "contributor") {
    const u = await prisma.contributor.findFirst({ where: { id: targetId, parentClientUsername: session.username }, select: { id: true } });
    if (!u) return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const token = await createInviteToken(targetKind, targetId);
  return NextResponse.json({ inviteToken: token });
}
