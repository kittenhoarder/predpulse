export const THESIS =
  "Prediction markets put a price on what people expect to happen. Predpulse shows how those expectations are moving — and the evidence behind every number.";
export type GuideId =
  | "thesis"
  | "freshness"
  | "moves"
  | "observed-moves"
  | "closing-soon"
  | "outlooks"
  | "belief-shift"
  | "policy-balance"
  | "market-attention"
  | "across-venues"
  | "newsroom"
  | "markets"
  | "saved"
  | "evidence";
export interface GuideEntry {
  id: GuideId;
  name: string;
  pillar: "follow" | "measure" | "browse" | "understand";
  hook: string;
  why: string;
  see: string[];
  read: string[];
  limits: string[];
  method?: string;
  related: GuideId[];
}
type Entry = Omit<GuideEntry, "id" | "method">;
const entries: Record<GuideId, Entry> = {
  thesis: {
    name: "How Predpulse works",
    pillar: "understand",
    hook: "Expectations, movement, evidence",
    why: "You can follow what people expect to happen, see how those expectations move, and check the evidence behind each reading.",
    see: [
      "Moves follow changing odds; Outlooks compare upcoming events.",
      "Indices summarize movement, policy outcomes and activity; Markets let you explore.",
    ],
    read: [
      "Start with Today's briefing, then open a pillar for more detail.",
      "Use the information icon for explanations and the shield for item evidence.",
    ],
    limits: [
      "Hourly snapshots of a selected sample of Polymarket, Kalshi and Manifold markets; not live prices or every market.",
      "Coverage may be incomplete or delayed. Not financial advice. Not affiliated with source venues.",
    ],
    related: ["moves", "outlooks", "evidence"],
  },
  freshness: {
    name: "Snapshot freshness",
    pillar: "understand",
    hook: "Know how current your reading is",
    why: "You can check when expectations were captured before relying on a number. Every reading belongs to a dated publication.",
    see: [
      "One status control in the header; exact times and selected-universe counts here.",
    ],
    read: [
      "Updated: within 75 minutes. Delayed: 75 minutes to three hours. Last known: older than three hours; current movers are withheld.",
      "An unavailable publication is missing data, never a zero.",
    ],
    limits: [
      "Publishing is scheduled hourly and may be delayed. Prices and changes are dated snapshots, not live quotes.",
      "Index evidence has its own age rules; current summaries also require a non-stale publication.",
      "Source-record update times are not timestamps of the last trade.",
    ],
    related: ["evidence", "markets"],
  },
  moves: {
    name: "Moves",
    pillar: "follow",
    hook: "What changed in the last day",
    why: "You can follow the biggest shifts in policy and economic expectations, screened so thin or noisy contracts do not crowd out usable readings.",
    see: [
      "Policy and economy moves, saved-market comparisons, and approaching closes.",
    ],
    read: [
      "Change is in percentage points: 40% to 43% is +3 pp.",
      "Saved changes compare the same outcome and price basis against your previous visit.",
    ],
    limits: [
      "Politics, economics and geopolitics contracts pass comparability, volume, liquidity or open-interest, quoted-spread and time-until-close checks.",
      "One outcome per source event. Sampled coverage; contracts across venues are not treated as equivalent.",
      "Price changes do not explain causes or predict outcomes. Last-trade changes and ask changes are different measurements.",
    ],
    related: ["observed-moves", "closing-soon", "saved"],
  },
  "observed-moves": {
    name: "Observed moves",
    pillar: "follow",
    hook: "Big moves across all topics",
    why: "You can spot changing expectations beyond policy, with captured trading activity available to help you judge each move.",
    see: ["Selected moves across topics, their odds and daily changes."],
    read: [
      "Positive changes rose; negative changes fell. The shield shows the captured quote basis and activity.",
    ],
    limits: [
      "Requires a 5–50 pp move, at most 5 pp spread and at least 24 hours until close.",
      "Polymarket requires $10k each in 24h volume and liquidity. Kalshi requires 500 contracts traded and 500 open interest.",
      "Kalshi compares last trade prices; its table quote is the YES ask. Manifold lacks a dependable 24h move.",
      "Coverage counts show eligible markets out of examined markets. Observations are not explanations or forecasts.",
    ],
    related: ["moves", "markets", "evidence"],
  },
  "closing-soon": {
    name: "Closing soon",
    pillar: "follow",
    hook: "Deadlines worth following",
    why: "You can find policy and economic questions whose trading deadlines are approaching, then inspect the expectations priced into them.",
    see: ["Up to three sampled markets closing within seven days."],
    read: ["Open a question for its own rules and captured quote."],
    limits: [
      "Close times are trading deadlines, not verified event dates or public result times.",
      "Selected policy and economy markets only; not a comprehensive calendar.",
    ],
    related: ["moves", "outlooks"],
  },
  outlooks: {
    name: "Outlooks",
    pillar: "follow",
    hook: "How big events are priced",
    why: "You can compare the odds on upcoming events and see how closely priced the alternatives are, with evidence for each contract.",
    see: [
      "A link to the single Fed view, then selected event cards and contract prices.",
    ],
    read: [
      "Each bar is the chance priced for its own contract question, not a share of a verified complete event.",
      "Overlapping contracts are not normalized. Only the explicit Fed adapter verifies a complete outcome partition.",
    ],
    limits: [
      "Sampled Polymarket central-bank decisions, elections, economic releases and policy or geopolitical deadlines; no pooled venues.",
      "Events require $10,000 reported 24h volume and a future close within 90 days.",
      "Ranked by activity, then earliest close: one event per topic, at most three cards. Not an objective importance ranking or comprehensive calendar.",
      "Up to six contracts ranked by midpoint, not a complete candidate list. Alternatives can overlap or leave outcomes uncovered.",
      "Quotes must be two-sided, uncrossed, at most 10 pp wide, updated within 75 minutes of publication, and close within 90 days.",
      "Venue update times do not guarantee recent trades. Close times are deadlines, not verified event dates.",
      "No total, normalized shares or expected outcome for unverified sets. Missing sampled events do not establish that contracts do not exist.",
      "Computed during hourly publication; no additional vendor requests. Methodology: event-outlooks-v1.",
    ],
    related: ["policy-balance", "closing-soon", "evidence"],
  },
  "belief-shift": {
    name: "Belief Shift",
    pillar: "measure",
    hook: "Calm day or turbulent?",
    why: "You can compare how much expectations moved from day to day, using one reading across a fixed sample of questions.",
    see: ["Category readings, a movement scale and saved trends."],
    read: [
      "Equal-weight average absolute 24h change in YES midpoints, in percentage points. Higher means more movement in either direction.",
      "A 24h score needs comparable saved quotes; unavailable coverage is not zero.",
    ],
    limits: [
      "One pinned contract per venue event, up to eight near-term events per category; at least five comparable events and 80% coverage required.",
      "Selected by activity, not representative of the whole venue. Not a category probability; no bullish/bearish interpretation.",
      "Cohort and comparable-sample changes break the trend. No historical Pulse score is converted into Belief Shift.",
      "Weekly pinned cohorts. Source-record updates are not last-trade timestamps. Indices are analytical measurements, not investable funds.",
    ],
    related: ["moves", "policy-balance", "market-attention"],
  },
  "policy-balance": {
    name: "Fed policy balance",
    pillar: "measure",
    hook: "Which way the Fed leans",
    why: "You can inspect expectations for the next supported Fed decision, see the leading outcome and compare the evidence behind the alternatives.",
    see: ["One meeting's balance, outcome distribution and saved history."],
    read: [
      "Positive balance leans hike; negative leans cut. Balance is normalized Hike share minus Cut share. Hold is separate.",
      "Raw shows each YES midpoint; Normalized divides the complete set by its total to 100%.",
    ],
    limits: [
      "Not a probability or an expected rate change. One supported upcoming meeting, with its date displayed; other meetings and venues are not combined.",
      "Five buckets describe changes in the upper bound of the target federal funds rate under one shared rule set.",
      "Nonstandard changes round up to the nearest 25 bp under venue rules. Outer buckets have no finite upper bound.",
      "Normalization requires complete rules, valid books, spreads at most 10 pp, updates within 75 minutes and a raw total of 95–105%.",
      "Eligibility is not forecast accuracy or executable prices. Stale current summaries are withheld; dated evidence remains inspectable.",
      "Identity, meeting or rule changes break comparisons. Missing evidence is unavailable, not zero.",
      "Saved evidence fingerprints detect rules revisions; full source rules are not embedded in the index download.",
      "Methodology: fed-meeting-buckets-v1 and fed-policy-balance-v1. Discovery runs during hourly publication on sampled coverage.",
    ],
    related: ["outlooks", "belief-shift", "evidence"],
  },
  "market-attention": {
    name: "Market Attention",
    pillar: "measure",
    hook: "Where activity is concentrating",
    why: "You can see which topics dominate captured trading activity and follow when attention shifts between stories.",
    see: [
      "Seven categories sized by their share of reported daily trading volume.",
    ],
    read: [
      "Area shows share of captured 24h dollar volume; labels and colours identify categories.",
      "Event families are counted once. The map can display on its first capture.",
    ],
    limits: [
      "Bounded sampled Polymarket events; not sentiment, inflows, a probability or the whole market.",
      "Volume is venue-reported activity, not unique people or capital. Example source rows are not a full constituent archive.",
      "Rectangle areas use unrounded shares before separators. Rounded percentages may not total exactly 100%; small categories remain available in the legend.",
      "Stable category colours carry no probability or bullish/bearish interpretation. Feed capped at 500 active events ordered by activity.",
      "Exact-tag precedence: Sports, Weather, Crypto, Economics, Technology, Politics, Other. Unknown tags use Other.",
      "Events renew at publication; no historical comparison is shown. Source examples cannot reproduce the full denominator.",
    ],
    related: ["belief-shift", "markets", "newsroom"],
  },
  "across-venues": {
    name: "Across venues",
    pillar: "browse",
    hook: "Similar questions, two prices",
    why: "You can compare expectations on related questions across venues, then inspect why similar prices may refer to different contracts.",
    see: ["Two venue contracts, their questions and captured prices."],
    read: [
      "The warning badge opens the matching and settlement limits. The shield opens each contract's own evidence.",
    ],
    limits: [
      "Similar titles only, or shared category when no event match exists. A topic match is not a check of settlement rules.",
      "Separate contracts; settlement may differ. Category matches can concern different events.",
      "Prices use venue-specific outcomes and quote bases. A price difference is not an arbitrage opportunity. Inspect both original rule sets.",
    ],
    related: ["markets", "evidence"],
  },
  newsroom: {
    name: "Newsroom",
    pillar: "follow",
    hook: "Headlines next to odds",
    why: "You can read headlines alongside expectations on the same topic and inspect where the odds stand on the story.",
    see: ["Three headline cards with related markets."],
    read: ["Open the article for reporting, or the market for its contract."],
    limits: [
      "Related by topic matching, not causation. A headline does not explain a price change.",
      "News can update independently of the saved market publication.",
    ],
    related: ["moves", "outlooks"],
  },
  markets: {
    name: "Markets",
    pillar: "browse",
    hook: "Explore what else is trading",
    why: "You can explore more priced expectations, filter the selected universe and keep questions you want to follow close at hand.",
    see: [
      "A table or heatmap, venue and category filters, sorts and saved markets.",
    ],
    read: [
      "Quotes use each venue's own outcome and price basis; Kalshi displays the YES ask.",
      "Expand a market for activity, resolution rules and further context.",
    ],
    limits: [
      "Selected Polymarket, Kalshi and Manifold coverage. Dollar volume and Kalshi contract counts are not combined into one volume measure.",
      "Kalshi ask moves need comparable quotes, at least 500 contracts traded and open, and at most 5 pp spread.",
      "Liquid filter uses venue-specific size and spread checks. Missing comparable changes are unavailable, not zero.",
      "Market details may retrieve additional context when opened; snapshots are not executable trading prices.",
    ],
    related: ["saved", "across-venues", "evidence"],
  },
  saved: {
    name: "Saved",
    pillar: "browse",
    hook: "Your markets, on this device",
    why: "You can return to questions you care about and compare their expectations against your last comparable visit.",
    see: ["Stars on markets, a saved count and a saved-market filter."],
    read: [
      "Tap a star to save or remove a market. Saved-market changes compare the same outcome and quote basis.",
    ],
    limits: [
      "Saved markets and previous quotes stay in localStorage on this device. No accounts or cross-device sync.",
      "Markets outside the selected snapshot remain saved but cannot show a comparison here. Storage may be unavailable in private browsing.",
    ],
    related: ["moves", "markets"],
  },
  evidence: {
    name: "Evidence & history",
    pillar: "understand",
    hook: "Check the number's foundations",
    why: "You can inspect captured quotes, rules and identity before trusting a reading, and follow what changed between saved generations.",
    see: [
      "Item provenance, captured contract observations and downloadable saved history.",
    ],
    read: [
      "The shield opens evidence for a specific item. Missing quotes remain missing.",
      "A 24h comparison needs the same contract, outcome token, rules and close time, within 45 minutes of the target.",
    ],
    limits: [
      "Hourly publisher capture is independent of visits. Prospective sampled Polymarket cohort: one YES binary contract per event family, up to 16 contracts.",
      "Not a representative accuracy study. Each immutable generation records rules, fingerprint, quote basis, outcome identity, status and timestamps.",
      "Corrections append evidence; original generations are never overwritten. Manifest: up to 30 days and 750 generations. Earlier history is not backfilled.",
      "A venue settlement timestamp or scheduled close does not establish when a result became public.",
      "Forecast evaluation requires supported public-result-time evidence, 100 independent resolved families, uncertainty intervals and a chronological holdout.",
      "Brier loss, log loss, calibration, aggregation improvement and directional classification are unavailable, not zero, until research gates pass.",
      "Comparable saved generations must lie within 45 minutes of the 24h target; identities and quote bases must match.",
      "Category scores are never probabilities. Rules fingerprints detect revisions; full rules are not embedded in index downloads.",
    ],
    related: ["freshness", "belief-shift", "policy-balance"],
  },
};
export const GUIDE = Object.fromEntries(
  Object.entries(entries).map(([id, entry]) => [
    id,
    { ...entry, id, method: id },
  ]),
) as Record<GuideId, GuideEntry>;
export function isGuideId(id: string | null): id is GuideId {
  return !!id && Object.hasOwn(GUIDE, id);
}
