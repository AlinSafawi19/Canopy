import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { verifyToken, signToken, ROLE_HOME } from "@/lib/auth";
import {
  verifyTOTP,
  verifyAndConsumeBackupCode,
  getTwoFactorSecret,
} from "@/lib/two-factor";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const pendingToken = request.cookies.get("cms_2fa_pending")?.value;
  if (!pendingToken) {
    return NextResponse.json({ error: "No pending 2FA session" }, { status: 401 });
  }

  const session = await verifyToken(pendingToken);
  if (!session) {
    return NextResponse.json({ error: "Session expired. Please log in again." }, { status: 401 });
  }

  const { code } = await request.json();
  if (!code) return NextResponse.json({ error: "Code required" }, { status: 400 });

  const secret = await getTwoFactorSecret(session.id, session.role);
  if (!secret) return NextResponse.json({ error: "2FA not configured" }, { status: 400 });

  const validTOTP = verifyTOTP(secret, code);
  const validBackup = validTOTP
    ? false
    : await verifyAndConsumeBackupCode(session.role, session.id, code);

  if (!validTOTP && !validBackup) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  // Check post-login redirect conditions
  let mustChangePassword = false;
  let emailVerified = true;
  let walkthroughSeen = false;
  const { id, role } = session;

  if (role === "owner") {
    const u = await prisma.platformOwner.findUnique({ where: { id }, select: { mustChangePassword: true, emailVerifiedAt: true, walkthroughSeenAt: true } });
    mustChangePassword = !!u?.mustChangePassword;
    emailVerified = !!u?.emailVerifiedAt;
    walkthroughSeen = !!u?.walkthroughSeenAt;
  } else if (role === "admin") {
    const u = await prisma.adminIdentity.findUnique({ where: { id }, select: { mustChangePassword: true, emailVerifiedAt: true, walkthroughSeenAt: true } });
    mustChangePassword = !!u?.mustChangePassword;
    emailVerified = !!u?.emailVerifiedAt;
    walkthroughSeen = !!u?.walkthroughSeenAt;
  } else if (role === "client") {
    const u = await prisma.clientIdentity.findUnique({ where: { id }, select: { mustChangePassword: true, emailVerifiedAt: true, walkthroughSeenAt: true } });
    mustChangePassword = !!u?.mustChangePassword;
    emailVerified = !!u?.emailVerifiedAt;
    walkthroughSeen = !!u?.walkthroughSeenAt;
  } else if (role === "contributor") {
    const u = await prisma.contributor.findUnique({ where: { id }, select: { mustChangePassword: true, emailVerifiedAt: true, walkthroughSeenAt: true } });
    mustChangePassword = !!u?.mustChangePassword;
    emailVerified = !!u?.emailVerifiedAt;
    walkthroughSeen = !!u?.walkthroughSeenAt;
  }

  let redirectTo: string;
  if (mustChangePassword) {
    redirectTo = "/change-password";
  } else if (!emailVerified) {
    redirectTo = "/verify-email-notice";
  } else if (!walkthroughSeen) {
    redirectTo = "/walkthrough";
  } else {
    redirectTo = ROLE_HOME[role];
  }

  const isSecure = request.headers.get("x-forwarded-proto") === "https";
  const fullToken = await signToken(session);
  const response = NextResponse.json({ redirectTo });
  response.cookies.set("cms_session", fullToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
    path: "/",
  });
  response.cookies.set("cms_csrf", crypto.randomBytes(32).toString("hex"), {
    httpOnly: false,
    secure: isSecure,
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
    path: "/",
  });
  response.cookies.delete("cms_2fa_pending");
  return response;
}
