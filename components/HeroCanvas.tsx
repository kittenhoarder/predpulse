"use client";

import { useEffect, useRef } from "react";

// ECG shape: two cycles fill the canvas so the wave has good aspect ratio
// (one cycle per half-screen width keeps peaks tall relative to width)
// Points in 0–40 coordinate space. Center = y 20.
const ECG_RAW: [number, number][] = [
  [0,  20], [10, 20],                     // flat baseline
  [13, 17], [15, 20],                     // small P bump
  [19,  1], [21, 36], [24, 20],           // sharp QRS spike
  [31, 23], [34, 20],                     // T wave
  [40, 20],                               // return to baseline
];

const WAVE_REPEATS = 2;
const HEAD_SPEED = 1.6;
// Amplitude as a fraction of canvas height -- larger = more peaks/valleys
const AMP_RATIO = 0.30;

// Comet-tail particles: four velocity tiers with random spread per particle.
// vxSpread: ±half-range added to vx at spawn so each streak has a unique speed.
const DEPTH_PLANES = [
  { tailLen: 32, lineWidth: 1.0, opacity: 0.60, vx: 5.0, vxSpread: 2.0 },  // fast (streakers)
  { tailLen: 18, lineWidth: 0.7, opacity: 0.45, vx: 1.8, vxSpread: 0.6 },  // near
  { tailLen: 11, lineWidth: 0.5, opacity: 0.28, vx: 1.1, vxSpread: 0.4 },  // mid
  { tailLen:  6, lineWidth: 0.3, opacity: 0.14, vx: 0.55, vxSpread: 0.2 }, // far
] as const;

interface Particle {
  x: number;
  y: number;
  vx: number;
  tailLen: number;
  lineWidth: number;
  opacity: number;
}

interface CanvasState {
  w: number;
  h: number;
  wavePts: [number, number][];
  particles: Particle[];
  headX: number;  // increments forever; use headX % w for draw position
  desktop: boolean;
  rafId: number;
}

function buildWavePts(w: number, h: number): [number, number][] {
  const segW = w / WAVE_REPEATS;
  const cy = h / 2;
  const amp = h * AMP_RATIO;
  const pts: [number, number][] = [];
  for (let r = 0; r < WAVE_REPEATS; r++) {
    for (const [x, y] of ECG_RAW) {
      pts.push([r * segW + (x / 40) * segW, cy + ((y - 20) / 20) * amp]);
    }
  }
  return pts;
}

// Plane index distribution: ~15% fast, ~28% near, ~28% mid, ~29% far.
// Uses index-based bucketing so the mix is deterministic per count.
function planeForIndex(i: number, total: number): (typeof DEPTH_PLANES)[number] {
  const r = i / total;
  if (r < 0.15) return DEPTH_PLANES[0]; // fast
  if (r < 0.43) return DEPTH_PLANES[1]; // near
  if (r < 0.71) return DEPTH_PLANES[2]; // mid
  return DEPTH_PLANES[3];               // far
}

function buildParticles(count: number, w: number, h: number): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    const plane = planeForIndex(i, count);
    // Bake a unique velocity per particle using the plane's spread
    const vx = plane.vx + (Math.random() - 0.5) * plane.vxSpread;
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      vx,
      tailLen: plane.tailLen,
      lineWidth: plane.lineWidth,
      opacity: plane.opacity,
    };
  });
}

function buildWavePath(wavePts: [number, number][], upToX: number, full: boolean): Path2D {
  const path = new Path2D();
  let started = false;
  for (let i = 0; i < wavePts.length; i++) {
    const [px, py] = wavePts[i];
    if (!full && px > upToX) {
      if (i > 0) {
        const [prevX, prevY] = wavePts[i - 1];
        if (px !== prevX) {
          const t = (upToX - prevX) / (px - prevX);
          path.lineTo(upToX, prevY + t * (py - prevY));
        }
      }
      break;
    }
    if (!started) {
      path.moveTo(px, py);
      started = true;
    } else {
      path.lineTo(px, py);
    }
  }
  return path;
}

export default function HeroCanvas({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<CanvasState | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const desktop =
      window.innerWidth >= 1024 ||
      (typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency > 4);
    const particleCount = desktop ? 120 : 60;

    function initState(): CanvasState {
      const rect = canvas!.getBoundingClientRect();
      canvas!.width = rect.width || window.innerWidth;
      canvas!.height = rect.height || Math.round(window.innerHeight * 0.85);
      const w = canvas!.width;
      const h = canvas!.height;
      const s: CanvasState = {
        w, h,
        wavePts: buildWavePts(w, h),
        particles: buildParticles(particleCount, w, h),
        headX: 0,
        desktop,
        rafId: 0,
      };
      stateRef.current = s;
      return s;
    }

    function dark(): boolean {
      return document.documentElement.classList.contains("dark");
    }

    function drawGrid() {
      // Grid lines removed -- clean minimal background
    }

    function drawWave(s: CanvasState, drawX: number, d: boolean, full = false) {
      const path = buildWavePath(s.wavePts, drawX, full);

      // Single minimal glow: thin line with soft shadow -- no thick rounded blobs
      if (!full) {
        ctx!.save();
        ctx!.shadowBlur = d ? 18 : 10;
        ctx!.shadowColor = d ? "hsla(172,80%,50%,0.7)" : "hsla(172,72%,40%,0.5)";
        ctx!.strokeStyle = d ? "hsla(172,80%,60%,0.2)" : "hsla(172,72%,40%,0.12)";
        ctx!.lineWidth = 1.5;
        ctx!.lineJoin = "miter";
        ctx!.lineCap = "butt";
        ctx!.stroke(path);
        ctx!.restore();
      }

      // Core line: icy blue-white, razor thin, crisp corners
      ctx!.save();
      if (full) ctx!.globalAlpha = 0.38;
      ctx!.strokeStyle = d ? "hsla(200,80%,88%,0.85)" : "hsla(200,65%,30%,0.88)";
      ctx!.lineWidth = 1.1;
      ctx!.lineJoin = "miter";
      ctx!.lineCap = "butt";
      ctx!.stroke(path);
      ctx!.restore();
    }

    // Leading-edge scan pulse: bright at drawX, 80px comet tail to the left
    function drawScanPulse(s: CanvasState, drawX: number, d: boolean) {
      const tailW = 80;
      const grad = ctx!.createLinearGradient(drawX - tailW, 0, drawX, 0);
      const base = d ? "13,191,160" : "0,128,108";
      grad.addColorStop(0, `rgba(${base},0)`);
      grad.addColorStop(1, `rgba(${base},0.40)`);
      ctx!.save();
      ctx!.fillStyle = grad;
      ctx!.fillRect(drawX - tailW, 0, tailW, s.h);
      ctx!.restore();
    }

    // Comet-tail particles: horizontal gradient lines
    function drawParticles(s: CanvasState, d: boolean) {
      const color = d ? "172,75%,68%" : "172,65%,32%";
      ctx!.save();
      for (const p of s.particles) {
        const grad = ctx!.createLinearGradient(p.x - p.tailLen, p.y, p.x, p.y);
        grad.addColorStop(0, `hsla(${color},0)`);
        grad.addColorStop(1, `hsla(${color},${p.opacity})`);
        ctx!.beginPath();
        ctx!.strokeStyle = grad;
        ctx!.lineWidth = p.lineWidth;
        ctx!.moveTo(p.x - p.tailLen, p.y);
        ctx!.lineTo(p.x, p.y);
        ctx!.stroke();
      }
      ctx!.restore();
    }

    const s = initState();

    if (reducedMotion) {
      const d = dark();
      drawGrid();
      drawWave(s, 0, d, true);
      return;
    }

    function tick() {
      const st = stateRef.current;
      if (!st) return;

      if (document.hidden) {
        st.rafId = requestAnimationFrame(tick);
        return;
      }

      const d = dark();
      // Persistence trail: semi-transparent fill creates oscilloscope fade
      ctx!.fillStyle = d ? "rgba(12,16,24,0.07)" : "rgba(251,252,254,0.07)";
      ctx!.fillRect(0, 0, st.w, st.h);

      // headX increments forever -- modulo gives seamless loop with no flash
      const drawX = st.headX % st.w;

      drawGrid();
      drawWave(st, drawX, d);
      drawScanPulse(st, drawX, d);
      drawParticles(st, d);

      st.headX += HEAD_SPEED;

      for (const p of st.particles) {
        p.x += p.vx;
        if (p.x > st.w + p.tailLen) p.x = -p.tailLen;
      }

      st.rafId = requestAnimationFrame(tick);
    }

    s.rafId = requestAnimationFrame(tick);

    let resizeTimer: number | undefined;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        const cur = stateRef.current;
        if (cur) cancelAnimationFrame(cur.rafId);
        const ns = initState();
        ns.rafId = requestAnimationFrame(tick);
      }, 150);
    });
    ro.observe(canvas);

    return () => {
      const cur = stateRef.current;
      if (cur) cancelAnimationFrame(cur.rafId);
      ro.disconnect();
      window.clearTimeout(resizeTimer);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
