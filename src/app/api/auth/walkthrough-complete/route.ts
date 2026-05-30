import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const { id, role } = session;

  try {
    if (role === "owner") {
      await prisma.platformOwner.update({ where: { id }, data: { walkthroughSeenAt: now } });
    } else if (role === "admin") {
      await prisma.adminIdentity.update({ where: { id }, data: { walkthroughSeenAt: now } });
    } else if (role === "client") {
      await prisma.clientIdentity.update({ where: { id }, data: { walkthroughSeenAt: now } });
    } else if (role === "contributor") {
      await prisma.contributor.update({ where: { id }, data: { walkthroughSeenAt: now } });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[walkthrough-complete]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
