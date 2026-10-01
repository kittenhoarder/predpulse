/** Client-safe saved contract. No acquisition or probability history. */
export const ATTENTION_METHOD = "reported-event-volume-v1";
export const ATTENTION_CLASSIFIER = "attention-tags-v1";
export const ATTENTION_MAX_BYTES = 4_000;
export const ATTENTION_CATEGORIES = ["sports", "weather", "crypto", "economics", "technology", "politics", "other"] as const;
export type AttentionCategory = typeof ATTENTION_CATEGORIES[number];
export const ATTENTION_LABELS: Record<AttentionCategory, string> = {
  sports: "Sports", weather: "Weather", crypto: "Crypto", economics: "Economics", technology: "Technology", politics: "Politics", other: "Other",
};
export const ATTENTION_COLOURS: Record<AttentionCategory, string> = {
  sports: "#14b8a6", weather: "#38bdf8", crypto: "#fbbf24", economics: "#a78bfa", technology: "#fb7185", politics: "#60a5fa", other: "#94a3b8",
};
export interface AttentionSource { id: string; slug: string; title: string; volume: number }
export interface AttentionGroup {
  key: AttentionCategory; volume: number; count: number; share: number; sources: AttentionSource[];
}
export interface MarketAttention {
  id: "market-attention"; type: "market-attention";
  methodology: typeof ATTENTION_METHOD; classifier: typeof ATTENTION_CLASSIFIER;
  asOf: string; state: "available" | "empty" | "unavailable";
  issue: "no_eligible_events" | "input_limit" | "arithmetic_overflow" | null;
  screened: number; included: number; totalVolume: number;
  exclusions: Record<string, number>; tagFallbacks: number; sourceUnavailable: number;
  categories: AttentionGroup[];
}
export function leadingAttentionCategory(map: MarketAttention): AttentionGroup {
  return map.categories.reduce((best, group) => group.volume > best.volume ? group : best);
}
