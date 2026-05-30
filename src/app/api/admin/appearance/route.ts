import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_THEMES = ["auto", "light", "dark"];

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const { theme } = await request.json();
    if (!VALID_THEMES.includes(theme)) {
      return NextResponse.json({ error: "Invalid theme." }, { status: 400 });
    }
    await prisma.adminIdentity.update({ where: { id: session.id }, data: { theme } });
    const res = NextResponse.json({ ok: true });
    res.cookies.set("cms_theme", theme, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
    return res;
  } catch (err) {
    console.error("[admin/appearance PATCH]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
