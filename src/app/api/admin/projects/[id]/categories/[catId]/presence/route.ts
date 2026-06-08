import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { setPresence, deletePresence, getCategoryPresence } from "@/lib/presence";

type Params = Promise<{ id: string; catId: string }>;

export async function GET(
  _req: NextRequest,
  { params }: { params: Params }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { catId } = await params;
  const data = await getCategoryPresence(catId);
  return NextResponse.json(data);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Params }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { catId } = await params;
  const { entryId } = await req.json();
  await setPresence(catId, entryId, session.id, session.displayName);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Params }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { catId } = await params;
  const { entryId } = await req.json();
  await deletePresence(catId, entryId, session.id);
  return NextResponse.json({ ok: true });
}
