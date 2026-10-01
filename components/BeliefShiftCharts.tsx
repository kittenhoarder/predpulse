import { observationMove, type BeliefShiftProduct, type IndexObservation } from "@/lib/index-products";

export function MovementScale({ value }: { value: number | null }) {
  return <div aria-label={value === null ? "24-hour movement not yet available" : `Average absolute movement ${value.toFixed(1)} percentage points`}>
    <svg viewBox="0 0 300 26" className="h-7 w-full" aria-hidden="true">
      {Array.from({ length: 30 }, (_, i) => <rect key={i} x={i * 10} y="3" width="6" height="20" rx="2"
        fill="currentColor" className={value !== null && i < Math.ceil(Math.min(value, 10) * 3) ? "text-primary" : "text-muted-foreground/15"}
        opacity={value !== null && i < Math.ceil(Math.min(value, 10) * 3) ? 0.35 + i / 45 : 1} />)}
      {value === 0 && <circle cx="3" cy="13" r="3" className="fill-primary" />}
    </svg>
    <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground"><span>0</span><span>5</span><span>{value !== null && value > 10 ? "10+ pp →" : "10+ pp"}</span></div>
  </div>;
}

export function ProbabilityPair({ row, compact = false }: { row: IndexObservation; compact?: boolean }) {
  const now = row.quote?.midpoint, prior = row.prior?.midpoint;
  const move = observationMove(row);
  return <div className={compact ? "space-y-1" : "space-y-2"}>
    {!compact && <div className="flex items-start justify-between gap-3 text-xs">
      <span className="min-w-0 leading-relaxed">{row.question}</span>
      <span className="shrink-0 font-mono text-primary">{move !== null ? `${move > 0 ? "+" : ""}${move.toFixed(1)} pp` : now !== undefined ? `${(now * 100).toFixed(1)}%` : "Unavailable"}</span>
    </div>}
    <svg viewBox="0 0 400 26" className="h-7 w-full" role="img"
      aria-label={`${row.question}: ${prior !== undefined ? `previous ${(prior * 100).toFixed(1)}%, ` : ""}${now !== undefined ? `captured ${(now * 100).toFixed(1)}%` : "quote unavailable"}`}>
      <line x1="8" x2="392" y1="13" y2="13" className="stroke-muted-foreground/20" />
      {[0, 25, 50, 75, 100].map((n) => <line key={n} x1={8 + n * 3.84} x2={8 + n * 3.84} y1="9" y2="17" className="stroke-muted-foreground/25" />)}
      {now !== undefined && prior !== undefined && <line x1={8 + prior * 384} x2={8 + now * 384} y1="13" y2="13" className="stroke-primary" strokeWidth="3" strokeLinecap="round" />}
      {prior !== undefined && <circle cx={8 + prior * 384} cy="13" r="4" className="fill-card stroke-muted-foreground" strokeWidth="1.5" />}
      {now !== undefined && <circle cx={8 + now * 384} cy="13" r="5" className="fill-primary" />}
    </svg>
    {!compact && <div className="flex justify-between text-[10px] text-muted-foreground"><span>0% YES</span><span>50%</span><span>100%</span></div>}
  </div>;
}

export function ShiftHistory({ product }: { product: BeliefShiftProduct }) {
  const points = product.history;
  const valid = points.filter((p) => p.value !== null);
  if (valid.length < 2) return <p className="rounded-xl bg-muted/40 p-4 text-xs text-muted-foreground">The trend appears as comparable hourly observations accumulate.</p>;
  const start = Date.parse(points[0].at), end = Date.parse(points.at(-1)!.at);
  const max = Math.max(10, ...valid.map((p) => p.value!));
  const x = (at: string) => 40 + (Date.parse(at) - start) / Math.max(1, end - start) * 510;
  const y = (value: number) => 116 - value / max * 100;
  return <div>
    <svg viewBox="0 0 570 150" className="w-full" role="img" aria-label="Saved average 24-hour movement over time. Gaps mark unavailable or incompatible samples.">
      {[0, max / 2, max].map((v) => <g key={v}><line x1="40" x2="550" y1={y(v)} y2={y(v)} className="stroke-muted-foreground/15" /><text x="30" y={y(v) + 4} textAnchor="end" className="fill-muted-foreground text-[18px] sm:text-[10px]">{v.toFixed(0)}</text></g>)}
      {points.map((p, i) => {
        const prev = points[i - 1];
        return <g key={p.at}>{p.value !== null && prev?.value != null && p.segment === prev.segment && Date.parse(p.at) - Date.parse(prev.at) <= 90 * 60_000 &&
          <line x1={x(prev.at)} x2={x(p.at)} y1={y(prev.value)} y2={y(p.value)} className="stroke-primary" strokeWidth="2" />}
          {p.value !== null && <circle cx={x(p.at)} cy={y(p.value)} r="2.5" className="fill-primary" />}</g>;
      })}
      <text x="40" y="143" className="fill-muted-foreground text-[18px] sm:text-[10px]">{new Date(points[0].at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</text>
      <text x="550" y="143" textAnchor="end" className="fill-muted-foreground text-[18px] sm:text-[10px]">{new Date(points.at(-1)!.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</text>
      <text x="40" y="13" className="fill-muted-foreground text-[18px] sm:text-[10px]">pp</text>
    </svg>
    <details className="text-xs text-muted-foreground"><summary className="flex min-h-11 cursor-pointer items-center">View saved trend values</summary>
      <ul className="space-y-1">{points.map((p) => <li key={p.at}>{new Date(p.at).toLocaleString()} · {p.value === null ? "Unavailable" : `${p.value.toFixed(2)} pp`}</li>)}</ul>
    </details>
  </div>;
}
