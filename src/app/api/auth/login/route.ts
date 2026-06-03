import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken, verifyPassword, ROLE_HOME, type SessionPayload } from "@/lib/auth";

// Pre-computed bcrypt-12 hash used for a dummy compare when no user is found,
// so the "unknown username" path takes the same wall time as a real bcrypt check.
const DUMMY_HASH = "$2b$12$LCM9Q7M9vBMLkfZQz0Xl3.sG9YJXG5Y6hPfCdZ4OQe1YRAyFYMim6";

export async function POST(request: NextRequest) {
  try {
    const isSecure = request.headers.get("x-forwarded-proto") === "https";
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required." },
        { status: 400 }
      );
    }

    // All four identity tables queried in parallel — eliminates the timing
    // oracle that revealed which role a username belonged to.
    const [owner, admin, client, contributor] = await Promise.all([
      prisma.platformOwner.findUnique({ where: { username } }),
      prisma.adminIdentity.findUnique({ where: { username } }),
      prisma.clientIdentity.findUnique({ where: { username } }),
      prisma.contributor.findFirst({ where: { username } }),
    ]);

    const user = owner ?? admin ?? client ?? contributor;

    if (!user) {
      // Dummy compare equalises timing with the "user found" path.
      await verifyPassword(password, DUMMY_HASH);
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    let session: SessionPayload;
    let emailVerified = true;
    let twoFactorEnabled = false;
    let mustShow2faReminder = false;
    let walkthroughSeen = false;
    let userTheme = "auto";

    if (owner) {
      session = { id: owner.id, username: owner.username, displayName: owner.displayName, role: "owner" };
      emailVerified = !!owner.emailVerifiedAt;
      twoFactorEnabled = !!owner.twoFactorEnabled;
      mustShow2faReminder = !!owner.mustShow2faReminder;
      walkthroughSeen = !!owner.walkthroughSeenAt;
      userTheme = owner.theme;
    } else if (admin) {
      if (admin.archivedAt) {
        return NextResponse.json({ error: "Your account has been deactivated. Contact the platform owner for help." }, { status: 403 });
      }
      session = { id: admin.id, username: admin.username, displayName: admin.displayName, role: "admin", tenantId: admin.tenantId };
      emailVerified = !!admin.emailVerifiedAt;
      twoFactorEnabled = !!admin.twoFactorEnabled;
      mustShow2faReminder = !!admin.mustShow2faReminder;
      walkthroughSeen = !!admin.walkthroughSeenAt;
      userTheme = admin.theme;
    } else if (client) {
      if (client.archivedAt) {
        return NextResponse.json({ error: "Your account has been deactivated. Contact your admin for help." }, { status: 403 });
      }
      session = { id: client.id, username: client.username, displayName: client.displayName, role: "client" };
      emailVerified = !!client.emailVerifiedAt;
      twoFactorEnabled = !!client.twoFactorEnabled;
      mustShow2faReminder = !!client.mustShow2faReminder;
      walkthroughSeen = !!client.walkthroughSeenAt;
      userTheme = client.theme;
    } else {
      if (contributor!.archivedAt) {
        return NextResponse.json({ error: "Your account has been deactivated. Contact your client for help." }, { status: 403 });
      }
      session = { id: contributor!.id, username: contributor!.username, displayName: contributor!.displayName, role: "contributor", tenantId: contributor!.tenantId };
      emailVerified = !!contributor!.emailVerifiedAt;
      twoFactorEnabled = !!contributor!.twoFactorEnabled;
      mustShow2faReminder = !!contributor!.mustShow2faReminder;
      walkthroughSeen = !!contributor!.walkthroughSeenAt;
      userTheme = contributor!.theme;
    }

    // If 2FA is enabled, issue a short-lived pending cookie and redirect to /two-factor
    if (twoFactorEnabled) {
      const pendingToken = await signToken(session, "5m");
      const response = NextResponse.json({ redirectTo: "/two-factor" });
      response.cookies.set("cms_2fa_pending", pendingToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: "lax",
        maxAge: 60 * 5,
        path: "/",
      });
      response.cookies.set("cms_theme", userTheme, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
      return response;
    }

    const token = await signToken(session);
    let redirectTo: string;
    if (mustShow2faReminder) {
      redirectTo = "/2fa-reminder";
    } else if (!emailVerified) {
      redirectTo = "/verify-email-notice";
    } else if (!walkthroughSeen) {
      redirectTo = "/walkthrough";
    } else {
      redirectTo = ROLE_HOME[session.role];
    }

    // First-time login: stamp lastSeenReleaseId so they don't see historical releases
    if (!user.lastSeenReleaseId) {
      prisma.release
        .findFirst({ where: { status: "published" }, orderBy: { publishedAt: "desc" }, select: { id: true } })
        .then((latest) => {
          if (!latest) return;
          if (owner)       return prisma.platformOwner.update({ where: { id: owner.id },           data: { lastSeenReleaseId: latest.id } });
          if (admin)       return prisma.adminIdentity.update({ where: { id: admin.id },           data: { lastSeenReleaseId: latest.id } });
          if (client)      return prisma.clientIdentity.update({ where: { id: client.id },         data: { lastSeenReleaseId: latest.id } });
          if (contributor) return prisma.contributor.update({ where: { id: contributor.id },       data: { lastSeenReleaseId: latest.id } });
        })
        .catch(() => {});
    }

    const response = NextResponse.json({ redirectTo });
    response.cookies.set("cms_session", token, {
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
    response.cookies.set("cms_theme", userTheme, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });

    return response;
  } catch (err) {
    console.error("[login]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
