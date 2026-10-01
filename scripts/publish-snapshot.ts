import { fetchAllSources } from "../lib/get-markets";
import { assertPublicationTarget, loadPublishedSnapshot, publishSnapshot } from "../lib/snapshot";

// GitHub Actions holds the write credential. Vercel only reads published data.
async function main(): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("Missing PREDPULSE_BLOB_READ_WRITE_TOKEN GitHub Actions secret");
  }

  assertPublicationTarget();

  // A second schedule is a fallback, not a reason to fetch and write twice an hour.
  // Explicit manual dispatches always publish.
  if (process.env.GITHUB_EVENT_NAME === "schedule") {
    const previous = await loadPublishedSnapshot();
    if (previous) {
      const ageMs = Date.now() - Date.parse(previous.generatedAt);
      if (ageMs >= 0 && ageMs < 50 * 60_000) {
        console.info("[publisher] recent snapshot, skipping", { generatedAt: previous.generatedAt });
        return;
      }
    }
  }

  const sources = await fetchAllSources({ fresh: true });
  const snapshot = await publishSnapshot(sources);
  if (process.env.SNAPSHOT_VERIFY_CAS === "true") {
    const next = await publishSnapshot(sources);
    console.info("[publisher] conditional overwrite verified without reacquisition", { generatedAt: next.generatedAt });
  }
  console.info("[publisher] published", {
    generatedAt: snapshot.generatedAt,
    selectedMarkets: snapshot.markets.length,
    indices: snapshot.indexProducts?.products.map((p) => ({ category: p.category, state: p.state, coverage: p.coverage, headline: p.headline })),
    indexBytes: snapshot.indexProducts ? Buffer.byteLength(JSON.stringify(snapshot.indexProducts)) : 0,
    sourceCounts: snapshot.sourceCounts,
    eventOutlooks: snapshot.eventOutlooks?.items.map((item) => ({
      title: item.title, topic: item.topic, displayedContracts: item.contracts.length,
      verifiedPartition: item.decision?.coherent ?? false,
    })) ?? null,
  });
}

main().catch((error: unknown) => {
  console.error("[publisher] failed", error);
  process.exitCode = 1;
});
