import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateId } from "@/lib/utils";
import { nanoid } from "nanoid";
import { validateUsername, validateEmail, validateDisplayName, firstError } from "@/lib/validation";
import { createInviteToken } from "@/lib/invite-tokens";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { username, displayName, email } = await request.json();

    const err = firstError(
      validateDisplayName(displayName),
      validateUsername(username),
      validateEmail(email),
    );
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const existing = await prisma.adminIdentity.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json({ error: "Username is already taken." }, { status: 409 });
    }

    // Placeholder password — user sets their own via the invite link
    const placeholder = await hashPassword(crypto.randomBytes(32).toString("hex"));

    const admin = await prisma.adminIdentity.create({
      data: {
        id: generateId(),
        username,
        password: placeholder,
        displayName: displayName.trim(),
        email: email.trim().toLowerCase(),
        tenantId: nanoid(),
        updatedBy: session.id,
      },
    });

    const inviteToken = await createInviteToken("admin", admin.id);

    return NextResponse.json({ id: admin.id, inviteToken }, { status: 201 });
  } catch (err) {
    console.error("[owner/admins POST]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
