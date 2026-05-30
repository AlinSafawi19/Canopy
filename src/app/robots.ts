import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/login", "/signup", "/forgot-password", "/reset-password"],
        disallow: [
          "/owner/",
          "/admin/",
          "/client/",
          "/contributor/",
          "/api/",
          "/change-password",
          "/two-factor",
          "/2fa-reminder",
          "/verify-email",
          "/verify-email-notice",
        ],
      },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/sitemap.xml`,
  };
}
