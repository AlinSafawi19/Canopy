import { NextRequest, NextResponse } from "next/server";
import { verifyToken, ROLE_HOME, type SessionRole } from "@/lib/auth";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { validateApiKey, updateApiKeyLastUsed } from "@/lib/api-key-manager";
import { hashApiKey } from "@/lib/api-key";
import { isSessionValid } from "@/lib/session-management";

const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/signup",
  "/verify-email",
  "/verify-email-notice",
  "/two-factor",
  "/invite",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/signup",
  "/api/auth/two-factor",
  "/api/auth/send-verification",
  "/api/auth/verify-email",
  "/api/auth/invite",
];

// Paths accessible to any authenticated user regardless of role prefix
const AUTH_PATHS = ["/2fa-reminder", "/walkthrough"];

const ROLE_PREFIXES: Record<SessionRole, string> = {
  owner: "/owner",
  admin: "/admin",
  client: "/client",
  contributor: "/contributor",
};

function generateCsrfToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getClientIp(request);

  // ── Rate Limiting ────────────────────────────────────────────────────────────

  // Unauthenticated auth endpoints — rate limit by IP
  if (pathname === "/api/auth/login") {
    const { ok, retryAfter } = await rateLimit(`login:${ip}`, 15 * 60_000, 10);
    if (!ok) return rateLimitResponse(retryAfter);
  } else if (pathname === "/api/auth/signup") {
    const { ok, retryAfter } = await rateLimit(`signup:${ip}`, 60 * 60_000, 5);
    if (!ok) return rateLimitResponse(retryAfter);
  } else if (pathname === "/api/auth/forgot-password") {
    const { ok, retryAfter } = await rateLimit(`forgot:${ip}`, 15 * 60_000, 5);
    if (!ok) return rateLimitResponse(retryAfter);
  } else if (pathname === "/api/auth/reset-password") {
    const { ok, retryAfter } = await rateLimit(`reset:${ip}`, 15 * 60_000, 10);
    if (!ok) return rateLimitResponse(retryAfter);
  } else if (pathname === "/api/auth/two-factor") {
    const { ok, retryAfter } = await rateLimit(`2fa-login:${ip}`, 15 * 60_000, 10);
    if (!ok) return rateLimitResponse(retryAfter);

  // Public v1 API — validate API key and rate limit by API key (or IP when no key is present)
  } else if (pathname.startsWith("/api/v1/")) {
    const apiKey =
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
      request.nextUrl.searchParams.get("key") ??
      "";

    if (apiKey) {
      // Validate API key (checks expiration, revocation, etc.)
      const validation = await validateApiKey(apiKey);
      if (!validation || !validation.valid) {
        return NextResponse.json(
          { error: validation?.reason || "Invalid API key" },
          { status: 401 }
        );
      }

      // Update last used timestamp
      try {
        const keyHash = hashApiKey(apiKey);
        await updateApiKeyLastUsed(keyHash).catch(() => {});
      } catch {
        // Don't fail request if we can't update last used
      }
    }

    const rlKey = apiKey ? `v1:${apiKey}` : `v1-ip:${ip}`;
    const max = apiKey ? 60 : 10;
    const { ok, retryAfter } = await rateLimit(rlKey, 60_000, max);
    if (!ok) return rateLimitResponse(retryAfter);

  // Email verification — own bucket so it can't be exhausted by other auth ops.
  // 10 code attempts per 15 min is enough for legitimate use; prevents brute force.
  } else if (pathname === "/api/auth/verify-email") {
    const token = request.cookies.get("cms_session")?.value;
    let key = `verify-email:${ip}`;
    if (token) {
      const session = await verifyToken(token);
      if (session) key = `verify-email:${session.id}`;
    }
    const { ok, retryAfter } = await rateLimit(key, 15 * 60_000, 10);
    if (!ok) return rateLimitResponse(retryAfter);

  // Code sending — 5 per 15 min: resets quickly enough for legitimate resends
  // (page auto-sends on mount + user can resend if email is delayed).
  } else if (pathname === "/api/auth/send-verification") {
    const token = request.cookies.get("cms_session")?.value;
    let key = `send-verification:${ip}`;
    if (token) {
      const session = await verifyToken(token);
      if (session) key = `send-verification:${session.id}`;
    }
    const { ok, retryAfter } = await rateLimit(key, 15 * 60_000, 5);
    if (!ok) return rateLimitResponse(retryAfter);

  // Other auth endpoints (change-password, 2FA setup/confirm/disable,
  // 2fa-reminder/dismiss, walkthrough-complete, etc.)
  // Session required — prefer user ID; fall back to IP for unauthenticated calls.
  } else if (pathname.startsWith("/api/auth/")) {
    const token = request.cookies.get("cms_session")?.value;
    let key = `auth:${ip}`;
    if (token) {
      const session = await verifyToken(token);
      if (session) key = `auth:${session.id}`;
    }
    const { ok, retryAfter } = await rateLimit(key, 15 * 60_000, 40);
    if (!ok) return rateLimitResponse(retryAfter);

  // All other authenticated API routes
  } else if (pathname.startsWith("/api/")) {
    const token = request.cookies.get("cms_session")?.value;
    if (token) {
      const session = await verifyToken(token);
      if (session) {
        const isWrite = ["POST", "PATCH", "DELETE"].includes(request.method);
        // Profile endpoints get a dedicated tighter bucket
        const isProfileOp = /\/api\/(owner|admin|client|contributor)\/profile$/.test(pathname);
        // Account management routes (user creation / deletion) get a tighter hourly bucket
        const isAccountOp = /\/(clients|contributors|admins)(\/|$)/.test(pathname);

        let rlKey: string;
        let windowMs: number;
        let max: number;

        if (isProfileOp && isWrite) {
          rlKey = `profile:${session.id}`;
          windowMs = 60 * 60_000; // 1 hour
          max = 10;
        } else if (isAccountOp && isWrite) {
          rlKey = `acct:${session.id}`;
          windowMs = 60 * 60_000; // 1 hour
          max = 20;
        } else if (isWrite) {
          rlKey = `write:${session.id}`;
          windowMs = 60_000; // 1 minute
          max = 100;
        } else {
          rlKey = `read:${session.id}`;
          windowMs = 60_000; // 1 minute
          max = 200;
        }

        const { ok, retryAfter } = await rateLimit(rlKey, windowMs, max);
        if (!ok) return rateLimitResponse(retryAfter);
      }
    }
  }

  // ── CSRF Protection ──────────────────────────────────────────────────────────
  // Validate X-CSRF-Token header for authenticated API mutations.
  // Public auth paths and the key-authenticated v1 API are exempt.
  if (
    ["POST", "PUT", "PATCH", "DELETE"].includes(request.method) &&
    pathname.startsWith("/api/") &&
    !PUBLIC_PATHS.some((p) => pathname.startsWith(p)) &&
    !pathname.startsWith("/api/v1/")
  ) {
    const csrfCookie = request.cookies.get("cms_csrf")?.value;
    const csrfHeader = request.headers.get("X-CSRF-Token");
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      return NextResponse.json({ error: "CSRF token invalid" }, { status: 403 });
    }
  }

  // ── Existing auth / routing logic ────────────────────────────────────────────

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const token = request.cookies.get("cms_session")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const session = await verifyToken(token);

  if (!session) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("cms_session");
    return response;
  }

  // Check if session has been revoked (e.g., password change, logout)
  const sessionValid = await isSessionValid(token).catch(() => false);
  if (!sessionValid) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("cms_session");
    return response;
  }

  const allowedPrefix = ROLE_PREFIXES[session.role];
  const needsCsrf = !request.cookies.get("cms_csrf")?.value;
  const csrfSecure = request.headers.get("x-forwarded-proto") === "https";

  function withCsrf(resp: NextResponse): NextResponse {
    if (needsCsrf) {
      resp.cookies.set("cms_csrf", generateCsrfToken(), {
        httpOnly: false,
        secure: csrfSecure,
        sameSite: "lax",
        maxAge: 60 * 60 * 8,
        path: "/",
      });
    }
    return resp;
  }

  if (pathname === "/") {
    return withCsrf(NextResponse.redirect(new URL(ROLE_HOME[session.role], request.url)));
  }

  if (AUTH_PATHS.some((p) => pathname.startsWith(p))) {
    return withCsrf(NextResponse.next());
  }

  if (!pathname.startsWith(allowedPrefix)) {
    return withCsrf(NextResponse.redirect(new URL(ROLE_HOME[session.role], request.url)));
  }

  return withCsrf(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|favicon.svg|public/).*)"],
};
