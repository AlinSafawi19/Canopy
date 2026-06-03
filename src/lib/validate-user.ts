import { prisma } from "@/lib/prisma";
import type { SessionRole } from "@/lib/auth";

/**
 * Validates that a user still exists in the database and hasn't been deleted.
 * Returns the user if valid, null if deleted/not found.
 * Used in layouts and APIs to handle mid-session user deletion/archival.
 */
export async function validateUserStillExists(
  userId: string,
  role: SessionRole
): Promise<{ id: string } | null> {
  try {
    if (role === "owner") {
      return await prisma.platformOwner.findUnique({
        where: { id: userId },
        select: { id: true },
      });
    } else if (role === "admin") {
      return await prisma.adminIdentity.findUnique({
        where: { id: userId },
        select: { id: true },
      });
    } else if (role === "client") {
      return await prisma.clientIdentity.findUnique({
        where: { id: userId },
        select: { id: true },
      });
    } else if (role === "contributor") {
      return await prisma.contributor.findUnique({
        where: { id: userId },
        select: { id: true },
      });
    }
    return null;
  } catch {
    return null;
  }
}
