import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { Storage } from "@google-cloud/storage";
import { fileTypeFromBuffer } from "file-type";
import { prisma } from "@/lib/prisma";
import { parsePermissions } from "@/lib/contributor-permissions";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
};

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role === "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const bucketName = process.env.GOOGLE_CLOUD_BUCKET;
  const keyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!bucketName || !keyRaw) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 50 MB)" }, { status: 413 });
  }

  const projectId = (formData.get("projectId") as string | null) ?? undefined;

  if (session.role === "client") {
    if (!projectId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const assignment = await prisma.clientAssignment.findFirst({
      where: { projectId, clientId: session.id, archivedAt: null },
    });
    if (!assignment) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (session.role === "contributor") {
    if (!projectId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const assignment = await prisma.contributorAssignment.findFirst({
      where: { contributorId: session.id, projectId },
    });
    if (!assignment) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const perms = parsePermissions(assignment.permissions as unknown);
    if (!perms.canEditEntries && !perms.canCreateEntries) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileType = await fileTypeFromBuffer(buffer);

    if (!fileType || !ALLOWED_TYPES[fileType.mime]) {
      return NextResponse.json(
        { error: "File type not allowed. Allowed types: JPEG, PNG, GIF, WebP, PDF, MP4, WebM, MOV" },
        { status: 415 }
      );
    }

    const credentials = JSON.parse(keyRaw);
    const storage = new Storage({ credentials });
    const bucket = storage.bucket(bucketName);

    const ext = ALLOWED_TYPES[fileType.mime];
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

    const gcsFile = bucket.file(filename);
    await gcsFile.save(buffer, { metadata: { contentType: fileType.mime } });
    // Best-effort: make the object public. Fails silently on buckets with
    // uniform bucket-level access (public read is controlled via bucket IAM).
    await gcsFile.makePublic().catch(() => {});

    const url = `https://storage.googleapis.com/${bucketName}/${filename}`;

    await prisma.upload.create({
      data: { gcsUrl: url, uploadedBy: session.id, uploaderRole: session.role, projectId },
    });

    return NextResponse.json({ url });
  } catch (err) {
    console.error("[upload]", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role === "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const bucketName = process.env.GOOGLE_CLOUD_BUCKET;
  const keyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!bucketName || !keyRaw) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
  }

  const { url } = await request.json();
  const prefix = `https://storage.googleapis.com/${bucketName}/`;
  if (!url || !url.startsWith(prefix)) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const record = await prisma.upload.findUnique({ where: { gcsUrl: url } });
  if (!record) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const allowed = canDelete(session, record);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const filename = url.slice(prefix.length);

  try {
    const credentials = JSON.parse(keyRaw);
    const storage = new Storage({ credentials });
    await storage.bucket(bucketName).file(filename).delete();
    await prisma.upload.delete({ where: { gcsUrl: url } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[upload DELETE]", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}

function canDelete(
  session: { id: string; role: string },
  record: { uploadedBy: string }
): boolean {
  if (session.role === "owner") return false;
  return record.uploadedBy === session.id;
}
