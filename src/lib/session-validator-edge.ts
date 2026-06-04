import { prisma } from "@/lib/prisma";

async function hashTokenEdge(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function isSessionValid(token: string): Promise<boolean> {
  const tokenHash = await hashTokenEdge(token);
  const session = await prisma.session.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
    },
  });
  return session !== null;
}
