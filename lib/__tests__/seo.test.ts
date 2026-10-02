import { afterEach, describe, expect, it, vi } from "vitest";
import sitemap from "../../app/sitemap";
import robots from "../../app/robots";
import { jsonLd, pageMetadata, SITE_URL } from "../seo";

vi.mock("../get-markets", () => ({ getMarkets: vi.fn(() => { throw new Error("SEO must not acquire markets"); }) }));
import { getMarkets } from "../get-markets";
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("crawlable product discovery", () => {
  it("serves durable HTTPS sitemap routes without acquisition or invented timestamps", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const entries = sitemap();
    expect(entries.map((entry) => entry.url)).toEqual([SITE_URL, `${SITE_URL}/pulse`, `${SITE_URL}/methodology`, `${SITE_URL}/research`]);
    expect(entries.every((entry) => !entry.lastModified)).toBe(true);
    expect(getMarkets).not.toHaveBeenCalled();
  });
  it("allows rendering resources while keeping other API paths disallowed", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const rules = robots().rules as { allow: string[]; disallow: string }[];
    expect(rules[0].disallow).toBe("/api/");
    expect(rules[0].allow).toContain("/api/bootstrap");
    expect(rules[0].allow).toContain("/api/indices");
    expect(rules[0].allow).not.toContain("/api/og");
    expect(robots().sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });
  it("withholds preview sitemaps and disallows preview crawling", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(sitemap()).toEqual([]);
    expect(robots().rules).toEqual([{ userAgent: "*", disallow: "/" }]);
  });
  it("uses the page URL in canonical and social metadata and escapes script content", () => {
    const meta = pageMetadata("Evidence", "Saved observations", "/research");
    expect(meta.alternates?.canonical).toBe("/research");
    expect(meta.openGraph).toMatchObject({ url: "/research", images: [{ url: "/social-card.png" }] });
    const payload = { name: "</script><script>untrusted</script>" };
    expect(jsonLd(payload)).not.toContain("<");
    expect(JSON.parse(jsonLd(payload))).toEqual(payload);
  });
});
