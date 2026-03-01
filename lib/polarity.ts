export type MarketPolarity = 1 | -1;

const NEGATIVE_HINTS = [
  "recession",
  "crash",
  "default",
  "bankrupt",
  "bankruptcy",
  "layoff",
  "war",
  "conflict",
  "shutdown",
  "impeach",
  "ban",
  "hack",
  "attack",
  "drop",
  "fall",
  "decrease",
  "decline",
  "under",
  "below",
  "less than",
  "miss",
  "lose",
  "cut",
  "debt ceiling breach",
  "drought",
  "hurricane",
  "storm",
  "outbreak",
  "pandemic",
];

const POSITIVE_HINTS = [
  "growth",
  "increase",
  "rise",
  "above",
  "over",
  "more than",
  "beat",
  "exceed",
  "surpass",
  "approval",
  "pass",
  "win",
  "adoption",
  "launch",
  "upgrade",
  "rally",
  "expand",
  "improve",
  "recover",
  "new high",
  "record high",
];

export function inferPolarity(question: string): MarketPolarity {
  const q = question.toLowerCase();

  const hasNeg = NEGATIVE_HINTS.some((hint) => q.includes(hint));
  const hasPos = POSITIVE_HINTS.some((hint) => q.includes(hint));

  if (hasNeg && !hasPos) return -1;
  if (hasPos && !hasNeg) return 1;

  if (/\b(will|does|is)\b.*\b(fall|drop|decline|decrease)\b/.test(q)) return -1;
  if (/\b(will|does|is)\b.*\b(rise|increase|grow|recover)\b/.test(q)) return 1;
  if (/\b(under|below|less than)\b/.test(q) && !/\b(above|over|more than)\b/.test(q)) return -1;
  if (/\b(above|over|more than)\b/.test(q) && !/\b(under|below|less than)\b/.test(q)) return 1;

  return 1;
}

export function normalizeDirection(value: number, polarity: MarketPolarity): number {
  return value * polarity;
}
