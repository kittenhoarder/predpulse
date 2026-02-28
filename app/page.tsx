import { Suspense } from "react";
import { getMarkets } from "@/lib/get-markets";
import MarketTable from "@/components/MarketTable";

// Force dynamic rendering — data is fetched from Redis/Gamma at request time
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const initialData = await getMarkets({ sort: "movers", category: "all", offset: 0 });

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              P
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">
                Predmove
              </h1>
              <p className="text-xs text-gray-500 leading-none">
                Polymarket Movers
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="hidden sm:inline">
              {initialData.totalMarkets.toLocaleString()} active markets
            </span>
            <a
              href="https://polymarket.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Polymarket ↗
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-6">
        <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
          Today&apos;s Biggest Movers
        </h2>
        <p className="mt-2 text-gray-400 text-base max-w-2xl">
          Real-time dashboard tracking the most active and most volatile
          prediction markets on Polymarket. Updated every 15 minutes.
        </p>
      </section>

      {/* Main table */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <Suspense
          fallback={
            <div className="h-96 flex items-center justify-center text-gray-500">
              Loading markets…
            </div>
          }
        >
          <MarketTable initialData={initialData} />
        </Suspense>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-600">
          <span>
            Data sourced from the{" "}
            <a
              href="https://docs.polymarket.com/developers/gamma-markets-api/overview"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-400 underline underline-offset-2"
            >
              Polymarket Gamma API
            </a>
            . Not financial advice.
          </span>
          <span>
            Built with Next.js · Predmove is not affiliated with Polymarket
          </span>
        </div>
      </footer>
    </div>
  );
}
