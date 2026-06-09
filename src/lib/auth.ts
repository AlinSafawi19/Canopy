export type { SessionRole, SessionPayload } from "./auth-edge";
export { signToken, verifyToken, ROLE_HOME } from "./auth-edge";

import bcrypt from "bcryptjs";
import { cache } from "react";
import { isSessionValid } from "./session-management";
import type { SessionPayload } from "./auth-edge";

export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const token = cookieStore.get("cms_session")?.value;
  if (!token) return null;

  const { verifyToken } = await import("./auth-edge");
  const payload = await verifyToken(token);
  if (!payload) return null;

  try {
    const sessionValid = await isSessionValid(token);
    if (!sessionValid) return null;
  } catch {
    // If session check fails, allow through since JWT is still valid
  }

  return payload;
});

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
