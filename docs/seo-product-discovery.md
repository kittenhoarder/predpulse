# SEO pass: product discovery

Production audit, 1 October 2026:

- `/pulse` emitted an HTTP canonical from `NEXT_PUBLIC_APP_URL`.
- New products were only described after a client API request; `/api/` was entirely disallowed in robots.txt.
- Event, comparison and research pages inherited the homepage canonical and title.
- The sitemap invoked `getMarkets`, used the request time as every URL's last modification date, and omitted research.
- General product pages had no share image. Market previews assumed the first outcome was a probability for the whole event.

## Changes

Use one public HTTPS origin for canonical, social, sitemap and structured data URLs. Give all public page families their own canonical, title and description. Research history query variants are noindex with the current research page as canonical. Preview builds are noindex and disallow crawling.

Add small, visible static descriptions of Belief Shift, Fed policy balance and Market Attention. A static methodology page explains their sources, sampling and limitations. These are the same for visitors and crawlers; no hidden search-only content, invented live statistics or accuracy claims. Keep `/pulse` as the existing canonical route rather than introducing a competing indices URL.

Use a checked-in 1200×630 PNG share image. The illustration contains no live quotes. `scripts/build-social-card.py` is an optional developer-only rebuild tool requiring Pillow and DejaVu fonts, not a deployment dependency. Use escaped JSON-LD for WebSite, methodology WebPage and market breadcrumbs. Remove the duplicate homepage breadcrumb masquerading as a category page.

## Compute

Home, indices, methodology, sitemap and robots remain static. Sitemap generation performs zero venue or Blob reads, and lists four durable routes. No invented `lastmod` values. The volatile bounded market selection is not a stable sitemap inventory.

Allow the rendering resources `/api/bootstrap`, `/api/indices` and existing `/api/og` through robots.txt. Other APIs remain disallowed; API responses carry `X-Robots-Tag: noindex`. Existing caching and polling remain unchanged.

Metadata and server-rendered event/comparison content share request-scoped React cache calls. Market metadata and content share the event acquisition, rather than fetching it twice. No new schedule, upstream acquisition, persistence, analytics or runtime image generation.

## Validation and remaining work

Check built HTML with JavaScript disabled: named products and methodology remain readable, page canonicals use HTTPS, social metadata references the static image, and sitemap/robots are static build outputs. Confirm preview noindex separately from production robots rules.

After deployment, Google Search Console URL Inspection and sitemap submission can verify Google's actual crawl and indexing. This change does not prove indexing, ranking or organic traffic improvement. Search Console ownership and search performance were not available in the connected tools.

References:
- https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
- https://developers.google.com/search/docs/crawling-indexing/robots/intro
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://nextjs.org/docs/14/app/building-your-application/optimizing/metadata
