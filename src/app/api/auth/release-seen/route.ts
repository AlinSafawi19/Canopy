import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { releaseId } = await request.json();
  if (!releaseId || typeof releaseId !== "string") {
    return NextResponse.json({ error: "releaseId is required" }, { status: 400 });
  }

  const { id, role } = session;

  try {
    if (role === "owner") {
      await prisma.platformOwner.update({ where: { id }, data: { lastSeenReleaseId: releaseId } });
    } else if (role === "admin") {
      await prisma.adminIdentity.update({ where: { id }, data: { lastSeenReleaseId: releaseId } });
    } else if (role === "client") {
      await prisma.clientIdentity.update({ where: { id }, data: { lastSeenReleaseId: releaseId } });
    } else if (role === "contributor") {
      await prisma.contributor.update({ where: { id }, data: { lastSeenReleaseId: releaseId } });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[release-seen]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
