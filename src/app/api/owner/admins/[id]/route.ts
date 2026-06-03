import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateUserStillExists } from "@/lib/validate-user";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerExists = await validateUserStillExists(session.id, "owner");
  if (!ownerExists) {
    return NextResponse.json({ error: "Account has been deleted." }, { status: 403 });
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

  const ownerExists = await validateUserStillExists(session.id, "owner");
  if (!ownerExists) {
    return NextResponse.json({ error: "Account has been deleted." }, { status: 403 });
  }

  const { id } = await params;
  try {
    const admin = await prisma.adminIdentity.findUnique({ where: { id } });
    if (!admin) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const t = admin.tenantId;

    await prisma.$transaction(async (tx) => {
      // Deepest dependents first so FK constraints (with or without CASCADE) are never violated.
      await tx.contentCategoryEntry.deleteMany({
        where: { category: { project: { adminTenantId: t } } },
      });
      await tx.contentCategory.deleteMany({
        where: { project: { adminTenantId: t } },
      });
      await tx.contributorAssignment.deleteMany({
        where: { contributor: { tenantId: t } },
      });
      await tx.clientAssignment.deleteMany({
        where: { client: { tenantId: t } },
      });
      await tx.contributor.deleteMany({ where: { tenantId: t } });
      await tx.clientIdentity.deleteMany({ where: { tenantId: t } });
      await tx.project.deleteMany({ where: { adminTenantId: t } });
      await tx.apiKey.deleteMany({ where: { adminTenantId: t } });
      await tx.activityLog.deleteMany({ where: { adminTenantId: t } });
      // Admin's own auth records
      await tx.twoFactorBackupCode.deleteMany({ where: { targetKind: "admin", targetId: id } });
      await tx.emailVerificationChallenge.deleteMany({ where: { targetKind: "admin", targetId: id } });
      await tx.passwordResetChallenge.deleteMany({ where: { targetKind: "admin", targetId: id } });
      await tx.adminIdentity.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[owner/admins/:id DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
