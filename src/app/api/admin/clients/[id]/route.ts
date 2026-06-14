import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { validateUserStillExists } from "@/lib/validate-user";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminExists = await validateUserStillExists(session.id, "admin");
  if (!adminExists) {
    return NextResponse.json({ error: "Account has been deleted." }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const client = await prisma.clientIdentity.findFirst({
      where: { id, tenantId: session.tenantId! },
    });
    if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (body.action === "archive") {
      await prisma.$transaction([
        prisma.clientIdentity.update({ where: { id }, data: { archivedAt: new Date(), archivedBy: session.id } }),
        prisma.$executeRaw`UPDATE "ApiKey" SET "revokedAt" = NOW() WHERE "projectId" IN (SELECT "projectId" FROM "ClientAssignment" WHERE "clientId" = ${id}) AND "revokedAt" IS NULL`,
      ]);
      await logActivity({ session, action: "archived", resource: "client", resourceId: id, resourceName: client.name, adminTenantId: session.tenantId! });
    } else if (body.action === "restore") {
      await prisma.$transaction([
        prisma.clientIdentity.update({ where: { id }, data: { archivedAt: null, archivedBy: null } }),
        prisma.$executeRaw`UPDATE "ApiKey" SET "revokedAt" = NULL WHERE "projectId" IN (SELECT "projectId" FROM "ClientAssignment" WHERE "clientId" = ${id})`,
      ]);
      await logActivity({ session, action: "restored", resource: "client", resourceId: id, resourceName: client.name, adminTenantId: session.tenantId! });
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/clients/:id PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminExists = await validateUserStillExists(session.id, "admin");
  if (!adminExists) {
    return NextResponse.json({ error: "Account has been deleted." }, { status: 403 });
  }

  const { id } = await params;
  const client = await prisma.clientIdentity.findFirst({
    where: { id, tenantId: session.tenantId! },
  });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.$transaction([
    // Delete the client's contributors and their assignments (ContributorAssignment cascades via FK).
    // Projects, categories, and entries are NOT touched — they belong to the admin's workspace.
    prisma.contributor.deleteMany({ where: { parentClientUsername: client.username } }),
    // Delete the client — ClientAssignment cascades via FK
    prisma.clientIdentity.delete({ where: { id } }),
  ]);
  await logActivity({ session, action: "deleted", resource: "client", resourceId: id, resourceName: client.name, adminTenantId: session.tenantId! });
  return NextResponse.json({ ok: true });
}
