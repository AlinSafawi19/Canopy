import { NextRequest, NextResponse } from "next/server";
import { getSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateId, slugify } from "@/lib/utils";
import { validateUsername, validatePassword, validateEmail, validateDisplayName, firstError } from "@/lib/validation";
import { logActivity } from "@/lib/activity-log";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { username, password, displayName, email } = await request.json();

    const err = firstError(
      validateDisplayName(displayName),
      validateUsername(username),
      validateEmail(email),
      validatePassword(password),
    );
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const existing = await prisma.clientIdentity.findUnique({ where: { username } });
    if (existing) return NextResponse.json({ error: "Username is already taken." }, { status: 409 });

    const tenantId = session.tenantId!;
    const hashed = await hashPassword(password);
    const client = await prisma.clientIdentity.create({
      data: {
        id: generateId(),
        tenantId,
        username,
        password: hashed,
        displayName: displayName.trim(),
        email: email.trim().toLowerCase(),
        slug: slugify(username),
        mustChangePassword: true,
        updatedBy: session.id,
      },
    });

    await logActivity({ session, action: "created", resource: "client", resourceId: client.id, resourceName: client.displayName, adminTenantId: session.tenantId! });

    return NextResponse.json({ id: client.id }, { status: 201 });
  } catch (err) {
    console.error("[admin/clients POST]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
