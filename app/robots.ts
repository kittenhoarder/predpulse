import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  if (process.env.VERCEL_ENV === "preview") return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: ["/", "/api/bootstrap", "/api/indices"], disallow: "/api/" }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
