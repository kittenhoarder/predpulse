import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Durable routes only. Crawling a sitemap must never acquire venue data.
export default function sitemap(): MetadataRoute.Sitemap {
  if (process.env.VERCEL_ENV === "preview") return [];
  return [
    "",
    "/moves",
    "/outlooks",
    "/pulse",
    "/markets",
    "/methodology",
    "/research",
  ].map((path) => ({ url: `${SITE_URL}${path}` }));
}
