"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { LivePrice } from "@/lib/types";

const WS_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market";
const PING_INTERVAL_MS = 10_000;
const RECONNECT_DELAYS_MS = [2_000, 4_000, 8_000, 16_000, 30_000];

export type SocketStatus = "connecting" | "open" | "closed";

interface UseMarketSocketResult {
  livePrices: Map<string, LivePrice>;
  status: SocketStatus;
}

/**
 * Subscribes to Polymarket CLOB Market Channel WebSocket for live best_bid_ask updates.
 * Returns a Map<clobTokenId, LivePrice> that overlays real-time prices onto SWR data.
 * Re-subscribes when tokenIds changes. No-ops server-side.
 */
export function useMarketSocket(tokenIds: string[]): UseMarketSocketResult {
  // Ref map is updated on every WS message; state is only flushed via rAF to batch renders
  const priceRef = useRef<Map<string, LivePrice>>(new Map());
  const [livePrices, setLivePrices] = useState<Map<string, LivePrice>>(new Map());
  const [status, setStatus] = useState<SocketStatus>("closed");

  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const mountedRef = useRef(true);
  // Stable ref to current tokenIds to use inside WS callbacks without stale closure
  const tokenIdsRef = useRef(tokenIds);
  tokenIdsRef.current = tokenIds;

  const flushPrices = useCallback(() => {
    setLivePrices(new Map(priceRef.current));
    rafRef.current = null;
  }, []);

  const scheduleFlush = useCallback(() => {
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(flushPrices);
    }
  }, [flushPrices]);

  const clearTimers = useCallback(() => {
    if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null; }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null; }
  }, []);

  const connect = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!mountedRef.current) return;

    const ids = tokenIdsRef.current;
    if (ids.length === 0) return;

    setStatus("connecting");
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return; }
      reconnectAttemptRef.current = 0;
      setStatus("open");

      ws.send(JSON.stringify({
        assets_ids: tokenIdsRef.current,
        type: "market",
        custom_feature_enabled: true,
      }));

      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("PING");
      }, PING_INTERVAL_MS);
    };

    ws.onmessage = (event) => {
      if (event.data === "PONG") return;
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.event_type === "best_bid_ask" || msg.type === "best_bid_ask") {
          // asset_id is the CLOB token ID; best_ask is the Yes price (fractional)
          const tokenId: string = msg.asset_id ?? msg.market;
          const rawAsk: number = parseFloat(msg.best_ask ?? msg.ask ?? "0");
          if (!tokenId || isNaN(rawAsk)) return;

          const price = rawAsk * 100;
          const prev = priceRef.current.get(tokenId);
          const flash: LivePrice["flash"] =
            prev === undefined ? null
            : price > prev.price ? "up"
            : price < prev.price ? "down"
            : prev.flash;

          priceRef.current.set(tokenId, { price, flash });
          scheduleFlush();
        }
      } catch {
        // Malformed frame — ignore
      }
    };

    const reconnect = () => {
      if (!mountedRef.current) return;
      clearTimers();
      setStatus("closed");
      const delay = RECONNECT_DELAYS_MS[
        Math.min(reconnectAttemptRef.current, RECONNECT_DELAYS_MS.length - 1)
      ];
      reconnectAttemptRef.current += 1;
      reconnectRef.current = setTimeout(connect, delay);
    };

    ws.onclose = reconnect;
    ws.onerror = () => ws.close();
  }, [clearTimers, scheduleFlush]);

  useEffect(() => {
    mountedRef.current = true;
    if (typeof window === "undefined" || tokenIds.length === 0) return;

    // Close existing socket before opening new one (tokenIds changed)
    if (wsRef.current) {
      wsRef.current.onclose = null; // suppress reconnect on intentional close
      wsRef.current.close();
    }
    clearTimers();
    reconnectAttemptRef.current = 0;
    connect();

    return () => {
      mountedRef.current = false;
      clearTimers();
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      setStatus("closed");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenIds.join(",")]); // reconnect only when the actual set of IDs changes

  return { livePrices, status };
}
