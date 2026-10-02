import { expect, test } from "@playwright/test";
import { fixturePage, measure } from "../../scripts/mobile-audit";

test.beforeEach(async ({ page }) => {
  await fixturePage(page);
});
test("desktop Explore routes, Escape and static methods", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore Predpulse", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Explore navigation" }),
  ).toBeVisible();
  await expect(page.getByText("Top move +18.0 pp")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Explore Predpulse", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "About Moves" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close Moves", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const context = await page
    .context()
    .browser()!
    .newContext({ javaScriptEnabled: false });
  const staticPage = await context.newPage();
  await staticPage.goto("/methodology");
  await expect(
    staticPage.getByRole("heading", {
      name: "Fed policy balance",
      exact: true,
    }),
  ).toBeVisible();
  await staticPage.goto("/pulse");
  await expect(
    staticPage.getByText("You can compare how much expectations moved", {
      exact: false,
    }),
  ).toBeVisible();
  await context.close();
});
test("direct Guide dismissal stays on the page and preserves filters", async ({
  page,
}) => {
  await page.goto("/markets?sort=watchlist&guide=belief-shift#market-list");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("button", { name: "Close Belief Shift", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(page.url()).toContain("/markets?sort=watchlist#market-list");
});
test("mobile menu to Guide replaces history; Back and Forward restore sheets", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore Predpulse", exact: true })
    .click();
  expect(new URL(page.url()).search).toBe("");
  await page.getByRole("button", { name: /How Predpulse works/ }).click();
  await expect(
    page.getByRole("dialog", { name: "How Predpulse works", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goForward();
  await expect(
    page.getByRole("dialog", { name: "How Predpulse works", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close How Predpulse works", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("mobile menu navigation does not leave an abandoned menu in history", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore Predpulse", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Pillars" })
    .getByRole("link", { name: "Moves", exact: true })
    .click();
  await expect(page).toHaveURL(/\/moves$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("mobile index, child evidence, raw toggle and Back restore the index", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/pulse");
  await page.getByRole("button", { name: /Fed policy balance/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Fed policy balance", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Raw", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Raw", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Index evidence", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Index evidence", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("dialog", { name: "Fed policy balance", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close Fed policy balance", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(new URL(page.url()).search).toBe("");
});
test("mobile market list expands and Saved deep link applies", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/markets");
  const expand = page.getByRole("button", { name: /^Expand Will/ }).first();
  await expand.click();
  await expect(expand).toHaveAttribute("aria-expanded", "true");
  await page
    .getByRole("button", { name: /^Save Will/ })
    .first()
    .click();
  await page.goto("/markets?sort=watchlist");
  await expect(
    page.getByRole("tab", { name: "Watchlist", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: /^Expand Will/ })).toHaveCount(
    1,
  );
  expect((await measure(page)).horizontalOverflow).toBe(false);
});

test("Guide focus stays inside and returns to its opener", async ({ page }) => {
  await page.goto("/moves");
  const opener = page
    .getByRole("button", { name: "About Moves", exact: true })
    .first();
  await opener.click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Moves", exact: true }),
  ).toBeFocused();
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("direct index reload and nested evidence preserve index scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/pulse?index=fed-policy-balance");
  await page.reload();
  let dialog = page.getByRole("dialog", {
    name: "Fed policy balance",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  const scroll = dialog.locator("[data-sheet-scroll]");
  await scroll.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  const before = await scroll.evaluate((el) => el.scrollTop);
  expect(before).toBeGreaterThan(0);
  await dialog
    .getByRole("button", { name: "Index evidence", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Index evidence", exact: true }),
  ).toBeVisible();
  await page.goBack();
  dialog = page.getByRole("dialog", {
    name: "Fed policy balance",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect
    .poll(() =>
      dialog.locator("[data-sheet-scroll]").evaluate((el) => el.scrollTop),
    )
    .toBeGreaterThan(0);
  await expect(
    dialog.getByRole("button", { name: "Index evidence", exact: true }),
  ).toBeFocused();
  await dialog
    .getByRole("button", { name: "Close Fed policy balance", exact: true })
    .click();
  await expect(page).toHaveURL(/\/pulse$/);
});

test("unknown sheet ids are removed without losing page filters", async ({
  page,
}) => {
  await page.goto(
    "/markets?sort=watchlist&guide=unknown&index=unknown#market-list",
  );
  await expect(page).toHaveURL(/\/markets\?sort=watchlist#market-list$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("one publication cache ages without refetch and retains data after errors", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/api/bootstrap", async (route) => {
    requests++;
    if (requests > 1)
      return route.fulfill({ status: 503, json: { error: "offline" } });
    const { navigationFixture } =
      await import("../../lib/__tests__/fixtures/navigation");
    return route.fulfill({ json: navigationFixture() });
  });
  const { T1 } = await import("../../lib/__tests__/fixtures/fed-event");
  await page.clock.install({ time: new Date(T1) });
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^Updated ·/ })).toBeVisible();
  await page
    .getByRole("button", { name: "Explore Predpulse", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Indices", exact: true })
    .click();
  await expect(page).toHaveURL(/\/pulse$/);
  expect(requests).toBe(1);
  await page.clock.runFor(301_000);
  await expect.poll(() => requests).toBe(2);
  await expect(page.getByRole("button", { name: /^Updated ·/ })).toBeVisible();
  await page.clock.setSystemTime(new Date(Date.parse(T1) + 76 * 60_000));
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await expect(page.getByRole("button", { name: /^Delayed ·/ })).toBeVisible();
  await page.clock.setSystemTime(new Date(Date.parse(T1) + 181 * 60_000));
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await expect(
    page.getByRole("button", { name: /^Last known ·/ }),
  ).toBeVisible();
});

test("loading and unavailable freshness have distinct accessible states", async ({
  page,
}) => {
  let finish: (() => void) | undefined;
  await page.route("**/api/bootstrap", async (route) => {
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    await route.fulfill({ status: 503, json: { error: "offline" } });
  });
  await page.goto("/methodology");
  await expect(
    page.getByRole("button", { name: "Loading snapshot status", exact: true }),
  ).toBeVisible();
  finish!();
  await expect(
    page.getByRole("button", { name: "Snapshot unavailable", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "How it works", exact: true }),
  ).toBeVisible();
});

test("rapid dismissal consumes only one owned history entry", async ({
  page,
}) => {
  await page.goto("/moves");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Outlooks", exact: true })
    .click();
  await expect(page).toHaveURL(/\/outlooks$/);
  await page
    .getByRole("button", { name: "About Outlooks", exact: true })
    .first()
    .click();
  const close = page.getByRole("button", {
    name: "Close Outlooks",
    exact: true,
  });
  await close.evaluate((el) => {
    (el as HTMLButtonElement).click();
    (el as HTMLButtonElement).click();
  });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/outlooks$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/moves$/);
});

test("mobile sheets and expanded rows meet target and type budgets", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  const check = async () => {
    const result = await measure(page);
    expect(result.smallTargets).toEqual([]);
    expect(result.smallText).toEqual([]);
    expect(result.horizontalOverflow).toBe(false);
  };
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore Predpulse", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await check();
  await page.getByRole("button", { name: /How Predpulse works/ }).click();
  await expect(
    page.getByRole("dialog", { name: "How Predpulse works", exact: true }),
  ).toBeVisible();
  await check();
  await page.goto("/pulse?index=fed-policy-balance");
  await expect(page.getByRole("dialog")).toBeVisible();
  await check();
  await page
    .getByRole("button", { name: "Index evidence", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Index evidence", exact: true }),
  ).toBeVisible();
  await check();
  await page.goto("/markets");
  await page
    .getByRole("button", { name: /^Expand Will/ })
    .first()
    .click();
  await check();
});
