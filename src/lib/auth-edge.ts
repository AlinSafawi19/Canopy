import { SignJWT, jwtVerify } from "jose";

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

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export const ROLE_HOME: Record<SessionRole, string> = {
  owner: "/owner/dashboard",
  admin: "/admin/dashboard",
  client: "/client/dashboard",
  contributor: "/contributor/dashboard",
};
