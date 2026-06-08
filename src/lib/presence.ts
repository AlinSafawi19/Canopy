import { Redis } from "@upstash/redis";
import { presenceColor } from "./presence-client";
export { presenceColor, presenceInitials } from "./presence-client";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const TTL = 60; // seconds — re-set every 30s via keepalive

function presenceKey(catId: string, entryId: string, userId: string) {
  return `pres:${catId}:${entryId}:${userId}`;
}

export async function setPresence(catId: string, entryId: string, userId: string, name: string) {
  await redis.set(presenceKey(catId, entryId, userId), name, { ex: TTL });
}

export async function deletePresence(catId: string, entryId: string, userId: string) {
  await redis.del(presenceKey(catId, entryId, userId));
}

export async function getCategoryPresence(
  catId: string
): Promise<Record<string, { userId: string; name: string; color: string }[]>> {
  const keys = await redis.keys(`pres:${catId}:*`);
  if (!keys.length) return {};

  const values = await redis.mget<(string | null)[]>(...(keys as string[]));
  const result: Record<string, { userId: string; name: string; color: string }[]> = {};

  (keys as string[]).forEach((k, i) => {
    const name = values[i];
    if (!name) return;
    // key format: pres:{catId}:{entryId}:{userId}
    const withoutPrefix = k.slice("pres:".length + catId.length + 1); // "{entryId}:{userId}"
    const colonIdx = withoutPrefix.indexOf(":");
    if (colonIdx === -1) return;
    const entryId = withoutPrefix.slice(0, colonIdx);
    const userId = withoutPrefix.slice(colonIdx + 1);
    if (!result[entryId]) result[entryId] = [];
    result[entryId].push({ userId, name, color: presenceColor(userId) });
  });

  return result;
}
