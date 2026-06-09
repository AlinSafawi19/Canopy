import crypto from "crypto";
import dns from "dns";
import { prisma } from "./prisma";

export type WebhookEvent = "entry.created" | "entry.updated" | "entry.archived";

export const ALL_WEBHOOK_EVENTS: WebhookEvent[] = [
  "entry.created",
  "entry.updated",
  "entry.archived",
];

interface WebhookPayload {
  event: WebhookEvent;
  categoryId: string;
  entryId: string;
  timestamp: string;
}

// RFC 1918, loopback, link-local, and other reserved IPv4 blocks
const BLOCKED_CIDRS_V4: { base: number; mask: number }[] = [
  { base: 0x7f000000, mask: 0xff000000 }, // 127.0.0.0/8   loopback
  { base: 0xa9fe0000, mask: 0xffff0000 }, // 169.254.0.0/16 link-local (AWS metadata)
  { base: 0x0a000000, mask: 0xff000000 }, // 10.0.0.0/8
  { base: 0xac100000, mask: 0xfff00000 }, // 172.16.0.0/12
  { base: 0xc0a80000, mask: 0xffff0000 }, // 192.168.0.0/16
  { base: 0x00000000, mask: 0xff000000 }, // 0.0.0.0/8
  { base: 0xe0000000, mask: 0xe0000000 }, // 224.0.0.0/3   multicast + reserved
];

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return true;
  const n = (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0);
  return BLOCKED_CIDRS_V4.some(({ base, mask }) => (n & mask) === base);
}

function isPrivateIPv6(ip: string): boolean {
  const addr = ip.toLowerCase();
  return (
    addr === "::1" ||
    // fe80::/10 link-local
    addr.startsWith("fe8") || addr.startsWith("fe9") ||
    addr.startsWith("fea") || addr.startsWith("feb") ||
    // fc00::/7 unique local
    addr.startsWith("fc") || addr.startsWith("fd")
  );
}

export async function validateWebhookUrl(url: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "Invalid URL";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "URL must use http or https";
  }

  const host = parsed.hostname;

  if (host === "localhost" || host.endsWith(".localhost")) {
    return "Webhook URL must point to a public host";
  }
  if (isPrivateIPv4(host) || isPrivateIPv6(host)) {
    return "Webhook URL must point to a public host";
  }

  let addresses: dns.LookupAddress[];
  try {
    addresses = await dns.promises.lookup(host, { all: true });
  } catch {
    return "Webhook URL hostname could not be resolved";
  }
  if (addresses.length === 0) return "Webhook URL hostname could not be resolved";

  for (const { address, family } of addresses) {
    if (family === 4 && isPrivateIPv4(address)) return "Webhook URL must point to a public host";
    if (family === 6 && isPrivateIPv6(address)) return "Webhook URL must point to a public host";
  }

  return null;
}

export function dispatchWebhooks(
  categoryId: string,
  event: WebhookEvent,
  entryId: string
): void {
  // Fire-and-forget — never awaited so the HTTP response is never delayed
  fireWebhooks(categoryId, event, entryId).catch(() => {});
}

async function fireWebhooks(
  categoryId: string,
  event: WebhookEvent,
  entryId: string
): Promise<void> {
  const webhooks = await prisma.webhook.findMany({
    where: { categoryId, enabled: true },
    select: { id: true, url: true, secret: true, events: true },
  });

  const payload: WebhookPayload = {
    event,
    categoryId,
    entryId,
    timestamp: new Date().toISOString(),
  };

  await Promise.all(
    webhooks
      .filter((wh) => Array.isArray(wh.events) && (wh.events as string[]).includes(event))
      .map((wh) => deliver(wh, payload))
  );
}

async function deliver(
  webhook: { id: string; url: string; secret: string },
  payload: WebhookPayload
): Promise<void> {
  const body = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", webhook.secret).update(body).digest("hex");

  let status = 0;
  try {
    const res = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": `sha256=${sig}`,
        "X-Webhook-Event": payload.event,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    status = res.status;
  } catch {
    status = 0;
  }

  await prisma.webhook
    .update({ where: { id: webhook.id }, data: { lastTriggeredAt: new Date(), lastStatus: status } })
    .catch(() => {});
}
