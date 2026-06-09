import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { pusherServer } from "@/lib/pusher-server";
import { presenceColor } from "@/lib/presence-client";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { channel, event, data } = await req.json();

  if (!channel.startsWith("presence-entry-")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const entryId = channel.slice("presence-entry-".length);

  const entry = await prisma.contentCategoryEntry.findUnique({
    where: { id: entryId },
    select: {
      category: {
        select: {
          projectId: true,
          project: { select: { adminTenantId: true } },
        },
      },
    },
  });

  if (!entry) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { projectId, project } = entry.category;

  if (session.role === "admin") {
    if (project.adminTenantId !== session.tenantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (session.role === "contributor") {
    const assignment = await prisma.contributorAssignment.findFirst({
      where: { contributorId: session.id, projectId },
    });
    if (!assignment) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { socketId, ...rest } = data ?? {};

  await pusherServer.trigger(
    channel,
    event,
    { ...rest, userId: session.id, name: session.displayName, color: presenceColor(session.id) },
    socketId ? { socket_id: socketId } : undefined,
  );

  return NextResponse.json({ ok: true });
}
