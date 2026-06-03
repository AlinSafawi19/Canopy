import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendReleaseEmails } from "@/lib/release-emails";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { version, title, notes, status = "draft" } = await request.json();

    if (!version?.trim() || !title?.trim() || !notes?.trim()) {
      return NextResponse.json(
        { error: "version, title, and notes are required." },
        { status: 400 }
      );
    }

    const publish = status === "published";

    const release = await prisma.release.create({
      data: {
        version: version.trim(),
        title: title.trim(),
        notes: notes.trim(),
        status: publish ? "published" : "draft",
        publishedAt: publish ? new Date() : null,
        createdBy: session.id,
      },
    });

    if (publish) {
      sendReleaseEmails(release).catch((err) =>
        console.error("[releases] broadcast failed:", err)
      );
    }

    return NextResponse.json({ ok: true, id: release.id });
  } catch (err) {
    console.error("[releases POST]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const releases = await prisma.release.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(releases);
  } catch (err) {
    console.error("[releases GET]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
