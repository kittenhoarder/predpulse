import { get, put } from "@vercel/blob";
import type { ProcessedMarket, PulseIndex } from "./types";
import type { AllSourcesResult } from "./get-markets";
import { filterBySize } from "./get-markets";
import { computePulse } from "./pulse";
import { buildObservationDigest, type ObservationDigest } from "./observations";
import { buildEventMonitor, type EventMonitor } from "./event-monitor";
import { buildRelatedDigest, validateRelatedDigest, type RelatedDigest } from "./related-markets";
import { validateDecisionDistribution, type DecisionDistribution } from "./decision-distribution";
import { buildEventOutlooks, validateEventOutlooks, type EventOutlooks } from "./event-outlooks";

import { buildResearch, validateResearch, archiveReferences, referenceAt, type ResearchDigest, type GenerationReference } from "./research";
import { refreshTrackedContracts } from "./research-acquisition";

const OBSERVATIONS_BRANCH = "feat/spec-02-trustworthy-observations";
const KALSHI_BRANCH = "feat/spec-02-kalshi-observations";
const MONITOR_BRANCH = "feat/spec-03-event-monitor";
const RELATED_BRANCH = "feat/spec-004-venue-comparisons";
const DECISION_BRANCH = "feat/spec-005-event-distribution";
const branch = process.env.GITHUB_REF_NAME ?? process.env.VERCEL_GIT_COMMIT_REF;
const PREFIX = branch === "feat/spec-006-durable-evidence" ? "predpulse/previews/spec-06" :
  branch === DECISION_BRANCH ? "predpulse/previews/spec-05" :
  branch === RELATED_BRANCH ? "predpulse/previews/spec-04" :
  branch === MONITOR_BRANCH ? "predpulse/previews/spec-03" :
  branch === KALSHI_BRANCH ? "predpulse/previews/kalshi" :
  branch === OBSERVATIONS_BRANCH ? "predpulse/previews/spec-02" : "predpulse";
const MANIFEST_PATH = `${PREFIX}/latest.json`;
const MAX_BYTES = 250_000;
const SOURCE_FLOOR = 0.5;

export interface PublishedSnapshot {
  version: 1;
  generatedAt: string;
  sourceCounts: Record<ProcessedMarket["source"], number>;
  markets: ProcessedMarket[];
  pulse: PulseIndex[];
  observations?: ObservationDigest;
  monitor?: EventMonitor;
  related?: RelatedDigest;
  decisionDistribution?: DecisionDistribution | null; // Read compatibility with earlier spec-005 previews.
  eventOutlooks?: EventOutlooks | null;
  research?: ResearchDigest;
}

interface Manifest {
  version: 1;
  currentUrl: string;
  previousUrl?: string;
  generatedAt: string;
  archive?: GenerationReference[];
  etag?: string; // Read metadata only, never written into the manifest.
}

let lastGood: PublishedSnapshot | null = null;

export function selectSnapshotMarkets(sources: AllSourcesResult, monitorItems: EventMonitor["items"] = []): ProcessedMarket[] {
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

  const monitored = new Set(monitorItems.map((item) => `${item.source}:${item.marketId}`));
  for (const m of liquid) if (monitored.has(`${m.source}:${m.id}`)) add(m);

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
  if (s.observations?.version === 2 && (s.observations.asOf !== s.generatedAt ||
      !s.observations.coverage?.polymarket || !s.observations.coverage?.kalshi ||
      !Array.isArray(s.observations.items) || s.observations.items.length > 4 ||
      s.observations.items.some((item) =>
        !["https://polymarket.com/event/", "https://kalshi.com/markets/"].some((prefix) =>
          item.eventUrl.startsWith(prefix)) ||
        !Number.isFinite(item.currentProbability) || !Number.isFinite(item.change24h)))) {
    throw new Error("Invalid observation digest");
  }
  if (s.monitor && (s.monitor.version !== 1 || s.monitor.asOf !== s.generatedAt ||
      !Number.isFinite(s.monitor.examined) || !Number.isFinite(s.monitor.eligible) ||
      !Array.isArray(s.monitor.items) || s.monitor.items.length > 12 ||
      s.monitor.items.some((item) => !s.markets.some((m) => m.source === item.source && m.id === item.marketId)))) {
    throw new Error("Invalid event monitor");
  }
  if (s.related) validateRelatedDigest(s.related, s.generatedAt);
  if (s.decisionDistribution) validateDecisionDistribution(s.decisionDistribution, s.generatedAt);
  if (s.eventOutlooks) validateEventOutlooks(s.eventOutlooks, s.generatedAt);
  if (s.research) validateResearch(s.research, s.generatedAt);
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
  const response = await get(path, { access: "private", useCache: !bypassCache });
  if (!response || response.statusCode !== 200) return null;
  // Keep the read bounded, including if a blob was accidentally overwritten.
  if (response.blob.size > MAX_BYTES + 50_000) throw new Error("Snapshot blob too large");
  return new Response(response.stream).json();
}

function validBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(".private.blob.vercel-storage.com") &&
      parsed.pathname.startsWith(`/${PREFIX}/`);
  } catch { return false; }
}

async function readManifest(): Promise<Manifest | null> {
  const response = await get(MANIFEST_PATH, { access: "private", useCache: false });
  if (!response || response.statusCode !== 200) return null;
  if (response.blob.size > 180_000) throw new Error("Manifest too large");
  const raw = await new Response(response.stream).json();
  if (!raw || typeof raw !== "object") return null;
  const manifest = raw as Manifest;
  if (manifest.version !== 1 || !validBlobUrl(manifest.currentUrl) || !Number.isFinite(Date.parse(manifest.generatedAt)) ||
      (manifest.archive && (!Array.isArray(manifest.archive) || manifest.archive.length > 750 ||
        manifest.archive.some((r) => !validBlobUrl(r.url) || !Number.isFinite(Date.parse(r.generatedAt)))))) throw new Error("Invalid snapshot manifest");
  return { ...manifest, etag: response.blob.etag };
}

/** A bounded immutable generation read; callers cannot supply arbitrary Blob URLs. */
export async function loadHistoricalSnapshot(at: string): Promise<PublishedSnapshot | null> {
  if (!Number.isFinite(Date.parse(at)) || (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID)) return null;
  const manifest = await readManifest();
  const ref = referenceAt(manifest?.archive ?? [], at);
  if (!ref) return null;
  const raw = await readJson(ref.url);
  if (!raw) return null;
  const snapshot = validateSnapshot(raw);
  return snapshot.generatedAt === ref.generatedAt ? snapshot : null;
}

export async function listHistoricalSnapshots(): Promise<string[]> {
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) return [];
  const manifest = await readManifest();
  return (manifest?.archive ?? []).map((r) => r.generatedAt);
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
  const oldManifest = await readManifest();
  const previous = await loadPublishedSnapshot();
  const generatedAt = new Date().toISOString();
  const at24h = new Date(Date.parse(generatedAt) - 24 * 3_600_000).toISOString();
  const baseline = await loadHistoricalSnapshot(at24h);
  const refreshed = await refreshTrackedContracts(previous?.research ?? null);
  const research = buildResearch(sources.outlookEvents ?? [], refreshed.markets, previous?.research ?? null, baseline?.research ?? null, generatedAt, refreshed.attemptedIds);
  const coreMarkets = [...sources.polymarkets, ...sources.kalshiMarkets];
  const monitor = buildEventMonitor(coreMarkets, generatedAt);
  const related = buildRelatedDigest(coreMarkets, generatedAt);
  let eventOutlooks: EventOutlooks | null = null;
  try { eventOutlooks = buildEventOutlooks(sources.outlookEvents ?? [], generatedAt); }
  catch (error) { console.warn("[snapshot] event outlooks withheld", error); }
  const snapshot = validateSnapshot({
    version: 1,
    generatedAt,
    sourceCounts: {
      polymarket: sources.polymarkets.length,
      kalshi: sources.kalshiMarkets.length,
      manifold: sources.manifoldMarkets.length,
    },
    markets: selectSnapshotMarkets(sources, monitor.items),
    pulse: computePulse(coreMarkets),
    observations: buildObservationDigest(coreMarkets, generatedAt),
    monitor,
    related: related.items.length ? related : undefined,
    eventOutlooks,
    research,
  });
  if (!isSafeSnapshot(snapshot, previous)) throw new Error("Core source unavailable or suspicious count collapse");
  let payload = JSON.stringify(snapshot);
  // Related markets are supplemental. Preserve core publication near the byte cap.
  while (Buffer.byteLength(payload) > MAX_BYTES && snapshot.related?.items.length) {
    snapshot.related.items.pop();
    if (snapshot.related.items.length === 0) delete snapshot.related;
    payload = JSON.stringify(snapshot);
  }
  if (Buffer.byteLength(payload) > MAX_BYTES && snapshot.eventOutlooks) {
    snapshot.eventOutlooks = null;
    payload = JSON.stringify(snapshot);
  }
  // Preserve the evidence cohort; trim supplemental explorer rows before failing.
  const protectedIds = new Set(monitor.items.map((m) => `${m.source}:${m.marketId}`));
  while (Buffer.byteLength(payload) > MAX_BYTES) {
    const index = snapshot.markets.findLastIndex((m) => !protectedIds.has(`${m.source}:${m.id}`) &&
      snapshot.markets.filter((other) => other.source === m.source).length > 1);
    if (index < 0) break;
    snapshot.markets.splice(index, 1);
    payload = JSON.stringify(snapshot);
  }
  if (Buffer.byteLength(payload) > MAX_BYTES) throw new Error(`Snapshot exceeds ${MAX_BYTES} bytes`);

  // The generation is immutable; the short-lived manifest is the only mutable pointer.
  const generation = await put(`${PREFIX}/generations/${Date.now()}.json`, payload, {
    access: "private", addRandomSuffix: false, contentType: "application/json", cacheControlMaxAge: 86400,
  });
  const manifest: Manifest = {
    version: 1,
    currentUrl: generation.url,
    previousUrl: oldManifest?.currentUrl,
    generatedAt: snapshot.generatedAt,
    archive: archiveReferences(oldManifest?.archive ?? (oldManifest ? [{ generatedAt: oldManifest.generatedAt, url: oldManifest.currentUrl }] : []), { generatedAt: snapshot.generatedAt, url: generation.url }),
  };
  await put(MANIFEST_PATH, JSON.stringify(manifest), {
    access: "private", addRandomSuffix: false, allowOverwrite: true,
    contentType: "application/json", cacheControlMaxAge: 60,
    ...(oldManifest ? { ifMatch: oldManifest.etag } : {}),
  });
  lastGood = snapshot;
  return snapshot;
}
