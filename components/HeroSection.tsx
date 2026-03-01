"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import PulseLogo from "./PulseLogo";

export default function HeroSection() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState({ opacity: 1, transform: "translateY(0px)" });

  useEffect(() => {
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const vh = window.innerHeight;
        const y = window.scrollY;
        const progress = Math.min(y / (vh * 0.55), 1);
        setStyle({
          opacity: 1 - progress,
          transform: `translateY(${-y * 0.15}px)`,
        });
        ticking = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const hidden = style.opacity <= 0;

  return (
    <div
      ref={heroRef}
      className="relative z-10 min-h-[85vh] flex flex-col items-center justify-center overflow-hidden"
      style={{
        ...style,
        willChange: "opacity, transform",
        pointerEvents: hidden ? "none" : "auto",
      }}
    >
      {/* Background: faded pulse logo + radial gradient */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none" aria-hidden="true">
        <PulseLogo size="md" className="!w-[320px] !h-[320px] sm:!w-[420px] sm:!h-[420px] opacity-[0.03]" />
      </div>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 60% 50% at 50% 40%, hsl(var(--primary) / 0.06) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-10 max-w-2xl text-center px-6">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-4">
          Prediction Market{" "}
          <span className="text-primary">Intelligence</span>
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
          Real-time sentiment, movers, and analytics across Polymarket, Kalshi &amp; Manifold — in one view.
        </p>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 animate-bounce">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-medium">
          Scroll
        </span>
        <ChevronDown className="w-4 h-4 text-muted-foreground/30" />
      </div>

      {/* Bottom gradient fade into background */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent, hsl(var(--background)))" }}
        aria-hidden="true"
      />
    </div>
  );
}
