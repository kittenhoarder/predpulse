import type { OutcomeBenchmark } from "@/lib/index-products";
const names = ["Cut", "Hold", "Hike"];
const colors = ["text-sky-400", "text-primary", "text-amber-400"];
const signed = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}`;

export function PolicyBalance({ product }: { product: OutcomeBenchmark }) {
  const { headline, prior } = product;
  return (
    <div>
      <svg
        viewBox="0 0 320 46"
        className="w-full"
        role="img"
        aria-label={
          headline === null
            ? "Policy balance unavailable"
            : `Policy balance ${signed(headline)} percentage points on a minus 100 cut to plus 100 hike axis`
        }
      >
        <line
          x1="10"
          x2="310"
          y1="23"
          y2="23"
          className="stroke-muted-foreground/20"
          strokeWidth="4"
          strokeLinecap="round"
        />
        {[-100, -50, 0, 50, 100].map((n) => (
          <line
            key={n}
            x1={160 + n * 1.5}
            x2={160 + n * 1.5}
            y1={n === 0 ? 13 : 19}
            y2={n === 0 ? 33 : 27}
            className="stroke-muted-foreground/40"
          />
        ))}
        {headline !== null && (
          <line
            x1="160"
            x2={160 + headline * 1.5}
            y1="23"
            y2="23"
            className={headline < 0 ? "stroke-sky-400" : "stroke-amber-400"}
            strokeWidth="4"
          />
        )}
        {prior && (
          <circle
            cx={160 + prior.headline * 1.5}
            cy="23"
            r="5"
            className="fill-card stroke-muted-foreground"
            strokeWidth="1.5"
          />
        )}
        {headline !== null && (
          <circle
            cx={160 + headline * 1.5}
            cy="23"
            r="6"
            className="fill-primary stroke-card"
            strokeWidth="2"
          />
        )}
      </svg>
      <div
        data-axis
        className="flex justify-between text-[10px] text-muted-foreground"
      >
        <span>−100 · Cut</span>
        <span>0</span>
        <span>Hike · +100</span>
      </div>
    </div>
  );
}

export function DirectionShares({ product }: { product: OutcomeBenchmark }) {
  if (!product.shares)
    return (
      <p className="rounded-xl bg-muted/40 p-4 text-xs text-muted-foreground">
        A complete, coherent five-outcome meeting is required.
      </p>
    );
  const shares = product.shares;
  const rects = (values: number[], outline: boolean) =>
    values.map((n, i) => {
      const x = values.slice(0, i).reduce((s, v) => s + v, 0) * 300;
      return (
        <rect
          key={i}
          x={x + 1}
          y={outline ? 27 : 2}
          width={Math.max(0, n * 300 - 2)}
          height={outline ? 10 : 18}
          rx="3"
          fill={outline ? "none" : "currentColor"}
          stroke={outline ? "currentColor" : "none"}
          className={colors[i]}
        />
      );
    });
  return (
    <div>
      <svg
        viewBox={`0 0 300 ${product.prior ? 39 : 22}`}
        className="w-full"
        role="img"
        aria-label={`Normalized captured shares: ${names.map((name, i) => `${name} ${(shares[i] * 100).toFixed(1)}%`).join(", ")}${product.prior ? `. Previous: ${names.map((name, i) => `${name} ${(product.prior!.shares[i] * 100).toFixed(1)}%`).join(", ")}` : ""}`}
      >
        {rects(shares, false)}
        {product.prior && rects(product.prior.shares, true)}
      </svg>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        {names.map((name, i) => (
          <div key={name}>
            <span className={colors[i]}>{name}</span>
            <div className="mt-1 font-mono">
              {(shares[i] * 100).toFixed(1)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
export function OutcomeSummary({ product }: { product: OutcomeBenchmark }) {
  const dominant = product.shares
    ? names[product.shares.indexOf(Math.max(...product.shares))]
    : null;
  return (
    <>
      <div className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-mono text-4xl font-medium tracking-tight">
          {product.headline === null ? "—" : signed(product.headline)}
        </span>
        <span className="text-xs text-muted-foreground">pp balance</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {dominant
          ? `${dominant} leads · ${product.meetingDate}`
          : product.issue?.replaceAll("_", " ")}
      </p>
      <div className="mt-3">
        <PolicyBalance product={product} />
      </div>
      <div className="mt-5">
        <DirectionShares product={product} />
      </div>
      <p className="mt-4 text-[11px] text-muted-foreground">
        {product.change24h === null
          ? `${product.comparisonIssue?.replaceAll("_", " ")} · 24h comparison`
          : `${signed(product.change24h)} pp over 24h`}
      </p>
    </>
  );
}
export function OutcomeHistory({ product }: { product: OutcomeBenchmark }) {
  const points = product.history;
  const valid = points.filter((p) => p.value !== null);
  if (valid.length < 2)
    return (
      <p className="rounded-xl bg-muted/40 p-4 text-xs text-muted-foreground">
        The balance trend appears as actual hourly captures accumulate.
      </p>
    );
  const start = Date.parse(points[0].at),
    end = Date.parse(points.at(-1)!.at);
  const x = (at: string) =>
    35 + (510 * (Date.parse(at) - start)) / Math.max(1, end - start);
  const y = (value: number) => 75 - value * 0.5;
  return (
    <div>
      <svg
        viewBox="0 0 570 155"
        className="w-full"
        role="img"
        aria-label="Saved policy balance on a fixed minus 100 to plus 100 axis. Gaps mark unavailable captures or changed meetings."
      >
        {[-100, 0, 100].map((n) => (
          <g key={n}>
            <line
              x1="35"
              x2="545"
              y1={y(n)}
              y2={y(n)}
              className="stroke-muted-foreground/20"
            />
            <text
              data-axis
              x="28"
              y={y(n) + 4}
              textAnchor="end"
              className="fill-muted-foreground text-[12px]"
            >
              {n}
            </text>
          </g>
        ))}
        {points.map((p, i) => {
          const prev = points[i - 1];
          return (
            <g key={p.at}>
              {p.value !== null &&
                prev?.value != null &&
                p.segment === prev.segment &&
                Date.parse(p.at) - Date.parse(prev.at) <= 90 * 60_000 && (
                  <line
                    x1={x(prev.at)}
                    x2={x(p.at)}
                    y1={y(prev.value)}
                    y2={y(p.value)}
                    className="stroke-primary"
                    strokeWidth="2"
                  />
                )}
              {p.value !== null && (
                <circle
                  cx={x(p.at)}
                  cy={y(p.value)}
                  r="3"
                  className="fill-primary"
                />
              )}
            </g>
          );
        })}
        <text
          data-axis
          x="35"
          y="150"
          className="fill-muted-foreground text-[12px]"
        >
          {new Date(points[0].at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </text>
        <text
          data-axis
          x="545"
          y="150"
          textAnchor="end"
          className="fill-muted-foreground text-[12px]"
        >
          {new Date(points.at(-1)!.at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </text>
      </svg>
      <details className="text-xs text-muted-foreground">
        <summary className="flex min-h-11 cursor-pointer items-center">
          View saved trend values
        </summary>
        <ul>
          {points.map((p) => (
            <li key={p.at}>
              {new Date(p.at).toLocaleString()} ·{" "}
              {p.value === null ? "Unavailable" : `${signed(p.value)} pp`}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
