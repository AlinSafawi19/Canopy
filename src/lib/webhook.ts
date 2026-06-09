import crypto from "crypto";
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
      .filter((wh) => {
        const events = wh.events as string[];
        return Array.isArray(events) && events.includes(event);
      })
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
