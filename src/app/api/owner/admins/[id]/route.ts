import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  try {
    const admin = await prisma.adminIdentity.findUnique({ where: { id } });
    if (!admin) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (body.action === "archive") {
      await prisma.$transaction([
        prisma.adminIdentity.update({
          where: { id },
          data: { archivedAt: new Date(), archivedBy: session.id },
        }),
        prisma.$executeRaw`UPDATE "ApiKey" SET "revokedAt" = NOW() WHERE "adminTenantId" = ${admin.tenantId} AND "revokedAt" IS NULL`,
      ]);
    } else if (body.action === "restore") {
      await prisma.$transaction([
        prisma.adminIdentity.update({
          where: { id },
          data: { archivedAt: null, archivedBy: null },
        }),
        prisma.$executeRaw`UPDATE "ApiKey" SET "revokedAt" = NULL WHERE "adminTenantId" = ${admin.tenantId}`,
      ]);
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[owner/admins/:id PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const admin = await prisma.adminIdentity.findUnique({ where: { id } });
    if (!admin) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // Delete everything owned by this admin's workspace in the correct order.
    // There are no DB-level FKs between AdminIdentity and the other models
    // (they share tenantId as a plain string), so cascades must be explicit.
    await prisma.$transaction([
      // Contributors + their assignments (ContributorAssignment cascades via FK)
      prisma.contributor.deleteMany({ where: { tenantId: admin.tenantId } }),
      // Clients + their project assignments (ClientAssignment cascades via FK)
      prisma.clientIdentity.deleteMany({ where: { tenantId: admin.tenantId } }),
      // Projects + their categories + entries (cascade via FK chain)
      prisma.project.deleteMany({ where: { adminTenantId: admin.tenantId } }),
      // API keys
      prisma.apiKey.deleteMany({ where: { adminTenantId: admin.tenantId } }),
      // Activity logs
      prisma.activityLog.deleteMany({ where: { adminTenantId: admin.tenantId } }),
      // Finally the admin record itself
      prisma.adminIdentity.delete({ where: { id } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[owner/admins/:id DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
