function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function brierScore(predictions: number[], outcomes: number[]): number {
  if (predictions.length === 0 || predictions.length !== outcomes.length) return 0;
  let sum = 0;
  for (let i = 0; i < predictions.length; i++) {
    const p = clamp(predictions[i], 0, 1);
    const y = outcomes[i] > 0 ? 1 : 0;
    const err = p - y;
    sum += err * err;
  }
  return sum / predictions.length;
}

export function logLoss(predictions: number[], outcomes: number[]): number {
  if (predictions.length === 0 || predictions.length !== outcomes.length) return 0;
  const eps = 1e-12;
  let sum = 0;
  for (let i = 0; i < predictions.length; i++) {
    const p = clamp(predictions[i], eps, 1 - eps);
    const y = outcomes[i] > 0 ? 1 : 0;
    sum += y * Math.log(p) + (1 - y) * Math.log(1 - p);
  }
  return -sum / predictions.length;
}

export function calibrationSlope(predictions: number[], outcomes: number[]): number {
  if (predictions.length < 3 || predictions.length !== outcomes.length) return 0;

  const x = predictions.map((p) => {
    const pp = clamp(p, 1e-6, 1 - 1e-6);
    return Math.log(pp / (1 - pp));
  });
  const y: number[] = outcomes.map((o) => (o > 0 ? 1 : 0));

  const meanX = x.reduce((s, v) => s + v, 0) / x.length;
  const meanY = y.reduce((s, v) => s + v, 0) / y.length;

  let num = 0;
  let den = 0;
  for (let i = 0; i < x.length; i++) {
    num += (x[i] - meanX) * (y[i] - meanY);
    den += (x[i] - meanX) * (x[i] - meanX);
  }

  if (den === 0) return 0;
  return num / den;
}

interface Ranked {
  score: number;
  label: number;
}

export function auc(scores: number[], labels: number[]): number {
  if (scores.length < 2 || scores.length !== labels.length) return 0.5;

  const ranked: Ranked[] = scores.map((score, i) => ({ score, label: labels[i] > 0 ? 1 : 0 }));
  ranked.sort((a, b) => b.score - a.score);

  const pos = ranked.reduce((s, r) => s + (r.label === 1 ? 1 : 0), 0);
  const neg = ranked.length - pos;
  if (pos === 0 || neg === 0) return 0.5;

  let tp = 0;
  let fp = 0;
  let prevTpRate = 0;
  let prevFpRate = 0;
  let prevScore = Number.POSITIVE_INFINITY;
  let area = 0;

  for (const r of ranked) {
    if (r.score !== prevScore) {
      const tpr = tp / pos;
      const fpr = fp / neg;
      area += (fpr - prevFpRate) * (tpr + prevTpRate) * 0.5;
      prevTpRate = tpr;
      prevFpRate = fpr;
      prevScore = r.score;
    }
    if (r.label === 1) tp += 1;
    else fp += 1;
  }

  const finalTpr = tp / pos;
  const finalFpr = fp / neg;
  area += (finalFpr - prevFpRate) * (finalTpr + prevTpRate) * 0.5;

  return clamp(area, 0, 1);
}

export interface ForecastMetricSummary {
  brier: number;
  logLoss: number;
  calibrationSlope: number;
  directionalAuc24h: number;
  sampleSize: number;
}

export function summarizeForecastMetrics(predictions: number[], outcomes: number[], directionalScores: number[], directionalLabels: number[]): ForecastMetricSummary {
  return {
    brier: brierScore(predictions, outcomes),
    logLoss: logLoss(predictions, outcomes),
    calibrationSlope: calibrationSlope(predictions, outcomes),
    directionalAuc24h: auc(directionalScores, directionalLabels),
    sampleSize: predictions.length,
  };
}
