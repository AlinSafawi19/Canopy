import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; keyId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "client") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, keyId } = await params;

  const assignment = await prisma.clientAssignment.findFirst({
    where: { projectId: id, clientId: session.id, archivedAt: null },
  });
  if (!assignment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await prisma.$executeRaw`
    DELETE FROM "ApiKey"
    WHERE id = ${keyId} AND "projectId" = ${id}
  `;

  if (result === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
