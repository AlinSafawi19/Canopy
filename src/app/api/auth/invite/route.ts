import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken, type SessionPayload } from "@/lib/auth";
import { validatePassword } from "@/lib/validation";
import { redeemInviteToken, getInviteByToken } from "@/lib/invite-tokens";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token required." }, { status: 400 });

  const invite = await getInviteByToken(token);
  if (!invite) return NextResponse.json({ valid: false, reason: "invalid" });
  if (invite.status === "used") return NextResponse.json({ valid: false, reason: "used" });
  if (invite.status === "expired") return NextResponse.json({ valid: false, reason: "expired" });

  // Fetch display info for the invited user
  let displayName = "";
  if (invite.targetKind === "admin") {
    const u = await prisma.adminIdentity.findUnique({ where: { id: invite.targetId }, select: { displayName: true } });
    displayName = u?.displayName ?? "";
  } else if (invite.targetKind === "client") {
    const u = await prisma.clientIdentity.findUnique({ where: { id: invite.targetId }, select: { displayName: true } });
    displayName = u?.displayName ?? "";
  } else if (invite.targetKind === "contributor") {
    const u = await prisma.contributor.findUnique({ where: { id: invite.targetId }, select: { displayName: true } });
    displayName = u?.displayName ?? "";
  }

  return NextResponse.json({ valid: true, displayName, expiresAt: invite.expiresAt });
}

export async function POST(request: NextRequest) {
  const isSecure = request.headers.get("x-forwarded-proto") === "https";

  try {
    const { token, password } = await request.json();
    if (!token || !password) return NextResponse.json({ error: "Missing fields." }, { status: 400 });

    const pwErr = validatePassword(password);
    if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });

    const result = await redeemInviteToken(token, password);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    const { targetKind, targetId } = result;

    // Build session payload
    let session: SessionPayload;
    let emailVerified = false;
    let walkthroughSeen = false;
    let userTheme = "auto";
    let mustShow2faReminder = false;

    if (targetKind === "admin") {
      const u = await prisma.adminIdentity.findUnique({ where: { id: targetId } });
      session = { id: u!.id, username: u!.username, displayName: u!.displayName, role: "admin", tenantId: u!.tenantId };
      emailVerified = !!u!.emailVerifiedAt;
      walkthroughSeen = !!u!.walkthroughSeenAt;
      userTheme = u!.theme;
      mustShow2faReminder = !!u!.mustShow2faReminder;
    } else if (targetKind === "client") {
      const u = await prisma.clientIdentity.findUnique({ where: { id: targetId } });
      session = { id: u!.id, username: u!.username, displayName: u!.displayName, role: "client" };
      emailVerified = !!u!.emailVerifiedAt;
      walkthroughSeen = !!u!.walkthroughSeenAt;
      userTheme = u!.theme;
      mustShow2faReminder = !!u!.mustShow2faReminder;
    } else {
      const u = await prisma.contributor.findUnique({ where: { id: targetId } });
      session = { id: u!.id, username: u!.username, displayName: u!.displayName, role: "contributor", tenantId: u!.tenantId };
      emailVerified = !!u!.emailVerifiedAt;
      walkthroughSeen = !!u!.walkthroughSeenAt;
      userTheme = u!.theme;
      mustShow2faReminder = !!u!.mustShow2faReminder;
    }

    const sessionToken = await signToken(session);

    const redirectTo = mustShow2faReminder
      ? "/2fa-reminder"
      : !emailVerified
      ? "/verify-email-notice"
      : !walkthroughSeen
      ? "/walkthrough"
      : session.role === "admin" ? "/admin/dashboard"
      : session.role === "client" ? "/client/dashboard"
      : "/contributor/dashboard";

    const response = NextResponse.json({ redirectTo });
    response.cookies.set("cms_session", sessionToken, { httpOnly: true, secure: isSecure, sameSite: "lax", maxAge: 60 * 60 * 8, path: "/" });
    response.cookies.set("cms_csrf", crypto.randomBytes(32).toString("hex"), { httpOnly: false, secure: isSecure, sameSite: "lax", maxAge: 60 * 60 * 8, path: "/" });
    response.cookies.set("cms_theme", userTheme, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
    return response;
  } catch (err) {
    console.error("[invite POST]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
