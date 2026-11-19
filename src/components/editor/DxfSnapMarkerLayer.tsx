"use client";

import { useState, type MutableRefObject } from "react";
import type { DxfSnapHit } from "@/lib/official-dxf-object-snap";

export type DxfSnapMarkerApi = {
  setHit: (hit: DxfSnapHit | null) => void;
};

export function sameDxfSnapHit(a: DxfSnapHit | null, b: DxfSnapHit | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.kind === b.kind && a.point.x === b.point.x && a.point.y === b.point.y;
}

/** Snap marker with its own state so hover updates do not rebuild the plan SVG. */
export function DxfSnapMarkerLayer({
  toScreen,
  apiRef,
}: {
  toScreen: (x: number, y: number) => { x: number; y: number };
  apiRef: MutableRefObject<DxfSnapMarkerApi | null>;
}) {
  const [hit, setHit] = useState<DxfSnapHit | null>(null);
  apiRef.current = {
    setHit: (next) => {
      setHit((prev) => (sameDxfSnapHit(prev, next) ? prev : next));
    },
  };
  if (!hit) return null;
  const spt = toScreen(hit.point.x, hit.point.y);
  const r = 6;
  const stroke = "#f4d35e";
  return (
    <g data-dxf-snap={hit.kind} transform={`translate(${spt.x},${spt.y})`} pointerEvents="none">
      {hit.kind === "endpoint" && (
        <rect x={-r} y={-r} width={r * 2} height={r * 2} fill="none" stroke={stroke} strokeWidth={1.5} />
      )}
      {hit.kind === "midpoint" && (
        <polygon points={`0,${-r} ${r},${r} ${-r},${r}`} fill="none" stroke={stroke} strokeWidth={1.5} />
      )}
      {hit.kind === "nearest" && (
        <>
          <line x1={-r} y1={-r} x2={r} y2={r} stroke={stroke} strokeWidth={1.5} />
          <line x1={r} y1={-r} x2={-r} y2={r} stroke={stroke} strokeWidth={1.5} />
        </>
      )}
    </g>
  );
}
