import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CONTRIBUTOR_PERMISSIONS, parsePermissions } from "@/lib/contributor-permissions";

async function getContributor(contributorId: string, clientUsername: string) {
  return prisma.contributor.findFirst({
    where: { id: contributorId, parentClientUsername: clientUsername },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "client") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const contributor = await getContributor(id, session.username);
  if (!contributor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const { projectId, permissions } = await request.json();
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

    const clientAssignment = await prisma.clientAssignment.findFirst({
      where: { clientId: session.id, projectId, archivedAt: null },
    });
    if (!clientAssignment) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const resolvedPermissions = parsePermissions(permissions ?? DEFAULT_CONTRIBUTOR_PERMISSIONS);

    await (prisma.contributorAssignment as any).upsert({
      where: { contributorId_projectId: { contributorId: id, projectId } },
      create: { contributorId: id, projectId, permissions: resolvedPermissions },
      update: { permissions: resolvedPermissions },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[client/contributors/:id/assignment POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "client") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const contributor = await getContributor(id, session.username);
  if (!contributor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const { projectId, permissions } = await request.json();
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
    if (!permissions) return NextResponse.json({ error: "permissions required" }, { status: 400 });

    const resolvedPermissions = parsePermissions(permissions);

    await (prisma.contributorAssignment as any).update({
      where: { contributorId_projectId: { contributorId: id, projectId } },
      data: { permissions: resolvedPermissions },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[client/contributors/:id/assignment PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "client") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const contributor = await getContributor(id, session.username);
  if (!contributor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  await prisma.contributorAssignment.deleteMany({
    where: { contributorId: id, projectId },
  });

  return NextResponse.json({ ok: true });
}
