import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setPresence, deletePresence, getCategoryPresence } from "@/lib/presence";

type Params = Promise<{ id: string; catId: string }>;

async function checkAssignment(projectId: string, clientId: string) {
  return prisma.clientAssignment.findFirst({
    where: { projectId, clientId, archivedAt: null },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Params }
) {
  const session = await getSession();
  if (!session || session.role !== "client") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: projectId, catId } = await params;
  if (!await checkAssignment(projectId, session.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const data = await getCategoryPresence(catId);
  return NextResponse.json(data);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Params }
) {
  const session = await getSession();
  if (!session || session.role !== "client") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: projectId, catId } = await params;
  if (!await checkAssignment(projectId, session.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { entryId } = await req.json();
  await setPresence(catId, entryId, session.id, session.displayName);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Params }
) {
  const session = await getSession();
  if (!session || session.role !== "client") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: projectId, catId } = await params;
  if (!await checkAssignment(projectId, session.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { entryId } = await req.json();
  await deletePresence(catId, entryId, session.id);
  return NextResponse.json({ ok: true });
}
