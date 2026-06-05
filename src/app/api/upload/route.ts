import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { Storage } from "@google-cloud/storage";
import { fileTypeFromBuffer } from "file-type";

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

    return NextResponse.json({
      url: `https://storage.googleapis.com/${bucketName}/${filename}`,
    });
  } catch (err) {
    console.error("[upload]", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const filename = url.slice(prefix.length);

  try {
    const credentials = JSON.parse(keyRaw);
    const storage = new Storage({ credentials });
    await storage.bucket(bucketName).file(filename).delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[upload DELETE]", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
