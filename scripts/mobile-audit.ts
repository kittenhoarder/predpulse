import { chromium, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { navigationFixture } from "../lib/__tests__/fixtures/navigation";
import { T1 } from "../lib/__tests__/fixtures/fed-event";

export async function fixturePage(page: Page) {
  const snapshot = navigationFixture();
  await page.clock.setFixedTime(new Date(T1));
  await page.route("**/api/bootstrap", (route) =>
    route.fulfill({ json: snapshot }),
  );
  await page.route("**/api/markets?**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    const saved = params.get("sort") === "watchlist",
      ids = params.get("watchlist")?.split(",") ?? [];
    const markets = saved
      ? snapshot.markets.markets.filter(
          (m) => ids.includes(`${m.source}:${m.id}`) || ids.includes(m.id),
        )
      : snapshot.markets.markets;
    return route.fulfill({
      json: {
        ...snapshot.markets,
        markets,
        totalMarkets: saved ? markets.length : 75,
      },
    });
  });
  await page.route("**/api/news?**", (route) =>
    route.fulfill({
      json: {
        articles: [0, 1, 2].map((i) => ({
          title: `Economic policy proposal ${i + 1}: expectations shift before the decision`,
          url: `https://example.com/story-${i + 1}`,
          domain: "example.com",
          seendate: "20261002T120000Z",
          tone: i % 2 ? -2 : 2,
          summary:
            "A fixture headline for checking the complete newsroom layout.",
          image: "",
        })),
      },
    }),
  );
  await page.route("**/api/news", (route) =>
    route.fulfill({
      json: {
        articles: [0, 1, 2].map((i) => ({
          title: `Economic policy proposal ${i + 1}: expectations shift before the decision`,
          url: `https://example.com/story-${i + 1}`,
          domain: "example.com",
          seendate: "20261002T120000Z",
          tone: i % 2 ? -2 : 2,
          summary:
            "A fixture headline for checking the complete newsroom layout.",
          image: "",
        })),
      },
    }),
  );
  await page.route("**/api/metaculus?**", (route) =>
    route.fulfill({ json: { questions: [] } }),
  );
}
export interface AuditMeasurement {
  height: number;
  heightExcludingList: number;
  smallTargets: { label: string; width: number; height: number }[];
  smallText: { label: string; size: string }[];
  overflow: string[];
  horizontalOverflow: boolean;
}
export async function measure(page: Page): Promise<AuditMeasurement> {
  return page.evaluate(`(() => {
    const visible = (el) => { const box = el.getBoundingClientRect(), style = getComputedStyle(el); return box.width > 0 && box.height > 0 && style.visibility !== "hidden" && style.display !== "none" && !el.closest('[aria-hidden="true"]'); };
    const label = (el) => (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 100);
    const targets = Array.from(document.querySelectorAll('a,button,input,select,textarea,summary,[role="button"],[role="tab"]')).filter(visible).filter((el) => {
      const style = getComputedStyle(el);
      return !(el.tagName === "A" && style.display === "inline" && el.parentElement && ["P", "SPAN"].includes(el.parentElement.tagName));
    });
    const smallTargets = targets.filter((el) => { const rect = el.getBoundingClientRect(); return rect.width < 43.5 || rect.height < 43.5; }).map((el) => ({ label: label(el), width: Math.round(el.getBoundingClientRect().width), height: Math.round(el.getBoundingClientRect().height) }));
    const textSize = (el) => { const size = parseFloat(getComputedStyle(el).fontSize); const matrix = el instanceof SVGGraphicsElement ? el.getScreenCTM() : null; return matrix ? size * Math.hypot(matrix.a, matrix.b) : size; };
    const smallText = Array.from(document.querySelectorAll("body *")).filter(visible).filter((el) => {
      if (!Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())) return false;
      const style = getComputedStyle(el); return textSize(el) < 11.95 && style.textTransform !== "uppercase" && !el.closest('[data-axis]' );
    }).map((el) => ({ label: label(el), size: textSize(el).toFixed(2) + "px" }));
    const overflow = Array.from(document.querySelectorAll("body *")).filter(visible).filter((el) => {
      if (el.closest('[data-carousel],svg,[data-vaul-drawer]')) return false;
      const box = el.getBoundingClientRect(); return box.left < -1 || box.right > window.innerWidth + 1;
    }).map((el) => label(el)).slice(0, 20);
    const list = document.querySelector('[data-market-list]')?.getBoundingClientRect().height ?? 0;
    return { height: document.documentElement.scrollHeight, heightExcludingList: document.documentElement.scrollHeight - list, smallTargets, smallText, overflow, horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1 };
  })()`) as Promise<AuditMeasurement>;
}
async function run() {
  const origin = process.env.AUDIT_URL ?? "http://127.0.0.1:3100";
  const reportOnly = process.argv.includes("--report-only"),
    fixtures = process.argv.includes("--fixture");
  const routes = process.env.AUDIT_ROUTES?.split(",") ?? [
    "/",
    "/moves",
    "/outlooks",
    "/pulse",
    "/markets",
  ];
  const output = process.env.AUDIT_OUTPUT ?? ".predpulse/spec-010-audit.json";
  const browser = await chromium.launch(),
    results = [];
  try {
    for (const width of [320, 390, 412]) {
      const context = await browser.newContext({
        viewport: { width, height: 844 },
        isMobile: true,
        hasTouch: true,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      if (fixtures) await fixturePage(page);
      for (const route of routes) {
        const errors: string[] = [];
        const error = (value: Error) => errors.push(value.message);
        page.on("pageerror", error);
        const response = await page.goto(new URL(route, origin).href);
        await page.waitForLoadState("networkidle");
        const result = await measure(page),
          limit = route === "/" ? 4 * 844 : 5 * 844;
        const breaches = [
          ...(response?.ok() ? [] : [`HTTP ${response?.status()}`]),
          ...errors,
          ...(result.smallTargets.length
            ? [`${result.smallTargets.length} small targets`]
            : []),
          ...(result.smallText.length
            ? [`${result.smallText.length} small text runs`]
            : []),
          ...(result.overflow.length || result.horizontalOverflow
            ? ["horizontal overflow"]
            : []),
          ...(result.heightExcludingList > limit
            ? [`height ${result.heightExcludingList} > ${limit}`]
            : []),
        ];
        results.push({ width, route, ...result, breaches });
        console.log(
          `${breaches.length ? "FAIL" : "PASS"} ${width}px ${route}: ${result.heightExcludingList}px ${breaches.join("; ")}`,
        );
        page.off("pageerror", error);
      }
      await context.close();
    }
    await mkdir(output.slice(0, output.lastIndexOf("/")) || ".", {
      recursive: true,
    });
    await writeFile(
      output,
      JSON.stringify(
        {
          origin,
          fixtures,
          reportOnly,
          measuredAt: new Date().toISOString(),
          results,
        },
        null,
        2,
      ),
    );
    if (!reportOnly && results.some((result) => result.breaches.length))
      process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
if (process.argv[1]?.endsWith("mobile-audit.ts")) void run();
