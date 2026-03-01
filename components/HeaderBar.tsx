"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import useSWR from "swr";
import type { PulseApiResponse, PulseIndex } from "@/lib/types";
import { PULSE_SWR_KEY } from "./PulseDashboard";
import PulseLogo from "./PulseLogo";
import { ThemeToggle } from "./ThemeToggle";
import CompactPulseCard from "./CompactPulseCard";
import PulseDrawer from "./PulseDrawer";

async function pulseFetcher(url: string): Promise<PulseApiResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default function HeaderBar() {
  const [showCompact, setShowCompact] = useState(false);
  const [drawerIndex, setDrawerIndex] = useState<PulseIndex | null>(null);

  const { data } = useSWR<PulseApiResponse>(PULSE_SWR_KEY, pulseFetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
  });

  const indices = data?.indices ?? [];

  // Observe #pulse-sentinel: show compact cards only when sentinel scrolls ABOVE viewport.
  // The sentinel lives inside a Suspense boundary and may not exist on first render,
  // so we poll briefly until it appears.
  useEffect(() => {
    let observer: IntersectionObserver | null = null;
    let rafId: number;

    function tryObserve() {
      const sentinel = document.getElementById("pulse-sentinel");
      if (!sentinel) {
        rafId = requestAnimationFrame(tryObserve);
        return;
      }

      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setShowCompact(false);
          } else {
            setShowCompact(entry.boundingClientRect.top < 0);
          }
        },
        { threshold: 0 }
      );
      observer.observe(sentinel);
    }

    tryObserve();
    return () => {
      cancelAnimationFrame(rafId);
      observer?.disconnect();
    };
  }, []);

  const handleDrawerClose = useCallback(() => setDrawerIndex(null), []);

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-12 flex items-center gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <PulseLogo size="sm" />
            <span className="font-semibold text-sm tracking-tight">Predpulse</span>
          </div>

          {/* Compact pulse cards — slide in when full cards scroll out */}
          <div
            className="flex-1 flex items-center justify-center gap-1 sm:gap-1.5 overflow-hidden transition-all duration-400 ease-out"
            style={{
              opacity: showCompact ? 1 : 0,
              transform: showCompact ? "translateY(0)" : "translateY(6px)",
              maxHeight: showCompact ? "40px" : "0px",
              pointerEvents: showCompact ? "auto" : "none",
            }}
          >
            <div className="hidden sm:flex items-center gap-1 sm:gap-1.5">
              {indices.map((idx) => (
                <CompactPulseCard
                  key={idx.category}
                  index={idx}
                  onClick={() => setDrawerIndex(idx)}
                />
              ))}
            </div>

            {indices.length > 0 && (
              <div className="sm:hidden relative w-full overflow-hidden">
                <div className="pulse-ticker-track flex items-center gap-1.5 w-max">
                  {indices.map((idx) => (
                    <CompactPulseCard
                      key={`m-a-${idx.category}`}
                      index={idx}
                      mobileTicker
                      onClick={() => setDrawerIndex(idx)}
                    />
                  ))}
                  <span className="h-4 w-px bg-border/60 mx-0.5 shrink-0" aria-hidden="true" />
                  {indices.map((idx) => (
                    <CompactPulseCard
                      key={`m-b-${idx.category}`}
                      index={idx}
                      mobileTicker
                      onClick={() => setDrawerIndex(idx)}
                    />
                  ))}
                  <span className="h-4 w-px bg-border/60 mx-0.5 shrink-0" aria-hidden="true" />
                </div>
              </div>
            )}
          </div>

          {/* Spacer when compact cards are hidden */}
          {!showCompact && <div className="flex-1" />}

          {/* Pulse nav link */}
          <Link
            href="/pulse"
            className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50 shrink-0"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Pulse
          </Link>

          {/* Theme toggle */}
          <ThemeToggle />
        </div>
      </header>

      <PulseDrawer index={drawerIndex} onClose={handleDrawerClose} />
    </>
  );
}
