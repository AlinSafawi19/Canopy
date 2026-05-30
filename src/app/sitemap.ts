import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/login`, priority: 1.0 },
    { url: `${BASE}/signup`, priority: 0.8 },
    { url: `${BASE}/forgot-password`, priority: 0.5 },
    { url: `${BASE}/reset-password`, priority: 0.5 },
  ];
}
