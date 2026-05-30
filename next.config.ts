import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const CSP = [
  "default-src 'self'",
  // Next.js App Router injects inline hydration scripts — unsafe-inline required
  "script-src 'self' 'unsafe-inline'",
  // Tailwind and component inline styles
  "style-src 'self' 'unsafe-inline'",
  // Same-origin images + data URIs (QR codes) + GCS bucket (uploaded files)
  "img-src 'self' data: blob: https://storage.googleapis.com",
  "font-src 'self'",
  // All API calls go to same origin; no external fetch targets in client code
  "connect-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs", "googleapis"],

  async headers() {
    const headers = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      { key: "Content-Security-Policy", value: CSP },
    ];

    // HSTS only in production — setting it in dev forces HTTPS on localhost
    if (isProd) {
      headers.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }

    return [{ source: "/(.*)", headers }];
  },
};

export default nextConfig;
