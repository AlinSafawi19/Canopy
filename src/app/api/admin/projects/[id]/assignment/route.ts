import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateId } from "@/lib/utils";

async function getProjectForAdmin(projectId: string, tenantId: string) {
  return prisma.project.findFirst({ where: { id: projectId, adminTenantId: tenantId, archivedAt: null } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;
  const tenantId = session.tenantId!;

  const project = await getProjectForAdmin(projectId, tenantId);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  try {
    const { clientId } = await request.json();
    if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

    const client = await prisma.clientIdentity.findFirst({
      where: { id: clientId, tenantId, archivedAt: null },
    });
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    const assignment = await prisma.clientAssignment.upsert({
      where: { projectId },
      create: {
        id: generateId(),
        clientId,
        projectId,
        tenantId,
        updatedBy: session.id,
      },
      update: {
        clientId,
        updatedBy: session.id,
        archivedAt: null,
        archivedBy: null,
      },
    });

    return NextResponse.json({ id: assignment.id });
  } catch (err) {
    console.error("[assignment POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;
  const tenantId = session.tenantId!;

  const project = await getProjectForAdmin(projectId, tenantId);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  try {
    await prisma.clientAssignment.deleteMany({ where: { projectId, tenantId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[assignment DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
