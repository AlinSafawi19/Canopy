import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

function generateCSP(nonce?: string): string {
  const nonceAttr = nonce ? ` 'nonce-${nonce}'` : " 'unsafe-inline'";

  return [
    "default-src 'self'",
    // Next.js App Router: use nonce for inline hydration scripts when available
    `script-src 'self'${nonceAttr}`,
    // Tailwind and component inline styles with nonce
    `style-src 'self'${nonceAttr}`,
    // Same-origin + GCS uploads + data URIs (QR codes)
    // Restrict to HTTPS only in production
    isProd
      ? "img-src 'self' data: blob: https://storage.googleapis.com"
      : "img-src 'self' data: blob: https: http:",
    // Video backgrounds
    isProd
      ? "media-src 'self' blob: https://storage.googleapis.com"
      : "media-src 'self' blob: https: http:",
    "font-src 'self'",
    // All API calls go to same origin
    "connect-src 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // CSP violation reporting
    "report-uri /api/csp-report",
    // Upgrade insecure requests in production
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs", "googleapis"],

  async headers() {
    const headers = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      { key: "Content-Security-Policy", value: generateCSP() },
    ];

    // HSTS only in production
    if (isProd) {
      headers.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
      // Additional production-only headers
      headers.push({
        key: "Cross-Origin-Opener-Policy",
        value: "same-origin",
      });
      headers.push({
        key: "Cross-Origin-Embedder-Policy",
        value: "require-corp",
      });
    }

    return [{ source: "/(.*)", headers }];
  },
};

export default nextConfig;
