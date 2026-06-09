import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LIMITS, maxLen } from "@/lib/limits";
import { ALL_WEBHOOK_EVENTS, validateWebhookUrl } from "@/lib/webhook";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; catId: string; webhookId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: projectId, catId, webhookId } = await params;

  const webhook = await prisma.webhook.findFirst({
    where: {
      id: webhookId,
      categoryId: catId,
      category: { projectId, project: { adminTenantId: session.tenantId! } },
    },
  });
  if (!webhook) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();

    // Toggle enabled only
    if (typeof body.enabled === "boolean" && Object.keys(body).length === 1) {
      await prisma.webhook.update({ where: { id: webhookId }, data: { enabled: body.enabled } });
      return NextResponse.json({ ok: true });
    }

    const { name, url, events, enabled } = body;

    if (name !== undefined && !name?.trim())
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (url !== undefined) {
      if (!url?.trim()) return NextResponse.json({ error: "URL is required" }, { status: 400 });
      const urlErr = await validateWebhookUrl(url.trim());
      if (urlErr) return NextResponse.json({ error: urlErr }, { status: 400 });
    }

    const lenErr = maxLen(name, LIMITS.WEBHOOK_NAME, "Name") ?? maxLen(url, LIMITS.WEBHOOK_URL, "URL");
    if (lenErr) return NextResponse.json({ error: lenErr }, { status: 400 });

    const selectedEvents = Array.isArray(events)
      ? events.filter((e): e is string => ALL_WEBHOOK_EVENTS.includes(e as never))
      : undefined;

    if (selectedEvents !== undefined && selectedEvents.length === 0)
      return NextResponse.json({ error: "At least one event must be selected" }, { status: 400 });

    await prisma.webhook.update({
      where: { id: webhookId },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(url ? { url: url.trim() } : {}),
        ...(selectedEvents ? { events: selectedEvents } : {}),
        ...(typeof enabled === "boolean" ? { enabled } : {}),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/categories/:catId/webhooks/:webhookId PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; catId: string; webhookId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: projectId, catId, webhookId } = await params;

  const webhook = await prisma.webhook.findFirst({
    where: {
      id: webhookId,
      categoryId: catId,
      category: { projectId, project: { adminTenantId: session.tenantId! } },
    },
  });
  if (!webhook) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.webhook.delete({ where: { id: webhookId } });
  return NextResponse.json({ ok: true });
}
