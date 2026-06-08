import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const TTL = 60; // seconds — re-set every 30s via keepalive

const COLORS = ["#3B82F6","#10B981","#8B5CF6","#EF4444","#F59E0B","#06B6D4","#EC4899","#F97316"];

export function presenceColor(userId: string): string {
  let h = 0;
  for (const c of userId) h = ((h * 31) + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

export function presenceInitials(name: string): string {
  return name.split(" ").map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase();
}

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
