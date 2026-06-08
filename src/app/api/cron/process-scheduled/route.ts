import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Called by a cron scheduler (Vercel Cron, external cron, etc.) or manually.
 * Protect with CRON_SECRET env var: Authorization: Bearer <secret>
 *
 * What it does:
 *  1. Publish entries: publishAt <= now AND archivedAt IS NOT NULL
 *     → skips if the entry has open change requests (approval gate)
 *  2. Archive entries: archiveAt <= now AND archivedAt IS NULL
 *  3. Pre-publish notifications: for entries with publishAt in the next 24h,
 *     create a change-request reminder if one doesn't already exist.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // ── 1. Publish due entries ──────────────────────────────────────────────────
  const toPublish = await prisma.contentCategoryEntry.findMany({
    where: {
      publishAt: { lte: now },
      archivedAt: { not: null },
    },
    select: { id: true, categoryId: true, category: { select: { projectId: true } } },
  });

  let published = 0;
  let skippedForApproval = 0;

  for (const entry of toPublish) {
    // Approval gate: skip if there are open change requests
    const openRequests = await prisma.changeRequest.count({
      where: { entryId: entry.id, resolvedAt: null },
    });
    if (openRequests > 0) {
      skippedForApproval++;
      continue;
    }

    await prisma.contentCategoryEntry.update({
      where: { id: entry.id },
      data: { archivedAt: null, archivedBy: null, publishAt: null },
    });
    published++;
  }

  // ── 2. Archive due entries ──────────────────────────────────────────────────
  const toArchive = await prisma.contentCategoryEntry.findMany({
    where: {
      archiveAt: { lte: now },
      archivedAt: null,
    },
    select: { id: true },
  });

  for (const entry of toArchive) {
    await prisma.contentCategoryEntry.update({
      where: { id: entry.id },
      data: { archivedAt: now, archivedBy: "system", archiveAt: null },
    });
  }

  // ── 3. Pre-publish notifications (24h window) ───────────────────────────────
  const upcomingPublish = await prisma.contentCategoryEntry.findMany({
    where: {
      publishAt: { gt: now, lte: in24h },
      archivedAt: { not: null },
    },
    select: { id: true, categoryId: true, publishAt: true, category: { select: { projectId: true } } },
  });

  let notificationsSent = 0;

  for (const entry of upcomingPublish) {
    // Check if a pre-publish change request already exists for this entry
    const existing = await prisma.changeRequest.findFirst({
      where: {
        entryId: entry.id,
        note: { startsWith: "[pre-publish]" },
      },
      select: { id: true },
    });
    if (existing) continue;

    const publishDate = entry.publishAt!.toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    });

    await prisma.changeRequest.create({
      data: {
        entryId: entry.id,
        categoryId: entry.categoryId,
        projectId: entry.category.projectId,
        authorId: "system",
        authorRole: "system",
        authorName: "System",
        note: `[pre-publish] This entry is scheduled to publish on ${publishDate}. Please review and resolve this request to allow publishing.`,
      },
    });
    notificationsSent++;
  }

  return NextResponse.json({
    ok: true,
    published,
    skippedForApproval,
    archived: toArchive.length,
    notificationsSent,
  });
}

/** Allow GET for easy manual triggering from the browser (dev only). */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Use POST" }, { status: 405 });
  }
  return POST(req);
}
