import { get, put } from "@vercel/blob";
import type { ProcessedMarket, PulseIndex } from "./types";
import type { AllSourcesResult } from "./get-markets";
import { filterBySize } from "./get-markets";
import { computePulse } from "./pulse";

const MANIFEST_PATH = "predpulse/latest.json";
const MAX_BYTES = 250_000;
const SOURCE_FLOOR = 0.5;

export interface PublishedSnapshot {
  version: 1;
  generatedAt: string;
  sourceCounts: Record<ProcessedMarket["source"], number>;
  markets: ProcessedMarket[];
  pulse: PulseIndex[];
}

interface Manifest {
  version: 1;
  currentUrl: string;
  previousUrl?: string;
  generatedAt: string;
}

let lastGood: PublishedSnapshot | null = null;

export function selectSnapshotMarkets(sources: AllSourcesResult): ProcessedMarket[] {
  const liquid = filterBySize([
    ...sources.polymarkets,
    ...sources.kalshiMarkets,
    ...sources.manifoldMarkets,
  ], true);
  const selected = new Map<string, ProcessedMarket>();
  const add = (m: ProcessedMarket) => selected.set(`${m.source}:${m.id}`, {
    ...m,
    description: m.description.slice(0, 500),
    // Large optional enrichment belongs on detail views, not the bootstrap payload.
    orderbookDepth: undefined,
    topHolders: undefined,
  });

  // A bounded, balanced research subset, with enough recent movers for discovery.
  for (const source of ["polymarket", "kalshi", "manifold"] as const) {
    const venue = liquid.filter((m) => m.source === source);
    for (const m of [...venue].sort((a, b) => Math.abs(b.oneDayChange) - Math.abs(a.oneDayChange)).slice(0, 15)) add(m);
    for (const category of ["politics", "economics", "crypto", "tech", "climate", "sports", "entertainment", "geopolitics"]) {
      for (const m of venue.filter((item) => item.categoryslugs.includes(category))
        .sort((a, b) => b.volume24h - a.volume24h).slice(0, 4)) add(m);
    }
  }
  return Array.from(selected.values());
}

export function validateSnapshot(value: unknown): PublishedSnapshot {
  if (!value || typeof value !== "object") throw new Error("Invalid snapshot");
  const s = value as PublishedSnapshot;
  if (s.version !== 1 || !Number.isFinite(Date.parse(s.generatedAt)) ||
      !Array.isArray(s.markets) || s.markets.length === 0 || !Array.isArray(s.pulse) || s.pulse.length === 0 ||
      !s.sourceCounts || !Number.isFinite(s.sourceCounts.polymarket) ||
      !Number.isFinite(s.sourceCounts.kalshi) || !Number.isFinite(s.sourceCounts.manifold)) {
    throw new Error("Incomplete snapshot");
  }
  for (const m of s.markets) {
    if (!m.id || !m.source || !Number.isFinite(m.currentPrice) || m.currentPrice < 0 || m.currentPrice > 100) {
      throw new Error("Invalid market in snapshot");
    }
  }
  return s;
}

export function isSafeSnapshot(candidate: PublishedSnapshot, previous: PublishedSnapshot | null): boolean {
  if (candidate.sourceCounts.polymarket === 0 || candidate.sourceCounts.kalshi === 0 || candidate.markets.length === 0) return false;
  if (!previous) return true;
  return (["polymarket", "kalshi"] as const).every(
    (source) => candidate.sourceCounts[source] >= previous.sourceCounts[source] * SOURCE_FLOOR,
  );
}

async function readJson(path: string, bypassCache = false): Promise<unknown | null> {
  const response = await get(path, { access: "public", useCache: !bypassCache });
  if (!response || response.statusCode !== 200) return null;
  // Keep the read bounded, including if a blob was accidentally overwritten.
  if (response.blob.size > MAX_BYTES + 50_000) throw new Error("Snapshot blob too large");
  return new Response(response.stream).json();
}

function validBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(".public.blob.vercel-storage.com") &&
      parsed.pathname.startsWith("/predpulse/");
  } catch { return false; }
}

async function readManifest(): Promise<Manifest | null> {
  const raw = await readJson(MANIFEST_PATH, true);
  if (!raw || typeof raw !== "object") return null;
  const manifest = raw as Manifest;
  if (manifest.version !== 1 || !validBlobUrl(manifest.currentUrl)) throw new Error("Invalid snapshot manifest");
  return manifest;
}

/** Returns null when snapshots have not been configured/published yet. */
export async function loadPublishedSnapshot(): Promise<PublishedSnapshot | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) return null;
  try {
    const manifest = await readManifest();
    if (!manifest) return lastGood;
    for (const url of [manifest.currentUrl, manifest.previousUrl]) {
      if (!url || !validBlobUrl(url)) continue;
      try {
        const raw = await readJson(url);
        if (!raw) continue;
        const snapshot = validateSnapshot(raw);
        lastGood = snapshot;
        return snapshot;
      } catch (error) {
        console.warn("[snapshot] invalid generation", error);
      }
    }
  } catch (error) {
    console.warn("[snapshot] read failed", error);
  }
  return lastGood;
}

/** Publication is called by the scheduled GitHub runner, not a Vercel Function. */
export async function publishSnapshot(sources: AllSourcesResult): Promise<PublishedSnapshot> {
  const previous = await loadPublishedSnapshot();
  const snapshot = validateSnapshot({
    version: 1,
    generatedAt: new Date().toISOString(),
    sourceCounts: {
      polymarket: sources.polymarkets.length,
      kalshi: sources.kalshiMarkets.length,
      manifold: sources.manifoldMarkets.length,
    },
    markets: selectSnapshotMarkets(sources),
    pulse: computePulse([...sources.polymarkets, ...sources.kalshiMarkets]),
  });
  if (!isSafeSnapshot(snapshot, previous)) throw new Error("Core source unavailable or suspicious count collapse");
  const payload = JSON.stringify(snapshot);
  if (Buffer.byteLength(payload) > MAX_BYTES) throw new Error(`Snapshot exceeds ${MAX_BYTES} bytes`);

  // The generation is immutable; the short-lived manifest is the only mutable pointer.
  const generation = await put(`predpulse/generations/${Date.now()}.json`, payload, {
    access: "public", addRandomSuffix: false, contentType: "application/json", cacheControlMaxAge: 86400,
  });
  const oldManifest = await readManifest();
  const manifest: Manifest = {
    version: 1,
    currentUrl: generation.url,
    previousUrl: oldManifest?.currentUrl,
    generatedAt: snapshot.generatedAt,
  };
  await put(MANIFEST_PATH, JSON.stringify(manifest), {
    access: "public", addRandomSuffix: false, allowOverwrite: true,
    contentType: "application/json", cacheControlMaxAge: 60,
    ...(oldManifest ? { ifMatch: (await get(MANIFEST_PATH, { access: "public", useCache: false }))?.blob.etag } : {}),
  });
  lastGood = snapshot;
  return snapshot;
}
