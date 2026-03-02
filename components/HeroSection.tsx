"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import HeroCanvas from "./HeroCanvas";

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
    // Outer wrapper holds scroll indicator separately so it isn't affected
    // by the parallax translateY applied to the inner animated div.
    <div ref={heroRef} className="relative z-10 w-full min-h-[85vh]">
      <div
        className="relative min-h-[85vh] flex flex-col items-center justify-center overflow-hidden"
        style={{
          ...style,
          willChange: "opacity, transform",
          pointerEvents: hidden ? "none" : "auto",
        }}
      >
        {/* Full-viewport canvas: oscilloscope ECG wave + particle field */}
        <HeroCanvas className="absolute inset-0 w-full h-full" />

        {/* Content */}
        <div className="relative z-10 max-w-2xl text-center px-6">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-5">
            See What the Markets{" "}
            <span
              className="inline-block"
              style={{
                background: "linear-gradient(135deg, hsl(172 80% 44%), hsl(160 70% 50%))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Know
            </span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            The intelligence layer for prediction markets. Aggregated sentiment,
            flow, and momentum from major prediction exchanges.
          </p>
        </div>

        {/* Bottom fade into page background */}
        <div
          className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none z-10"
          style={{ background: "linear-gradient(to bottom, transparent, hsl(var(--background)))" }}
          aria-hidden="true"
        />
      </div>

      {/* Scroll indicator — outside the parallax div so centering isn't
          affected by the parallax transform. Uses w-full + flex justify-center
          to avoid the left-1/2/-translate-x-1/2 pattern that breaks when a
          parent has an active CSS transform. */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center animate-bounce pointer-events-none">
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-medium">
            Scroll
          </span>
          <ChevronDown className="w-4 h-4 text-muted-foreground/40" />
        </div>
      </div>
    </div>
  );
}
