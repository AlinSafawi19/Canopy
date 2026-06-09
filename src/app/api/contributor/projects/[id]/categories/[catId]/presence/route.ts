import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setPresence, deletePresence, getCategoryPresence } from "@/lib/presence";
import { parsePermissions } from "@/lib/contributor-permissions";

type Params = Promise<{ id: string; catId: string }>;

async function getAssignment(projectId: string, contributorId: string) {
  return prisma.contributorAssignment.findFirst({ where: { contributorId, projectId } });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Params }
) {
  const session = await getSession();
  if (!session || session.role !== "contributor") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: projectId, catId } = await params;
  if (!await getAssignment(projectId, session.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const data = await getCategoryPresence(catId);
  return NextResponse.json(data);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Params }
) {
  const session = await getSession();
  if (!session || session.role !== "contributor") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: projectId, catId } = await params;
  const assignment = await getAssignment(projectId, session.id);
  if (!assignment) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const perms = parsePermissions(assignment.permissions as unknown);
  if (!perms.canEditEntries && !perms.canCreateEntries) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { entryId } = await req.json();
  await setPresence(catId, entryId, session.id, session.displayName);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Params }
) {
  const session = await getSession();
  if (!session || session.role !== "contributor") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: projectId, catId } = await params;
  const assignment = await getAssignment(projectId, session.id);
  if (!assignment) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const perms = parsePermissions(assignment.permissions as unknown);
  if (!perms.canEditEntries && !perms.canCreateEntries) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { entryId } = await req.json();
  await deletePresence(catId, entryId, session.id);
  return NextResponse.json({ ok: true });
}
