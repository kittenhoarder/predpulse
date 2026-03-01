"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { LivePrice } from "@/lib/types";

const POLY_WS_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market";
const KALSHI_WS_URL = "wss://api.elections.kalshi.com/trade-api/ws/v2";
const MANIFOLD_WS_URL = "wss://api.manifold.markets/ws";
const PING_INTERVAL_MS = 10_000;
const RECONNECT_DELAYS_MS = [2_000, 4_000, 8_000, 16_000, 30_000];

export type SocketStatus = "connecting" | "open" | "closed";

interface UseMarketSocketResult {
  livePrices: Map<string, LivePrice>;
  status: SocketStatus;
}

interface ManifoldBetMessage {
  contractId: string;
  probAfter: number;
}

/**
 * Manages a single reconnecting WebSocket connection with exponential backoff.
 * Calls onMessage for each parsed JSON message; onStatusChange on connect/disconnect.
 */
function createReconnectingSocket(params: {
  url: string;
  onOpen: (ws: WebSocket) => void;
  onMessage: (data: unknown) => void;
  onStatusChange: (s: SocketStatus) => void;
  mountedRef: React.MutableRefObject<boolean>;
}): { close: () => void } {
  const { url, onOpen, onMessage, onStatusChange, mountedRef } = params;
  let ws: WebSocket | null = null;
  let pingInterval: ReturnType<typeof setInterval> | null = null;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  let attemptCount = 0;
  let closed = false;

  function connect() {
    if (!mountedRef.current || closed) return;
    onStatusChange("connecting");
    ws = new WebSocket(url);

    ws.onopen = () => {
      if (!mountedRef.current || closed) { ws?.close(); return; }
      attemptCount = 0;
      onStatusChange("open");
      onOpen(ws!);
      pingInterval = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) ws.send("PING");
      }, PING_INTERVAL_MS);
    };

    ws.onmessage = (event) => {
      if (event.data === "PONG") return;
      try {
        onMessage(JSON.parse(event.data as string));
      } catch { /* malformed frame */ }
    };

    const reconnect = () => {
      if (!mountedRef.current || closed) return;
      if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }
      onStatusChange("closed");
      const delay = RECONNECT_DELAYS_MS[Math.min(attemptCount, RECONNECT_DELAYS_MS.length - 1)];
      attemptCount += 1;
      reconnectTimeout = setTimeout(connect, delay);
    };

    ws.onclose = reconnect;
    ws.onerror = () => ws?.close();
  }

  connect();

  return {
    close() {
      closed = true;
      if (pingInterval) clearInterval(pingInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) { ws.onclose = null; ws.close(); ws = null; }
    },
  };
}

/**
 * Subscribes to Polymarket CLOB, Kalshi, and Manifold WebSocket feeds for live price updates.
 * Returns a unified Map<marketId, LivePrice> and a combined SocketStatus.
 * Re-subscribes when tokenIds (Polymarket), kalshiTickers, or manifoldIds change.
 * No-ops server-side.
 */
export function useMarketSocket(
  tokenIds: string[],
  kalshiTickers: string[] = [],
  manifoldIds: string[] = []
): UseMarketSocketResult {
  // Ref map updated on each WS message; state flushed via rAF to batch renders
  const priceRef = useRef<Map<string, LivePrice>>(new Map());
  const [livePrices, setLivePrices] = useState<Map<string, LivePrice>>(new Map());
  const [polyStatus, setPolyStatus] = useState<SocketStatus>("closed");
  const [kalshiStatus, setKalshiStatus] = useState<SocketStatus>("closed");
  const [manifoldStatus, setManifoldStatus] = useState<SocketStatus>("closed");

  const mountedRef = useRef(true);
  const rafRef = useRef<number | null>(null);
  const tokenIdsRef = useRef(tokenIds);
  tokenIdsRef.current = tokenIds;
  const kalshiTickersRef = useRef(kalshiTickers);
  kalshiTickersRef.current = kalshiTickers;
  const manifoldIdsRef = useRef(manifoldIds);
  manifoldIdsRef.current = manifoldIds;

  const polySocketRef = useRef<{ close: () => void } | null>(null);
  const kalshiSocketRef = useRef<{ close: () => void } | null>(null);
  const manifoldSocketRef = useRef<{ close: () => void } | null>(null);

  const scheduleFlush = useCallback(() => {
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        setLivePrices(new Map(priceRef.current));
        rafRef.current = null;
      });
    }
  }, []);

  const updatePrice = useCallback((id: string, rawPrice: number) => {
    if (!id || isNaN(rawPrice)) return;
    const prev = priceRef.current.get(id);
    const flash: LivePrice["flash"] =
      prev === undefined ? null
      : rawPrice > prev.price ? "up"
      : rawPrice < prev.price ? "down"
      : prev.flash;
    priceRef.current.set(id, { price: rawPrice, flash });
    scheduleFlush();
  }, [scheduleFlush]);

  // Polymarket connection
  useEffect(() => {
    mountedRef.current = true;
    if (typeof window === "undefined" || tokenIds.length === 0) return;

    polySocketRef.current?.close();
    polySocketRef.current = createReconnectingSocket({
      url: POLY_WS_URL,
      onOpen: (ws) => {
        ws.send(JSON.stringify({
          assets_ids: tokenIdsRef.current,
          type: "market",
          custom_feature_enabled: true,
        }));
      },
      onMessage: (data) => {
        const msg = data as Record<string, unknown>;
        if (msg.event_type === "best_bid_ask" || msg.type === "best_bid_ask") {
          const tokenId = String(msg.asset_id ?? msg.market ?? "");
          const rawAsk = parseFloat(String(msg.best_ask ?? msg.ask ?? "0"));
          updatePrice(tokenId, rawAsk * 100);
        }
      },
      onStatusChange: setPolyStatus,
      mountedRef,
    });

    return () => {
      polySocketRef.current?.close();
      polySocketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenIds.join(",")]);

  // Kalshi connection
  useEffect(() => {
    if (typeof window === "undefined" || kalshiTickers.length === 0) return;

    kalshiSocketRef.current?.close();
    kalshiSocketRef.current = createReconnectingSocket({
      url: KALSHI_WS_URL,
      onOpen: (ws) => {
        // Subscribe to the public ticker channel for all visible Kalshi markets
        ws.send(JSON.stringify({
          id: 1,
          cmd: "subscribe",
          params: {
            channels: ["ticker"],
            market_tickers: kalshiTickersRef.current,
          },
        }));
      },
      onMessage: (data) => {
        // Kalshi ticker channel: { type: "ticker", msg: { market_ticker, yes_ask, yes_bid, ... } }
        const msg = data as Record<string, unknown>;
        if (msg.type === "ticker") {
          const payload = msg.msg as Record<string, unknown> | undefined;
          if (!payload) return;
          const ticker = String(payload.market_ticker ?? "");
          // yes_ask is in dollar cents string e.g. "56" (cents) — multiply by 1 gives %
          const rawAsk = parseFloat(String(payload.yes_ask ?? payload.last_price ?? "0"));
          // Kalshi sends prices in cents (0-100 scale already)
          updatePrice(ticker, rawAsk);
        }
      },
      onStatusChange: setKalshiStatus,
      mountedRef,
    });

    return () => {
      kalshiSocketRef.current?.close();
      kalshiSocketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kalshiTickers.join(",")]);

  // Manifold connection
  useEffect(() => {
    if (typeof window === "undefined" || manifoldIds.length === 0) return;

    manifoldSocketRef.current?.close();
    manifoldSocketRef.current = createReconnectingSocket({
      url: MANIFOLD_WS_URL,
      onOpen: (ws) => {
        // Subscribe to per-market new-bet events for all visible Manifold markets
        for (const id of manifoldIdsRef.current) {
          ws.send(JSON.stringify({ type: "subscribe", topic: `contract/${id}/new-bet` }));
        }
      },
      onMessage: (data) => {
        // Manifold WS message shape: { type: "new-bet", contractId, probAfter, ... }
        const msg = data as Record<string, unknown>;
        if (msg.type === "new-bet") {
          const bet = msg as unknown as ManifoldBetMessage;
          if (bet.contractId && typeof bet.probAfter === "number") {
            updatePrice(bet.contractId, Math.round(bet.probAfter * 10000) / 100);
          }
        }
      },
      onStatusChange: setManifoldStatus,
      mountedRef,
    });

    return () => {
      manifoldSocketRef.current?.close();
      manifoldSocketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifoldIds.join(",")]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      polySocketRef.current?.close();
      kalshiSocketRef.current?.close();
      manifoldSocketRef.current?.close();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Combined status: "open" if any socket is open
  const status: SocketStatus =
    polyStatus === "open" || kalshiStatus === "open" || manifoldStatus === "open"
      ? "open"
      : polyStatus === "connecting" || kalshiStatus === "connecting" || manifoldStatus === "connecting"
        ? "connecting"
        : "closed";

  return { livePrices, status };
}
