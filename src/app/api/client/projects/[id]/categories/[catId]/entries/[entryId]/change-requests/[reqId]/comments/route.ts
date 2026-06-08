import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string; catId: string; entryId: string; reqId: string }> };

async function getOwnedRequest(reqId: string, entryId: string, catId: string, projectId: string, clientId: string) {
  const assignment = await prisma.clientAssignment.findFirst({
    where: { projectId, clientId, archivedAt: null },
  });
  if (!assignment) return null;
  return prisma.changeRequest.findFirst({
    where: { id: reqId, entryId, categoryId: catId, projectId, authorId: clientId },
  });
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session || session.role !== "client") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId, catId, entryId, reqId } = await params;
  const cr = await getOwnedRequest(reqId, entryId, catId, projectId, session.id);
  if (!cr) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const comments = await prisma.changeRequestComment.findMany({
    where: { changeRequestId: reqId },
    orderBy: { createdAt: "asc" },
    select: { id: true, authorRole: true, authorName: true, body: true, createdAt: true },
  });

  return NextResponse.json({ comments });
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session || session.role !== "client") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId, catId, entryId, reqId } = await params;
  const cr = await getOwnedRequest(reqId, entryId, catId, projectId, session.id);
  if (!cr) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();
    const text = typeof body.body === "string" ? body.body.trim() : "";
    if (!text) return NextResponse.json({ error: "Body is required" }, { status: 400 });
    if (text.length > 2000) return NextResponse.json({ error: "Body must be 2000 characters or less" }, { status: 400 });

    const comment = await prisma.changeRequestComment.create({
      data: {
        changeRequestId: reqId,
        authorId: session.id,
        authorRole: "client",
        authorName: session.displayName,
        body: text,
      },
      select: { id: true, authorRole: true, authorName: true, body: true, createdAt: true },
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (err) {
    console.error("[client/change-request-comments POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
