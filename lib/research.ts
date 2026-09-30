import { createHash } from "node:crypto";
import type { GammaEvent, GammaMarket } from "./types";
import { outlookTopic } from "./event-outlooks";
import { readYesQuote } from "./outlook-quotes";

export const RESEARCH_METHOD = "contract-evidence-v1";
export const RESEARCH_LIMIT = 16;
export const RESEARCH_MAX_BYTES = 100_000;
const HOUR = 3_600_000;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export interface ResolutionEvidence {
  fingerprint: string; ingestedAt: string; outcomeYes: 0 | 1;
  venueUpdatedAt: string | null; publicResultAt: null;
  rulesHash: string; evidenceUrl: string;
}
export interface ContractEvidence {
  source: "polymarket"; marketId: string; outcomeId: string; familyId: string;
  question: string; eventUrl: string; rules: string; rulesHash: string;
  mappingVersion: "yes-first-binary-v1"; quoteBasis: "YES bid/ask midpoint";
  closesAt: string; firstCapturedAt: string; checkedAt: string | null;
  observedAt: string | null; ingestedAt: string;
  status: "active" | "closed" | "archived" | "missing";
  bid: number | null; ask: number | null; midpoint: number | null;
  change24hPP: number | null;
  previous24h: { asOf: string; midpoint: number } | null;
  leadObservation: { asOf: string; probability: number; rulesHash: string; closesAt: string } | null;
  resolutions: ResolutionEvidence[];
}
export interface ResearchDigest {
  version: 1; methodology: typeof RESEARCH_METHOD; asOf: string; startedAt: string;
  contracts: ContractEvidence[]; capacityExcluded: number;
}
export interface GenerationReference { generatedAt: string; url: string }

/** Deterministic archive index. Existing immutable generations are the history. */
export function archiveReferences(previous: GenerationReference[], current: GenerationReference): GenerationReference[] {
  const cutoff = Date.parse(current.generatedAt) - 30 * 24 * HOUR;
  return Array.from(new Map([...previous, current].map((r) => [r.url, r])).values())
    .filter((r) => Date.parse(r.generatedAt) >= cutoff)
    .sort((a, b) => Date.parse(a.generatedAt) - Date.parse(b.generatedAt) || a.url.localeCompare(b.url)).slice(-750);
}
export function referenceAt(refs: GenerationReference[], at: string): GenerationReference | null {
  const target = Date.parse(at);
  return refs.filter((r) => Math.abs(Date.parse(r.generatedAt) - target) <= 45 * 60_000)
    .sort((a, b) => Math.abs(Date.parse(a.generatedAt) - target) - Math.abs(Date.parse(b.generatedAt) - target) || a.generatedAt.localeCompare(b.generatedAt))[0] ?? null;
}

/** Missing or revised mappings never produce a fabricated 24h movement. */
export function comparableChange(current: ContractEvidence, previous: ContractEvidence | undefined): number | null {
  if (!previous || current.status !== "active" || previous.status !== "active" ||
      current.midpoint === null || previous.midpoint === null || current.marketId !== previous.marketId ||
      current.outcomeId !== previous.outcomeId || current.rulesHash !== previous.rulesHash ||
      current.closesAt !== previous.closesAt || current.quoteBasis !== previous.quoteBasis ||
      Math.abs(Date.parse(current.ingestedAt) - Date.parse(previous.ingestedAt) - 24 * HOUR) > 45 * 60_000) return null;
  return Math.round((current.midpoint - previous.midpoint) * 10_000) / 100;
}

function binary(m: GammaMarket): string | null {
  try {
    const labels = JSON.parse(m.outcomes), tokens = JSON.parse(m.clobTokenIds);
    return labels.length === 2 && labels[0] === "Yes" && labels[1] === "No" &&
      Array.isArray(tokens) && typeof tokens[0] === "string" && tokens[0] ? tokens[0] : null;
  } catch { return null; }
}
export function buildResearch(events: GammaEvent[], refreshed: GammaMarket[], previous: ResearchDigest | null,
  baseline: ResearchDigest | null, asOf: string, attemptedIds: string[] = []): ResearchDigest {
  const now = Date.parse(asOf);
  const marketMap = new Map(events.flatMap((e) => (e.markets ?? []).map((m) => [m.id, m] as const)));
  refreshed.forEach((m) => marketMap.set(m.id, m));
  // A contract stays tracked when it leaves the discovery feed, closes or resolves.
  const contracts: ContractEvidence[] = (previous?.contracts ?? []).map((row) => ({ ...row }));
  const known = new Set(contracts.map((row) => row.marketId));
  let capacityExcluded = 0;
  const families = new Set(contracts.map((row) => row.familyId));
  const candidates = events.filter((e) => e.active && !e.closed && !e.archived && outlookTopic(e.title) && e.volume24hr >= 10_000)
    .sort((a, b) => b.volume24hr - a.volume24hr || a.id.localeCompare(b.id));
  for (const event of candidates) {
    if (families.has(event.id) || !/^[a-z0-9-]+$/.test(event.slug)) continue;
    const market = (event.markets ?? []).filter((m) => /^\d+$/.test(m.id) && binary(m) && m.description && Buffer.byteLength(m.description) <= 3000 &&
      m.question && Number.isFinite(m.volume24hr) &&
      m.active && !m.closed && !m.archived && Date.parse(m.endDate) > now && Date.parse(m.endDate) <= now + 90 * 24 * HOUR)
      .sort((a, b) => b.volume24hr - a.volume24hr || a.id.localeCompare(b.id))[0];
    if (!market || known.has(market.id)) continue;
    if (contracts.length >= RESEARCH_LIMIT) { capacityExcluded++; continue; }
    contracts.push({ source: "polymarket", marketId: market.id, outcomeId: binary(market)!, familyId: event.id,
      question: market.question.slice(0, 300), eventUrl: `https://polymarket.com/event/${event.slug}`,
      rules: market.description, rulesHash: hash(market.description), mappingVersion: "yes-first-binary-v1",
      quoteBasis: "YES bid/ask midpoint", closesAt: market.endDate, firstCapturedAt: asOf, checkedAt: null,
      observedAt: null, ingestedAt: asOf, status: "missing", bid: null, ask: null, midpoint: null,
      change24hPP: null, previous24h: null, leadObservation: null, resolutions: [] });
    known.add(market.id); families.add(event.id);
  }
  for (const row of contracts) {
    const m = marketMap.get(row.marketId);
    row.ingestedAt = asOf; row.status = "missing"; row.observedAt = null;
    row.bid = row.ask = row.midpoint = row.change24hPP = null;
    row.previous24h = null;
    if (attemptedIds.includes(row.marketId)) row.checkedAt = asOf;
    if (!m) continue;
    row.checkedAt = asOf;
    row.status = m.archived ? "archived" : m.closed ? "closed" : "active";
    // A changed outcome identity cannot be silently interpreted as the old contract.
    if (binary(m) !== row.outcomeId || !m.description || Buffer.byteLength(m.description) > 3000) continue;
    row.rules = m.description; row.rulesHash = hash(m.description); row.closesAt = m.endDate;
    row.observedAt = Number.isFinite(Date.parse(m.updatedAt)) ? m.updatedAt : null;
    const age = row.observedAt ? now - Date.parse(row.observedAt) : Infinity;
    if (age >= -300_000 && age <= 75 * 60_000 && Date.parse(row.closesAt) > now) Object.assign(row, readYesQuote(m));
    const old = baseline?.contracts.find((item) => item.marketId === row.marketId);
    row.change24hPP = comparableChange(row, old);
    if (row.change24hPP !== null && old) row.previous24h = { asOf: old.ingestedAt, midpoint: old.midpoint! };
    if (!row.leadObservation && row.midpoint !== null && Math.abs(Date.parse(row.closesAt) - now - 24 * HOUR) <= 45 * 60_000)
      row.leadObservation = { asOf, probability: row.midpoint, rulesHash: row.rulesHash, closesAt: row.closesAt };
    // Closed alone and near-0/1 prices are not settlement evidence.
    if (m.closed && m.umaResolutionStatus === "resolved") {
      let prices: unknown; try { prices = JSON.parse(m.outcomePrices); } catch { continue; }
      if (!Array.isArray(prices) || prices.length !== 2) continue;
      const yes = Number(prices[0]), no = Number(prices[1]);
      if (!((yes === 0 && no === 1) || (yes === 1 && no === 0))) continue;
      const evidenceUrl = `https://gamma-api.polymarket.com/markets/${m.id}`;
      const fingerprint = hash(`${row.marketId}:${yes}:${row.rulesHash}:${row.outcomeId}`);
      if (row.resolutions.at(-1)?.fingerprint !== fingerprint) row.resolutions = [...row.resolutions, {
        fingerprint, ingestedAt: asOf, outcomeYes: yes as 0 | 1, venueUpdatedAt: row.observedAt,
        publicResultAt: null, rulesHash: row.rulesHash, evidenceUrl,
      }].slice(-4);
    }
  }
  return validateResearch({ version: 1, methodology: RESEARCH_METHOD, asOf,
    startedAt: previous?.startedAt ?? asOf, contracts, capacityExcluded }, asOf);
}

export function validateResearch(value: unknown, asOf: string): ResearchDigest {
  const d = value as ResearchDigest;
  const date = (v: string) => typeof v === "string" && Number.isFinite(Date.parse(v));
  const probability = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;
  if (!d || d.version !== 1 || d.methodology !== RESEARCH_METHOD || d.asOf !== asOf || !date(asOf) ||
      !date(d.startedAt) || !Array.isArray(d.contracts) || d.contracts.length > RESEARCH_LIMIT ||
      !Number.isInteger(d.capacityExcluded) || d.capacityExcluded < 0 || Buffer.byteLength(JSON.stringify(d)) > RESEARCH_MAX_BYTES)
    throw new Error("Invalid research digest");
  const ids = new Set<string>();
  for (const c of d.contracts) {
    if (!c || c.source !== "polymarket" || typeof c.marketId !== "string" || !/^\d+$/.test(c.marketId) || ids.has(c.marketId) ||
        typeof c.outcomeId !== "string" || !c.outcomeId || typeof c.familyId !== "string" || !c.familyId ||
        typeof c.question !== "string" || c.question.length > 300 || typeof c.rules !== "string" || Buffer.byteLength(c.rules) > 3000 || hash(c.rules) !== c.rulesHash ||
        !/^https:\/\/polymarket\.com\/event\/[a-z0-9-]+$/.test(c.eventUrl) || c.mappingVersion !== "yes-first-binary-v1" ||
        c.quoteBasis !== "YES bid/ask midpoint" || !date(c.closesAt) || !date(c.firstCapturedAt) || c.ingestedAt !== asOf ||
        (c.checkedAt !== null && !date(c.checkedAt)) || (c.observedAt !== null && !date(c.observedAt)) ||
        !["active", "closed", "archived", "missing"].includes(c.status) ||
        ![c.bid, c.ask, c.midpoint].every((n) => n === null || probability(n)) ||
        (c.change24hPP !== null && (!Number.isFinite(c.change24hPP) || Math.abs(c.change24hPP) > 100)) ||
        !Array.isArray(c.resolutions) || c.resolutions.length > 4) throw new Error("Invalid research contract");
    ids.add(c.marketId);
    if (c.change24hPP === null ? c.previous24h !== null : !c.previous24h || !date(c.previous24h.asOf) ||
        !probability(c.previous24h.midpoint) || c.midpoint === null ||
        Math.abs(Date.parse(asOf) - Date.parse(c.previous24h.asOf) - 24 * HOUR) > 45 * 60_000 ||
        Math.abs(c.change24hPP - Math.round((c.midpoint - c.previous24h.midpoint) * 10_000) / 100) > 1e-9)
      throw new Error("Invalid comparable historical pair");
    if (c.midpoint !== null && (c.status !== "active" || c.bid === null || c.ask === null || c.bid > c.ask ||
        c.ask - c.bid > 0.10 + 1e-9 || Math.abs(c.midpoint - (c.bid + c.ask) / 2) > 1e-9 || !c.observedAt ||
        Date.parse(asOf) - Date.parse(c.observedAt) < -300_000 || Date.parse(asOf) - Date.parse(c.observedAt) > 75 * 60_000)) throw new Error("Invalid research quote");
    if (c.leadObservation && (!date(c.leadObservation.asOf) || !probability(c.leadObservation.probability) ||
        !/^[a-f0-9]{64}$/.test(c.leadObservation.rulesHash) || !date(c.leadObservation.closesAt) ||
        Math.abs(Date.parse(c.leadObservation.closesAt) - Date.parse(c.leadObservation.asOf) - 24 * HOUR) > 45 * 60_000)) throw new Error("Invalid lead observation");
    for (const r of c.resolutions) if (!date(r.ingestedAt) || r.publicResultAt !== null || ![0, 1].includes(r.outcomeYes) ||
      !/^[a-f0-9]{64}$/.test(r.rulesHash) || r.fingerprint !== hash(`${c.marketId}:${r.outcomeYes}:${r.rulesHash}:${c.outcomeId}`) ||
      r.evidenceUrl !== `https://gamma-api.polymarket.com/markets/${c.marketId}` ||
      (r.venueUpdatedAt !== null && !date(r.venueUpdatedAt))) throw new Error("Invalid resolution evidence");
  }
  return d;
}
