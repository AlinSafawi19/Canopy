import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isSecure = request.headers.get("x-forwarded-proto") === "https";
  const response = NextResponse.json({ ok: true });
  response.cookies.set("cms_csrf", crypto.randomBytes(32).toString("hex"), {
    httpOnly: false,
    secure: isSecure,
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
    path: "/",
  });
  return response;
}
