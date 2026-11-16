"use client";

import { useLayoutEffect, useState, type RefObject } from "react";
import { viewElementSize } from "./view-element-size";

/**
 * Keep an official view's viewBox matched to the host element's CSS size
 * so the fitted drawing fills the visible canvas instead of letterboxing
 * inside a fixed 640×480 box.
 */
export function useViewElementSize(
  ref: RefObject<HTMLElement | null>,
  fallbackW: number,
  fallbackH: number
): { viewW: number; viewH: number } {
  const [size, setSize] = useState(() => viewElementSize(0, 0, fallbackW, fallbackH));

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      const next = viewElementSize(rect.width, rect.height, fallbackW, fallbackH);
      setSize((prev) =>
        prev.viewW === next.viewW && prev.viewH === next.viewH ? prev : next
      );
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, fallbackW, fallbackH]);

  return size;
}
