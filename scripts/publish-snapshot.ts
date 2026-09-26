import { fetchAllSources } from "../lib/get-markets";
import { publishSnapshot } from "../lib/snapshot";

// GitHub Actions holds the write credential. Vercel only reads published data.
async function main(): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("Missing PREDPULSE_BLOB_READ_WRITE_TOKEN GitHub Actions secret");
  }
  const sources = await fetchAllSources({ fresh: true });
  const snapshot = await publishSnapshot(sources);
  console.info("[publisher] published", {
    generatedAt: snapshot.generatedAt,
    selectedMarkets: snapshot.markets.length,
    sourceCounts: snapshot.sourceCounts,
  });
}

main().catch((error: unknown) => {
  console.error("[publisher] failed", error);
  process.exitCode = 1;
});
