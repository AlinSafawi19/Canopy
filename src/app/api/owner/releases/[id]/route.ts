import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendReleaseEmails } from "@/lib/release-emails";
import { sanitizeReleaseNotes } from "@/lib/sanitize";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  try {
    const existing = await prisma.release.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const wasPublished = existing.status === "published";
    const newStatus: string = body.status ?? existing.status;
    const isPublishing = !wasPublished && newStatus === "published";

    const updated = await prisma.release.update({
      where: { id },
      data: {
        ...(body.version !== undefined && { version: body.version.trim() }),
        ...(body.title   !== undefined && { title:   body.title.trim()   }),
        ...(body.notes   !== undefined && { notes:   sanitizeReleaseNotes(body.notes) }),
        status: newStatus,
        ...(isPublishing && { publishedAt: new Date() }),
        ...(newStatus === "draft" && wasPublished && { publishedAt: null }),
      },
    });

    // Send emails only when transitioning to published for the first time
    if (isPublishing) {
      sendReleaseEmails(updated).catch((err) =>
        console.error("[releases] broadcast failed:", err)
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[releases/:id PATCH]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  try {
    await prisma.release.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[releases/:id DELETE]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
