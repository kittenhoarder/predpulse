import { createHash } from "node:crypto";
import { buildDecisionDistribution, validateDecisionDistribution, type DecisionDistribution } from "./decision-distribution";
import { readYesQuote } from "./outlook-quotes";
import type { GammaEvent } from "./types";

export const OUTLOOK_METHOD = "event-outlooks-v1";
export const OUTLOOK_MAX_BYTES = 24_000;
export type OutlookTopic = "Central banks" | "Elections" | "Economic releases" | "Policy & geopolitics";
export interface OutlookContract {
  id: string; question: string; label: string;
  bid: number; ask: number; midpoint: number;
  closesAt: string; updatedAt: string; rulesExcerpt: string; rulesHash: string;
}
export interface EventOutlook {
  eventId: string; title: string; eventUrl: string; topic: OutlookTopic;
  closesAt: string; volume24h: number; activeContracts: number;
  // Unverified sets are never summed or normalized, even if prices happen to total 100%.
  contracts: OutlookContract[]; decision: DecisionDistribution | null;
}
export interface EventOutlooks {
  version: 1; methodology: typeof OUTLOOK_METHOD; asOf: string; screened: number; items: EventOutlook[];
}
const DAY = 86_400_000;
const fresh = (value: string, now: number) => Number.isFinite(Date.parse(value)) &&
  now - Date.parse(value) >= -300_000 && now - Date.parse(value) <= 75 * 60_000;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

/** Topic screening is discovery, not a proof of semantics or significance. */
export function outlookTopic(title: string): OutlookTopic | null {
  if (/\b(fed decision|fomc|ecb|bank of england|bank of japan|central bank|interest rate decision)\b/i.test(title)) return "Central banks";
  if (/\b(presidential election|parliamentary election|senate election|prime minister|election winner)\b/i.test(title)) return "Elections";
  if (/\b(inflation|cpi|nonfarm payrolls|unemployment rate|gdp growth|pce)\b/i.test(title)) return "Economic releases";
  if (/\b(ceasefire|peace agreement|tariff|sanctions|nuclear deal|government shutdown)\b/i.test(title)) return "Policy & geopolitics";
  return null;
}

/** Uses only the existing publisher's Gamma sample. At most three topic-diverse cards. */
export function buildEventOutlooks(events: GammaEvent[], asOf: string, suppliedDecision?: DecisionDistribution | null): EventOutlooks {
  const now = Date.parse(asOf);
  if (!Number.isFinite(now)) throw new Error("Invalid outlook timestamp");
  const decision = suppliedDecision === undefined ? buildDecisionDistribution(events, asOf) : suppliedDecision;
  const candidates: EventOutlook[] = [];
  for (const event of events) {
    const topic = outlookTopic(event.title);
    if (!topic || !event.active || event.closed || event.archived || !/^[a-z0-9-]+$/.test(event.slug) ||
        !event.id || event.title.length > 240 || !Number.isFinite(event.volume24hr) || event.volume24hr < 10_000) continue;
    const active = (event.markets ?? []).filter((m) => m.active && !m.closed && !m.archived);
    const supportedDecision = decision?.eventId === event.id ? decision : null;
    // Other Fed months must not masquerade as an unverified alternative to the nearest meeting.
    if (/^Fed Decision in /i.test(event.title) && !supportedDecision) continue;
    const contracts = active.flatMap((market): OutlookContract[] => {
      const quote = readYesQuote(market);
      const close = Date.parse(market.endDate);
      const question = market.question?.trim();
      const rules = market.description?.trim();
      if (quote.midpoint === null || !fresh(market.updatedAt, now) || !question || question.length > 300 ||
          !rules || !market.id || close <= now || close > now + 90 * DAY || !Number.isFinite(close)) return [];
      return [{ id: market.id, question, label: (market.groupItemTitle?.trim() || question).slice(0, 180),
        bid: quote.bid!, ask: quote.ask!, midpoint: quote.midpoint, closesAt: market.endDate,
        updatedAt: market.updatedAt, rulesExcerpt: rules.slice(0, 600), rulesHash: hash(rules) }];
    }).sort((a, b) => b.midpoint - a.midpoint || a.id.localeCompare(b.id));
    const selectedContracts = contracts.slice(0, 6);
    const closesAt = supportedDecision?.closesAt ?? selectedContracts.map((m) => m.closesAt)
      .sort((a, b) => Date.parse(a) - Date.parse(b))[0];
    if (!closesAt || Date.parse(closesAt) <= now || Date.parse(closesAt) > now + 90 * DAY ||
        (!supportedDecision && !contracts.length)) continue;
    candidates.push({ eventId: event.id, title: event.title, eventUrl: `https://polymarket.com/event/${event.slug}`,
      topic, closesAt, volume24h: event.volume24hr, activeContracts: active.length,
      contracts: supportedDecision ? [] : selectedContracts, decision: supportedDecision });
  }
  candidates.sort((a, b) => b.volume24h - a.volume24h || Date.parse(a.closesAt) - Date.parse(b.closesAt) || a.eventId.localeCompare(b.eventId));
  const seen = new Set<OutlookTopic>();
  const items = candidates.filter((item) => {
    if (seen.has(item.topic)) return false;
    seen.add(item.topic);
    return true;
  }).slice(0, 3);
  const digest: EventOutlooks = { version: 1, methodology: OUTLOOK_METHOD, asOf, screened: events.length, items };
  // Preserve higher-ranked cards if rule excerpts make the optional digest too large.
  while (Buffer.byteLength(JSON.stringify(digest)) > OUTLOOK_MAX_BYTES && items.length) items.pop();
  return validateEventOutlooks(digest, asOf);
}

/** Independently validate the saved optional digest before serving it. */
export function validateEventOutlooks(value: unknown, asOf: string): EventOutlooks {
  const d = value as EventOutlooks;
  const now = Date.parse(asOf);
  const fail = () => { throw new Error("Invalid event outlooks"); };
  if (!d || d.version !== 1 || d.methodology !== OUTLOOK_METHOD || d.asOf !== asOf || !Number.isFinite(now) ||
      !Number.isInteger(d.screened) || d.screened < 0 || !Array.isArray(d.items) || d.items.length > 3 ||
      Buffer.byteLength(JSON.stringify(d)) > OUTLOOK_MAX_BYTES) return fail();
  const ids = new Set<string>(), topics = new Set<OutlookTopic>();
  for (const item of d.items) {
    if (!item || typeof item.eventId !== "string" || !item.eventId || ids.has(item.eventId) || topics.has(item.topic) ||
        typeof item.title !== "string" || !item.title || item.title.length > 240 || outlookTopic(item.title) !== item.topic ||
        !/^https:\/\/polymarket\.com\/event\/[a-z0-9-]+$/.test(item.eventUrl) ||
        !Number.isFinite(item.volume24h) || item.volume24h < 10_000 || !Number.isInteger(item.activeContracts) || item.activeContracts < 1 ||
        !Number.isFinite(Date.parse(item.closesAt)) || Date.parse(item.closesAt) <= now || Date.parse(item.closesAt) > now + 90 * DAY ||
        !Array.isArray(item.contracts) || item.contracts.length > 6 || item.contracts.length > item.activeContracts) return fail();
    ids.add(item.eventId); topics.add(item.topic);
    if (item.decision) {
      validateDecisionDistribution(item.decision, asOf);
      if (item.topic !== "Central banks" || item.contracts.length || item.decision.eventId !== item.eventId ||
          item.decision.eventUrl !== item.eventUrl || item.decision.closesAt !== item.closesAt) return fail();
    } else {
      if (item.decision !== null || !item.contracts.length) return fail();
      const contractIds = new Set<string>();
      for (const c of item.contracts) {
        if (!c || typeof c.id !== "string" || !c.id || contractIds.has(c.id) ||
            typeof c.question !== "string" || !c.question || c.question.length > 300 ||
            typeof c.label !== "string" || !c.label || c.label.length > 180 ||
            ![c.bid, c.ask, c.midpoint].every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1) ||
            c.ask <= 0 || c.bid > c.ask || c.ask - c.bid > 0.10 + 1e-9 || Math.abs(c.midpoint - (c.bid + c.ask) / 2) > 1e-9 ||
            !fresh(c.updatedAt, now) || !Number.isFinite(Date.parse(c.closesAt)) || Date.parse(c.closesAt) <= now ||
            Date.parse(c.closesAt) > now + 90 * DAY || typeof c.rulesExcerpt !== "string" || !c.rulesExcerpt ||
            c.rulesExcerpt.length > 600 || !/^[a-f0-9]{64}$/.test(c.rulesHash)) return fail();
        contractIds.add(c.id);
      }
      if (Date.parse(item.closesAt) !== Math.min(...item.contracts.map((c) => Date.parse(c.closesAt)))) return fail();
    }
  }
  return d;
}
