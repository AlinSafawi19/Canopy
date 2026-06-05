import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const report = body?.["csp-report"] ?? body;
    console.warn("[CSP violation]", JSON.stringify(report));
  } catch {
    // malformed body — ignore
  }
  return new NextResponse(null, { status: 204 });
}
