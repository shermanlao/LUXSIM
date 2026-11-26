"use client";

import { useEffect, useRef } from "react";

const SAMPLE_CAP = 64;
const WINDOW_MS = 1500;
const WARMUP_MS = 2000;
const MIN_SAMPLES = 8;
/** A longer gap is a pause, not a slow frame (tab switch, a one-off hitch). */
const MAX_FRAME_GAP_MS = 250;
/** Heap reads are cheap but need not run on every animation frame. */
const HEAP_SAMPLE_MS = 1000;

export type EditorPerformanceSample = {
  fps: number | null;
  usedJsHeapBytes: number | null;
};

type ChromiumMemory = {
  usedJSHeapSize: number;
};

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

function readUsedJsHeapBytes(): number | null {
  const mem = (performance as Performance & { memory?: ChromiumMemory }).memory;
  if (!mem || !Number.isFinite(mem.usedJSHeapSize)) return null;
  return mem.usedJSHeapSize;
}

/**
 * Lightweight editor performance monitoring. Measures frame rate with rAF
 * timestamps only, and samples Chromium `performance.memory.usedJSHeapSize`
 * when that API exists. No on-screen counter, no display-quality latch, and
 * no canvas or DOM copies. Measurement pauses in a hidden tab. A short warmup
 * ignores the first hitch. Values are kept on a ref so React does not rerender.
 */
export function useEditorPerformanceMonitor(): { current: EditorPerformanceSample } {
  const sampleRef = useRef<EditorPerformanceSample>({ fps: null, usedJsHeapBytes: null });

  useEffect(() => {
    const times = new Float64Array(SAMPLE_CAP);
    let head = 0;
    let count = 0;
    let last = 0;
    let startedAt = 0;
    let lastHeapAt = 0;
    let raf = 0;

    const resetWindow = (now: number) => {
      head = 0;
      count = 0;
      last = 0;
      startedAt = now;
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (typeof document !== "undefined" && document.hidden) return;
      if (last > 0 && now - last < MAX_FRAME_GAP_MS) {
        times[head] = now;
        head = (head + 1) % SAMPLE_CAP;
        if (count < SAMPLE_CAP) count += 1;
      }
      last = now;
      if (startedAt === 0) {
        startedAt = now;
        return;
      }
      if (now - startedAt < WARMUP_MS) return;
      sampleRef.current.fps = averageFps(times, head, count, now);
      if (lastHeapAt === 0 || now - lastHeapAt >= HEAP_SAMPLE_MS) {
        lastHeapAt = now;
        sampleRef.current.usedJsHeapBytes = readUsedJsHeapBytes();
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
      lastHeapAt = 0;
      if (!raf) raf = requestAnimationFrame(tick);
    };

    document.addEventListener("visibilitychange", onVisibility);
    if (!document.hidden) raf = requestAnimationFrame(tick);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return sampleRef;
}
