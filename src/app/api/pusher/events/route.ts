import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { pusherServer } from "@/lib/pusher-server";
import { presenceColor } from "@/lib/presence-client";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { channel, event, data } = await req.json();

  if (!channel.startsWith("presence-entry-")) {
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
