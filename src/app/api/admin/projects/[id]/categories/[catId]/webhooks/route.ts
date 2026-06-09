import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LIMITS, maxLen } from "@/lib/limits";
import { ALL_WEBHOOK_EVENTS, validateWebhookUrl } from "@/lib/webhook";
import crypto from "crypto";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; catId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: projectId, catId } = await params;

  const category = await prisma.contentCategory.findFirst({
    where: { id: catId, projectId, project: { adminTenantId: session.tenantId! } },
  });
  if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const webhooks = await prisma.webhook.findMany({
    where: { categoryId: catId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      url: true,
      events: true,
      enabled: true,
      createdAt: true,
      lastTriggeredAt: true,
      lastStatus: true,
    },
  });

  return NextResponse.json({ webhooks });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; catId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: projectId, catId } = await params;

  const category = await prisma.contentCategory.findFirst({
    where: { id: catId, projectId, project: { adminTenantId: session.tenantId! } },
  });
  if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const { name, url, events } = await request.json();

    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!url?.trim()) return NextResponse.json({ error: "URL is required" }, { status: 400 });
    const urlErr = await validateWebhookUrl(url.trim());
    if (urlErr) return NextResponse.json({ error: urlErr }, { status: 400 });

    const lenErr = maxLen(name, LIMITS.WEBHOOK_NAME, "Name") ?? maxLen(url, LIMITS.WEBHOOK_URL, "URL");
    if (lenErr) return NextResponse.json({ error: lenErr }, { status: 400 });

    const selectedEvents = Array.isArray(events)
      ? events.filter((e): e is string => ALL_WEBHOOK_EVENTS.includes(e as never))
      : [...ALL_WEBHOOK_EVENTS];

    if (selectedEvents.length === 0)
      return NextResponse.json({ error: "At least one event must be selected" }, { status: 400 });

    const secret = `whsec_${crypto.randomBytes(24).toString("hex")}`;

    const webhook = await prisma.webhook.create({
      data: {
        categoryId: catId,
        name: name.trim(),
        url: url.trim(),
        secret,
        events: selectedEvents,
        enabled: true,
      },
    });

    return NextResponse.json({ id: webhook.id, secret }, { status: 201 });
  } catch (err) {
    console.error("[admin/categories/:catId/webhooks POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
