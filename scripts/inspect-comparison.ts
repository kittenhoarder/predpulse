import { fetchWithTimeout } from "../lib/fetch-utils";
import { hashRules } from "../lib/venue-comparisons";
import { kalshiRuleText, polymarketRuleText } from "../lib/venue-comparison-publisher";

// Review aid only. Print the raw settlement inputs and fingerprints for two
// exact market IDs. A reviewer must compare full venue terms, including linked
// sources, before proposing a registry entry; this script never approves pairs.
async function inspect(source: "polymarket" | "kalshi", id: string) {
  const base = source === "kalshi"
    ? "https://api.elections.kalshi.com/trade-api/v2/markets/"
    : "https://gamma-api.polymarket.com/markets/";
  const res = await fetchWithTimeout(`${base}${encodeURIComponent(id)}`, undefined, 8_000);
  if (!res.ok) throw new Error(`${source} ${id}: HTTP ${res.status}`);
  const raw = await res.json() as Record<string, unknown>;
  const market = source === "kalshi" ? raw.market as Record<string, unknown> : raw;
  if (!market) throw new Error(`${source} ${id}: no market`);
  const ruleText = source === "kalshi" ? kalshiRuleText(market) : polymarketRuleText(market);
  console.log(JSON.stringify({ source, id, rulesHash: hashRules(ruleText), ruleInputs: JSON.parse(ruleText),
    outcomeIds: source === "kalshi" ? ["YES", "NO"] : market.clobTokenIds,
    status: market.status ?? { active: market.active, closed: market.closed },
  }, null, 2));
}

async function main() {
  const [polymarketId, kalshiTicker] = process.argv.slice(2);
  if (!polymarketId || !kalshiTicker) throw new Error("Usage: npm run inspect:comparison -- <polymarket-market-id> <kalshi-ticker>");
  await inspect("polymarket", polymarketId);
  await inspect("kalshi", kalshiTicker);
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
