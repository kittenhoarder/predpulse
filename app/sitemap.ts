import type { MetadataRoute } from "next";
import { getMarkets } from "@/lib/get-markets";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://predpulse.xyz";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let marketUrls: MetadataRoute.Sitemap = [];
  try {
    const { markets } = await getMarkets({ sort: "movers", category: "all", offset: 0 });
    marketUrls = markets
      .filter((m) => m.eventSlug && m.source === "polymarket")
      .map((m) => ({
        url: `${BASE_URL}/market/${m.eventSlug}`,
        lastModified: new Date(),
        changeFrequency: "hourly" as const,
        priority: 0.8,
      }));
  } catch {
    // Non-fatal: sitemap degrades gracefully to static routes only
  }

  return [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "always" as const, priority: 1 },
    { url: `${BASE_URL}/pulse`, lastModified: new Date(), changeFrequency: "always" as const, priority: 0.9 },
    ...marketUrls,
  ];
}
