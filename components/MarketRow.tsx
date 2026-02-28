import type { ProcessedMarket } from "@/lib/types";

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatChange(change: number): string {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}pp`;
}

interface MarketRowProps {
  market: ProcessedMarket;
  rank: number;
}

export default function MarketRow({ market, rank }: MarketRowProps) {
  const isPositive = market.oneDayChange >= 0;
  const isNeutral = market.oneDayChange === 0;

  const changeColor = isNeutral
    ? "text-gray-400"
    : isPositive
      ? "text-emerald-400"
      : "text-red-400";

  const changeBg = isNeutral
    ? "bg-gray-800"
    : isPositive
      ? "bg-emerald-950/60"
      : "bg-red-950/60";

  const polymarketUrl = `https://polymarket.com/event/${market.eventSlug}`;

  return (
    <tr className="border-b border-gray-800/60 hover:bg-gray-900/40 transition-colors group">
      {/* Rank */}
      <td className="px-4 py-3 text-gray-600 text-sm tabular-nums w-10">
        {rank}
      </td>

      {/* Market question */}
      <td className="px-4 py-3 max-w-xs">
        <a
          href={polymarketUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-100 text-sm font-medium leading-snug hover:text-indigo-300 transition-colors line-clamp-2"
          title={market.question}
        >
          {market.question}
        </a>
        <div className="flex flex-wrap gap-1 mt-1">
          {market.categories.slice(0, 2).map((cat) => (
            <span
              key={cat}
              className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700/50"
            >
              {cat}
            </span>
          ))}
        </div>
      </td>

      {/* Current Yes price */}
      <td className="px-4 py-3 tabular-nums text-sm text-right">
        <span className="font-semibold text-gray-100">
          {market.currentPrice.toFixed(1)}%
        </span>
      </td>

      {/* 24h change */}
      <td className="px-4 py-3 tabular-nums text-sm text-right">
        <span
          className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${changeColor} ${changeBg}`}
        >
          {formatChange(market.oneDayChange)}
        </span>
      </td>

      {/* 24h volume */}
      <td className="px-4 py-3 tabular-nums text-sm text-right text-gray-400">
        {formatCurrency(market.volume24h)}
      </td>

      {/* Liquidity */}
      <td className="px-4 py-3 tabular-nums text-sm text-right text-gray-400">
        {formatCurrency(market.liquidity)}
      </td>

      {/* Action */}
      <td className="px-4 py-3 text-right">
        <a
          href={polymarketUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors opacity-0 group-hover:opacity-100"
          aria-label={`Open ${market.question} on Polymarket`}
        >
          Trade
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      </td>
    </tr>
  );
}
