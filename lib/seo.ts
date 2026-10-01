import type { Metadata } from "next";

// Canonicals always identify the public HTTPS site, including on preview builds.
export const SITE_URL = "https://predpulse.xyz";
export const SITE_DESCRIPTION = "Explore prediction market indices, market attention and changing expectations, with hourly snapshots across Polymarket, Kalshi and Manifold.";
export const SITE_ROBOTS: Metadata["robots"] = process.env.VERCEL_ENV === "preview"
  ? { index: false, follow: false }
  : { index: true, follow: true };

export function pageMetadata(title: string, description: string, path: string): Metadata {
  return {
    title, description,
    alternates: { canonical: path },
    openGraph: { title, description, type: "website", url: path, siteName: "Predpulse",
      images: [{ url: "/social-card.png", width: 1200, height: 630, alt: "Predpulse: prediction market indices, movement and attention" }] },
    twitter: { card: "summary_large_image", title, description, images: ["/social-card.png"] },
  };
}

export function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
