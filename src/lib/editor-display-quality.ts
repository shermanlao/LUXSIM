"use client";

import { useEffect, useState } from "react";

/** Official long side for the live Top / 3D false-colour bitmap. PDF exports keep this size. */
export const OFFICIAL_FALSE_COLOR_LONG_SIDE = 800;
/** Reduced long side when the editor stays below the low frame-rate threshold. */
export const REDUCED_FALSE_COLOR_LONG_SIDE = 400;

const SAMPLE_CAP = 64;
const WINDOW_MS = 1500;
const WARMUP_MS = 2000;
const LOW_FPS = 30;
const RECOVER_FPS = 45;
const SUSTAIN_LOW_MS = 1500;
const SUSTAIN_HIGH_MS = 3000;
const MIN_SAMPLES = 8;
/** A longer gap is a pause, not a slow frame (tab switch, a one-off hitch). */
const MAX_FRAME_GAP_MS = 250;

function averageFps(times: Float64Array, head: number, count: number, now: number): number | null {
  if (count < MIN_SAMPLES) return null;
  const windowStart = now - WINDOW_MS;
  let oldest = Infinity;
  let newest = 0;
  let n = 0;
  for (let i = 0; i < count; i += 1) {
    const t = times[(head - 1 - i + SAMPLE_CAP) % SAMPLE_CAP]!;
    if (t < windowStart) break;
    n += 1;
    if (t < oldest) oldest = t;
    if (t > newest) newest = t;
  }
  if (n < MIN_SAMPLES) return null;
  const span = newest - oldest;
  if (!(span > 0)) return null;
  return ((n - 1) / span) * 1000;
}

/**
 * Measure editor frame rate with rAF timestamps only, and lower the live
 * false-colour bitmap size if the view stays sluggish. No on-screen counter.
 * Measurement pauses in a hidden tab. A short warmup ignores the first hitch.
 */
export function useEditorDisplayQuality(): { falseColorLongSide: number } {
  const [longSide, setLongSide] = useState(OFFICIAL_FALSE_COLOR_LONG_SIDE);

  useEffect(() => {
    const times = new Float64Array(SAMPLE_CAP);
    let head = 0;
    let count = 0;
    let last = 0;
    let startedAt = 0;
    let lowSince: number | null = null;
    let highSince: number | null = null;
    let reduced = false;
    let raf = 0;

    const resetWindow = (now: number) => {
      head = 0;
      count = 0;
      last = 0;
      startedAt = now;
      lowSince = null;
      highSince = null;
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (typeof document !== "undefined" && document.hidden) return;
      if (last > 0 && now - last < MAX_FRAME_GAP_MS) {
        times[head] = now;
        head = (head + 1) % SAMPLE_CAP;
        if (count < SAMPLE_CAP) count += 1;
      } else if (last > 0 && now - last >= MAX_FRAME_GAP_MS) {
        // Drop the gap so a pause does not look like a 1 fps stall.
        lowSince = null;
        highSince = null;
      }
      last = now;
      if (startedAt === 0) {
        startedAt = now;
        return;
      }
      if (now - startedAt < WARMUP_MS) return;
      const fps = averageFps(times, head, count, now);
      if (fps == null) return;
      if (!reduced) {
        if (fps < LOW_FPS) {
          if (lowSince == null) lowSince = now;
          if (now - lowSince >= SUSTAIN_LOW_MS) {
            reduced = true;
            lowSince = null;
            highSince = null;
            resetWindow(now);
            setLongSide(REDUCED_FALSE_COLOR_LONG_SIDE);
          }
        } else {
          lowSince = null;
        }
        return;
      }
      if (fps >= RECOVER_FPS) {
        if (highSince == null) highSince = now;
        if (now - highSince >= SUSTAIN_HIGH_MS) {
          reduced = false;
          lowSince = null;
          highSince = null;
          resetWindow(now);
          setLongSide(OFFICIAL_FALSE_COLOR_LONG_SIDE);
        }
      } else {
        highSince = null;
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
        last = 0;
        return;
      }
      resetWindow(performance.now());
      if (!raf) raf = requestAnimationFrame(tick);
    };

    document.addEventListener("visibilitychange", onVisibility);
    if (!document.hidden) raf = requestAnimationFrame(tick);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return { falseColorLongSide: longSide };
}
