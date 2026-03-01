import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

/**
 * Generates an OG image for a market detail share card.
 *
 * Query params:
 *   title    — market question (truncated)
 *   prob     — current probability as number 0–100
 *   change   — 24h change string e.g. "+7.3%"
 *   category — category label e.g. "Politics"
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title") ?? "Prediction Market";
  const prob = searchParams.get("prob") ?? "—";
  const change = searchParams.get("change") ?? "0%";
  const category = searchParams.get("category") ?? "";

  const changeNum = parseFloat(change);
  const isPositive = changeNum > 0;
  const isNeutral = changeNum === 0 || isNaN(changeNum);
  const changeColor = isNeutral ? "#9ca3af" : isPositive ? "#34d399" : "#f87171";

  // Truncate long questions for the card
  const displayTitle =
    title.length > 120 ? title.slice(0, 117) + "…" : title;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: "#09090b",
          padding: "48px",
          fontFamily: "sans-serif",
          justifyContent: "space-between",
        }}
      >
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Pulse-wave mark — inlined because edge runtime can't import components */}
          <svg
            width="32"
            height="32"
            viewBox="0 0 40 40"
            fill="none"
            stroke="#6366f1"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="2,20 10,20 15,6 20,34 25,20 30,20 33,12 36,26 40,20" />
          </svg>
          <span style={{ color: "#e4e4e7", fontWeight: 600, fontSize: "18px" }}>
            Predpulse
          </span>
          {category && (
            <span
              style={{
                marginLeft: "8px",
                padding: "4px 12px",
                borderRadius: "999px",
                backgroundColor: "#27272a",
                color: "#a1a1aa",
                fontSize: "13px",
              }}
            >
              {category}
            </span>
          )}
        </div>

        {/* Market question */}
        <div
          style={{
            color: "#fafafa",
            fontSize: "32px",
            fontWeight: 600,
            lineHeight: 1.3,
            flex: 1,
            display: "flex",
            alignItems: "center",
            paddingTop: "32px",
            paddingBottom: "32px",
          }}
        >
          {displayTitle}
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: "48px", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ color: "#71717a", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Probability
            </span>
            <span style={{ color: "#fafafa", fontSize: "48px", fontWeight: 700, lineHeight: 1 }}>
              {prob}%
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ color: "#71717a", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              24h Change
            </span>
            <span style={{ color: changeColor, fontSize: "36px", fontWeight: 700, lineHeight: 1 }}>
              {isPositive && !change.startsWith("+") ? "+" : ""}{change}
            </span>
          </div>
          {/* Right-align the powered-by */}
          <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
            <span style={{ color: "#52525b", fontSize: "13px" }}>predpulse.xyz</span>
            <span style={{ color: "#3f3f46", fontSize: "12px" }}>via Polymarket</span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
