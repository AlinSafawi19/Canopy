import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cache } from "react";
import { isSessionValid } from "./session-management";

const rawSecret = process.env.JWT_SECRET;
if (!rawSecret || rawSecret.length < 32) {
  throw new Error(
    `JWT_SECRET env var is required and must be at least 32 characters (got ${rawSecret ? rawSecret.length : 0})`
  );
}
const JWT_SECRET = new TextEncoder().encode(rawSecret);

export type SessionRole = "owner" | "admin" | "client" | "contributor";

export interface SessionPayload {
  id: string;
  username: string;
  displayName: string;
  role: SessionRole;
  tenantId?: string;
}

export async function signToken(payload: SessionPayload, expiresIn = "8h"): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(JWT_SECRET);
}

export async function verifyToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const token = cookieStore.get("cms_session")?.value;
  if (!token) return null;

  // Verify JWT is valid
  const payload = await verifyToken(token);
  if (!payload) return null;

  // Check if session has been explicitly revoked (e.g., after password change)
  try {
    const sessionValid = await isSessionValid(token);
    if (!sessionValid) return null;
  } catch {
    // If session check fails, allow through since JWT is still valid
    // This prevents lockouts during database issues
  }

  return payload;
});

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export const ROLE_HOME: Record<SessionRole, string> = {
  owner: "/owner/dashboard",
  admin: "/admin/dashboard",
  client: "/client/dashboard",
  contributor: "/contributor/dashboard",
};
