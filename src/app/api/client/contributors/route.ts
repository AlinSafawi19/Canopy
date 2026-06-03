import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateId } from "@/lib/utils";
import { validateUsername, validateEmail, validateDisplayName, firstError } from "@/lib/validation";
import { logActivity } from "@/lib/activity-log";
import { createInviteToken } from "@/lib/invite-tokens";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "client") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { username, displayName, email, projectId } = await request.json();

    const err = firstError(
      validateDisplayName(displayName),
      validateUsername(username),
      validateEmail(email),
    );
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    if (!projectId) return NextResponse.json({ error: "Project is required." }, { status: 400 });

    const clientAssignment = await prisma.clientAssignment.findFirst({
      where: { clientId: session.id, projectId, archivedAt: null },
    });
    if (!clientAssignment) return NextResponse.json({ error: "Project not found." }, { status: 404 });

    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { adminTenantId: true } });
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

    const tenantId = project.adminTenantId;

    const existing = await prisma.contributor.findUnique({ where: { tenantId_username: { tenantId, username } } });
    if (existing) return NextResponse.json({ error: "Username is already taken in this workspace." }, { status: 409 });

    const placeholder = await hashPassword(crypto.randomBytes(32).toString("hex"));
    const id = generateId();

    const contributor = await prisma.contributor.create({
      data: {
        id,
        accountId: id,
        username,
        password: placeholder,
        displayName: displayName.trim(),
        email: email.trim().toLowerCase(),
        tenantId,
        parentClientUsername: session.username,
        permissions: {},
        updatedBy: session.id,
      },
    });

    await prisma.contributorAssignment.create({ data: { contributorId: contributor.id, projectId } });

    const inviteToken = await createInviteToken("contributor", contributor.id);

    await logActivity({ session, action: "created", resource: "contributor", resourceId: contributor.id, resourceName: contributor.displayName });

    return NextResponse.json({ id: contributor.id, inviteToken }, { status: 201 });
  } catch (err) {
    console.error("[client/contributors POST]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
