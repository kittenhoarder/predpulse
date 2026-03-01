import fs from "fs";
import path from "path";

const INDEX_PERSISTENCE_ENABLED =
  process.env.INDEX_PERSISTENCE_ENABLED === "1" ||
  process.env.INDEX_PERSISTENCE_ENABLED === "true";

export interface StoredIndexSnapshot {
  timestamp: string;
  family: "directional" | "liquidity" | "divergence" | "certainty";
  category: string;
  sourceScope: "core" | "all" | "polymarket" | "kalshi" | "manifold";
  horizon: "24h" | "7d";
  score: number;
  confidence: number;
  coverage: number;
  rawSignals: Record<string, number>;
  diagnostics: {
    freshness: number;
    sourceAgreement: number;
    featureCoverage: number;
  };
}

export interface StoredMarketSnapshot {
  timestamp: string;
  marketId: string;
  source: "polymarket" | "kalshi" | "manifold";
  category: string;
  polarity: 1 | -1;
  currentPrice: number;
  oneDayChange: number;
  oneWeekChange: number;
  volume24h: number;
  liquidity: number;
  spreadPP: number;
  orderflow?: number;
  smartMoney?: number;
}

export interface ResolvedOutcomeRow {
  marketId: string;
  source: "polymarket" | "kalshi" | "manifold";
  category: string;
  polarity?: 1 | -1;
  outcomeYes: 0 | 1;
  resolvedAt: string;
  note?: string;
}

interface StoreState {
  version: 1;
  lastSnapshotAt: number;
  indexSnapshots: StoredIndexSnapshot[];
  marketSnapshots: StoredMarketSnapshot[];
  resolvedOutcomes: ResolvedOutcomeRow[];
}

let inMemoryStore: StoreState = emptyStore();

const INDEX_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;
const MARKET_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

function defaultStorePath(): string {
  return process.env.INDEX_STORE_PATH ?? path.join(process.cwd(), ".predpulse", "index-store.json");
}

function emptyStore(): StoreState {
  return {
    version: 1,
    lastSnapshotAt: 0,
    indexSnapshots: [],
    marketSnapshots: [],
    resolvedOutcomes: [],
  };
}

function safeParseStore(raw: string): StoreState {
  try {
    const parsed = JSON.parse(raw) as Partial<StoreState>;
    if (parsed.version !== 1) return emptyStore();
    return {
      version: 1,
      lastSnapshotAt: parsed.lastSnapshotAt ?? 0,
      indexSnapshots: Array.isArray(parsed.indexSnapshots) ? parsed.indexSnapshots : [],
      marketSnapshots: Array.isArray(parsed.marketSnapshots) ? parsed.marketSnapshots : [],
      resolvedOutcomes: Array.isArray(parsed.resolvedOutcomes) ? parsed.resolvedOutcomes : [],
    };
  } catch {
    return emptyStore();
  }
}

function readStoreSync(): StoreState {
  if (!INDEX_PERSISTENCE_ENABLED) return inMemoryStore;

  const storePath = defaultStorePath();
  if (!fs.existsSync(storePath)) return emptyStore();
  try {
    return safeParseStore(fs.readFileSync(storePath, "utf8"));
  } catch {
    return emptyStore();
  }
}

function writeStoreSync(store: StoreState): void {
  if (!INDEX_PERSISTENCE_ENABLED) {
    inMemoryStore = store;
    return;
  }

  const storePath = defaultStorePath();
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  const tmp = `${storePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(tmp, storePath);
}

function pruneStore(store: StoreState): void {
  const now = Date.now();
  const indexCutoff = now - INDEX_RETENTION_MS;
  const marketCutoff = now - MARKET_RETENTION_MS;

  store.indexSnapshots = store.indexSnapshots.filter((row) => Date.parse(row.timestamp) >= indexCutoff);
  store.marketSnapshots = store.marketSnapshots.filter((row) => Date.parse(row.timestamp) >= marketCutoff);

  // Deduplicate resolved outcomes by source+market
  const dedup = new Map<string, ResolvedOutcomeRow>();
  for (const row of store.resolvedOutcomes) {
    dedup.set(`${row.source}:${row.marketId}`, row);
  }
  store.resolvedOutcomes = Array.from(dedup.values()).sort((a, b) => Date.parse(b.resolvedAt) - Date.parse(a.resolvedAt));
}

function withStoreMutation<T>(fn: (store: StoreState) => T): T {
  const store = readStoreSync();
  const result = fn(store);
  pruneStore(store);
  try {
    writeStoreSync(store);
  } catch (err) {
    // Fallback to in-memory snapshots so index computation remains available
    // in readonly/serverless runtimes where fs writes are disallowed.
    console.warn("[index-store] persistence unavailable, using in-memory snapshots", err);
    inMemoryStore = store;
  }
  return result;
}

export function isIndexPersistenceEnabled(): boolean {
  return INDEX_PERSISTENCE_ENABLED;
}

export function readStore(): {
  indexSnapshots: StoredIndexSnapshot[];
  marketSnapshots: StoredMarketSnapshot[];
  resolvedOutcomes: ResolvedOutcomeRow[];
  lastSnapshotAt: number;
} {
  const store = readStoreSync();
  return {
    indexSnapshots: store.indexSnapshots,
    marketSnapshots: store.marketSnapshots,
    resolvedOutcomes: store.resolvedOutcomes,
    lastSnapshotAt: store.lastSnapshotAt,
  };
}

export function appendSnapshotBatch(params: {
  indexSnapshots: StoredIndexSnapshot[];
  marketSnapshots: StoredMarketSnapshot[];
  minIntervalMs?: number;
}): boolean {
  const minIntervalMs = params.minIntervalMs ?? 5 * 60 * 1000;
  if (params.indexSnapshots.length === 0) return false;

  return withStoreMutation<boolean>((store) => {
    const now = Date.now();
    if (now - store.lastSnapshotAt < minIntervalMs) return false;

    store.lastSnapshotAt = now;
    store.indexSnapshots.push(...params.indexSnapshots);
    store.marketSnapshots.push(...params.marketSnapshots);
    return true;
  });
}

export function getIndexSnapshots(opts: {
  family?: "directional" | "liquidity" | "divergence" | "certainty";
  category?: string;
  sourceScope?: "core" | "all" | "polymarket" | "kalshi" | "manifold";
  horizon?: "24h" | "7d";
  sinceMs?: number;
  limit?: number;
}): StoredIndexSnapshot[] {
  const store = readStoreSync();
  const sinceMs = opts.sinceMs ?? Date.now() - 30 * 24 * 60 * 60 * 1000;

  let rows = store.indexSnapshots.filter((row) => Date.parse(row.timestamp) >= sinceMs);
  if (opts.family) rows = rows.filter((row) => row.family === opts.family);
  if (opts.category) rows = rows.filter((row) => row.category === opts.category);
  if (opts.sourceScope) rows = rows.filter((row) => row.sourceScope === opts.sourceScope);
  if (opts.horizon) rows = rows.filter((row) => row.horizon === opts.horizon);

  rows.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  if (opts.limit && rows.length > opts.limit) {
    return rows.slice(rows.length - opts.limit);
  }
  return rows;
}

export function getSignalHistory(opts: {
  family: "directional" | "liquidity" | "divergence" | "certainty";
  category: string;
  sourceScope: "core" | "all" | "polymarket" | "kalshi" | "manifold";
  horizon: "24h" | "7d";
  signal: string;
  lookbackDays?: number;
}): number[] {
  const lookbackDays = opts.lookbackDays ?? 30;
  const rows = getIndexSnapshots({
    family: opts.family,
    category: opts.category,
    sourceScope: opts.sourceScope,
    horizon: opts.horizon,
    sinceMs: Date.now() - lookbackDays * 24 * 60 * 60 * 1000,
  });

  return rows
    .map((row) => row.rawSignals[opts.signal])
    .filter((v): v is number => Number.isFinite(v));
}

export function upsertResolvedOutcomes(rows: ResolvedOutcomeRow[]): void {
  if (rows.length === 0) return;

  withStoreMutation<void>((store) => {
    const map = new Map<string, ResolvedOutcomeRow>();
    for (const row of store.resolvedOutcomes) {
      map.set(`${row.source}:${row.marketId}`, row);
    }
    for (const row of rows) {
      map.set(`${row.source}:${row.marketId}`, row);
    }
    store.resolvedOutcomes = Array.from(map.values());
  });
}

export function getResolvedOutcomes(limit = 10_000): ResolvedOutcomeRow[] {
  const store = readStoreSync();
  return store.resolvedOutcomes
    .slice()
    .sort((a, b) => Date.parse(b.resolvedAt) - Date.parse(a.resolvedAt))
    .slice(0, limit);
}
