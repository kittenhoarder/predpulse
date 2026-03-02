import type { CoinGeckoPricePoint } from "@/lib/types";
import { format } from "date-fns";

// Maps lowercase keywords found in market question text → CoinGecko coin ID
export const CRYPTO_COIN_MAP: Record<string, string> = {
  bitcoin: "bitcoin",
  btc: "bitcoin",
  ethereum: "ethereum",
  eth: "ethereum",
  solana: "solana",
  sol: "solana",
  xrp: "ripple",
  ripple: "ripple",
  dogecoin: "dogecoin",
  doge: "dogecoin",
  cardano: "cardano",
  ada: "cardano",
  avalanche: "avalanche-2",
  avax: "avalanche-2",
  chainlink: "chainlink",
  link: "chainlink",
  polkadot: "polkadot",
  dot: "polkadot",
};

// Detect which coin (if any) is referenced in a market question.
// Returns the CoinGecko coin ID, or null if no match.
export function detectCoinFromQuestion(question: string): string | null {
  const lower = question.toLowerCase();
  for (const [keyword, coinId] of Object.entries(CRYPTO_COIN_MAP)) {
    // Word-boundary match to avoid "link" matching "hyperlink"
    const pattern = new RegExp(`\\b${keyword}\\b`);
    if (pattern.test(lower)) return coinId;
  }
  return null;
}

// Returns a human-readable label for a CoinGecko coin ID
export function coinLabel(coinId: string): string {
  const labels: Record<string, string> = {
    bitcoin: "BTC",
    ethereum: "ETH",
    solana: "SOL",
    ripple: "XRP",
    dogecoin: "DOGE",
    cardano: "ADA",
    "avalanche-2": "AVAX",
    chainlink: "LINK",
    polkadot: "DOT",
  };
  return labels[coinId] ?? coinId.toUpperCase();
}

// Fetch 90-day daily price history for a CoinGecko coin ID.
// No API key required for the free /market_chart endpoint.
// Returns [] on any error — never throws.
export async function fetchCryptoPriceHistory(
  coinId: string
): Promise<CoinGeckoPricePoint[]> {
  const url =
    `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart` +
    `?vs_currency=usd&days=90&interval=daily`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const json = await res.json();

    // prices is an array of [timestamp_ms, price]
    const prices: [number, number][] = json?.prices ?? [];

    return prices.map(([ts, price]) => ({
      date: format(new Date(ts), "MMM d"),
      price: Math.round(price * 100) / 100,
    }));
  } catch {
    return [];
  }
}
