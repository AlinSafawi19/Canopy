import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateId, slugify } from "@/lib/utils";
import { validateUsername, validateEmail, validateDisplayName, firstError } from "@/lib/validation";
import { logActivity } from "@/lib/activity-log";
import { createInviteToken } from "@/lib/invite-tokens";
import { validateUserStillExists } from "@/lib/validate-user";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const adminExists = await validateUserStillExists(session.id, "admin");
  if (!adminExists) {
    return NextResponse.json({ error: "Account has been deleted." }, { status: 403 });
  }

  try {
    const { username, name, email, representativeName, representativeDesignation } = await request.json();

    const err = firstError(
      validateDisplayName(name),
      validateUsername(username),
      validateEmail(email),
    );
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const existing = await prisma.clientIdentity.findUnique({ where: { username } });
    if (existing) return NextResponse.json({ error: "Username is already taken." }, { status: 409 });

    const tenantId = session.tenantId!;
    const placeholder = await hashPassword(crypto.randomBytes(32).toString("hex"));

    const client = await prisma.clientIdentity.create({
      data: {
        id: generateId(),
        tenantId,
        username,
        password: placeholder,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        slug: slugify(username),
        updatedBy: session.id,
        ...(representativeName ? { representativeName: representativeName.trim() } : {}),
        ...(representativeDesignation ? { representativeDesignation: representativeDesignation.trim() } : {}),
      },
    });

    const inviteToken = await createInviteToken("client", client.id);

    await logActivity({ session, action: "created", resource: "client", resourceId: client.id, resourceName: client.name, adminTenantId: tenantId });

    return NextResponse.json({ id: client.id, inviteToken }, { status: 201 });
  } catch (err) {
    console.error("[admin/clients POST]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
