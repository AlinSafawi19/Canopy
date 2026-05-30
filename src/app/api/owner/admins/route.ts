import { NextRequest, NextResponse } from "next/server";
import { getSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateId } from "@/lib/utils";
import { nanoid } from "nanoid";
import { validateUsername, validatePassword, validateEmail, validateDisplayName, firstError } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "owner") {
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

    const existing = await prisma.adminIdentity.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json({ error: "Username is already taken." }, { status: 409 });
    }

    const hashed = await hashPassword(password);
    const admin = await prisma.adminIdentity.create({
      data: {
        id: generateId(),
        username,
        password: hashed,
        displayName: displayName.trim(),
        email: email.trim().toLowerCase(),
        tenantId: nanoid(),
        mustChangePassword: true,
        updatedBy: session.id,
      },
    });

    return NextResponse.json({ id: admin.id }, { status: 201 });
  } catch (err) {
    console.error("[owner/admins POST]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
