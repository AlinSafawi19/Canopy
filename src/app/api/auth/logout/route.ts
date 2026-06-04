import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revokeSession } from "@/lib/session-management";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get("cms_session")?.value;

  if (token) {
    await revokeSession(token).catch(() => {});
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete("cms_session");
  response.cookies.delete("cms_csrf");
  response.cookies.delete("cms_2fa_pending");
  return response;
}
