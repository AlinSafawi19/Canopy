import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { hashApiKey } from "@/lib/api-key";

const API_KEY_PREFIX = "sk_live_";
const API_KEY_LENGTH = 32;
const API_KEY_EXPIRATION_DAYS = 365; // 1 year default

export function generateApiKey(): { key: string; prefix: string } {
  const randomBytes = crypto.randomBytes(API_KEY_LENGTH).toString("hex");
  const key = `${API_KEY_PREFIX}${randomBytes}`;
  const prefix = key.slice(0, 12); // sk_live_xxxx
  return { key, prefix };
}

export async function createApiKey(
  name: string,
  projectId: string,
  adminTenantId: string,
  expiresInDays: number = API_KEY_EXPIRATION_DAYS
): Promise<string> {
  const { key, prefix } = generateApiKey();
  const keyHash = hashApiKey(key);
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  await prisma.apiKey.create({
    data: {
      name,
      keyHash,
      keyPrefix: prefix,
      projectId,
      adminTenantId,
      expiresAt,
    },
  });

  return key;
}

export async function validateApiKey(
  key: string
): Promise<{
  valid: boolean;
  projectId?: string;
  reason?: string;
} | null> {
  const keyHash = hashApiKey(key);

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    select: { projectId, expiresAt, revokedAt },
  });

  if (!apiKey) {
    return { valid: false, reason: "API key not found" };
  }

  if (apiKey.revokedAt) {
    return { valid: false, reason: "API key has been revoked" };
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return { valid: false, reason: "API key has expired" };
  }

  return { valid: true, projectId: apiKey.projectId };
}

export async function revokeApiKey(keyHash: string): Promise<void> {
  await prisma.apiKey.update({
    where: { keyHash },
    data: { revokedAt: new Date() },
  });
}

export async function updateApiKeyLastUsed(keyHash: string): Promise<void> {
  await prisma.apiKey.update({
    where: { keyHash },
    data: { lastUsedAt: new Date() },
  });
}

export async function rotateApiKey(
  oldKeyHash: string,
  projectId: string,
  adminTenantId: string
): Promise<string> {
  // Get old key metadata
  const oldKey = await prisma.apiKey.findUnique({
    where: { keyHash: oldKeyHash },
    select: { name },
  });

  if (!oldKey) {
    throw new Error("API key not found");
  }

  // Create new key with same name
  const newKey = await createApiKey(`${oldKey.name} (rotated)`, projectId, adminTenantId);

  // Revoke old key
  await revokeApiKey(oldKeyHash);

  return newKey;
}

export async function cleanupExpiredApiKeys(): Promise<number> {
  const result = await prisma.apiKey.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
      revokedAt: { not: null },
    },
  });

  return result.count;
}
