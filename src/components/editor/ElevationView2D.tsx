"use client";

import { useEffect, useRef, useState } from "react";
import type { FixtureInstance, ProjectSceneV2 } from "@luxsim/project-io";
import { officialStoreyOutlineRing, roomBounds } from "@luxsim/project-io";
import { clientToSvgPoint } from "./svg-coords";
import type { PhotometricData } from "@luxsim/photometry";
import { planSymbolGeom } from "./LuminaireBody";
import { useViewElementSize } from "@/lib/use-view-element-size";
import { usePlanPointerNav } from "./usePlanPointerNav";
import {
  DEFAULT_PLAN_ZOOM,
  PLAN_PAN_BUTTON,
  planViewTransform,
} from "@/lib/plan-zoom";
import {
  OFFICIAL_PLAN_FIT_MARGIN,
  OFFICIAL_PLAN_VIEW_H,
  OFFICIAL_PLAN_VIEW_W,
} from "@/lib/official-plan-world-bounds";

type Props = {
  scene: ProjectSceneV2;
  mode: "front" | "side";
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDropLuminaire: (luminaireId: string, a: number, z: number) => void;
  onMoveInstance: (instanceId: string, a: number, z: number) => void;
  onBeginMoveInstance?: (instanceId: string) => boolean;
  photometry?: Record<string, PhotometricData>;
  readOnly?: boolean;
};

/** Front: X–Z plane; Side: Y–Z plane */
export function ElevationView2D({
  scene,
  mode,
  selectedId,
  onSelect,
  onDropLuminaire,
  onMoveInstance,
  onBeginMoveInstance,
  photometry,
  readOnly = false,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const panningRef = useRef(false);
  const [planView, setPlanView] = useState(DEFAULT_PLAN_ZOOM);
  const navGroupRef = useRef<SVGGElement | null>(null);
  const navLayerRef = useRef<HTMLDivElement | null>(null);
  const liveViewRef = useRef(planView);
  const committedViewRef = useRef(planView);
  const grabOffset = useRef({ a: 0, z: 0 });

  const storey = scene.storeys.find((s) => s.id === scene.ui.activeStoreyId);
  const rooms = scene.rooms.filter((r) => r.storeyId === scene.ui.activeStoreyId);
  const instances = scene.instances.filter((i) => i.storeyId === scene.ui.activeStoreyId);
  const elev = storey?.elevationM ?? 0;
  const height = storey?.heightM ?? 3;
  const storeyId = scene.ui.activeStoreyId;

  useEffect(() => {
    setPlanView(DEFAULT_PLAN_ZOOM);
  }, [storeyId]);

  const outlineRing = officialStoreyOutlineRing(storey);
  const axisValues: number[] = [];
  for (const r of rooms) {
    const b = roomBounds(r);
    if (mode === "front") {
      axisValues.push(b.minX, b.maxX);
    } else {
      axisValues.push(b.minY, b.maxY);
    }
  }
  if (outlineRing) {
    for (const p of outlineRing) {
      axisValues.push(mode === "front" ? p.x : p.y);
    }
  }
  const minA = axisValues.length ? Math.min(...axisValues) : 0;
  const maxA = axisValues.length ? Math.max(...axisValues) : 10;
  const widthM = Math.max(4, maxA - minA + 2);
  const padM = 0.5;
  const heightM = height + 2 * padM;
  const { viewW, viewH } = useViewElementSize(
    hostRef,
    OFFICIAL_PLAN_VIEW_W,
    OFFICIAL_PLAN_VIEW_H
  );
  const fitScale = Math.min(viewW / widthM, viewH / heightM) * OFFICIAL_PLAN_FIT_MARGIN;
  const fitOx = (viewW - widthM * fitScale) / 2;
  const fitOy = (viewH - heightM * fitScale) / 2;
  const { scale, ox, oy } = planViewTransform(fitOx, fitOy, fitScale, viewW, viewH, planView);

  usePlanPointerNav(svgRef, {
    viewW,
    viewH,
    fitOx,
    fitOy,
    fitScale,
    setPlanView,
    hostRef,
    panningRef,
    navGroupRef,
    navLayerRef,
    liveViewRef,
    committedViewRef,
    planView,
  });

  const toScreen = (a: number, z: number) => ({
    x: ox + (a - minA + 1) * scale,
    y: oy + (padM + elev + height - z) * scale,
  });

  function clientToWorld(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { a: 0, z: 0 };
    const { x: sx, y: sy } = clientToSvgPoint(svg, clientX, clientY);
    const live = planViewTransform(fitOx, fitOy, fitScale, viewW, viewH, liveViewRef.current);
    const a = minA - 1 + (sx - live.ox) / live.scale;
    const z = elev + height - ((sy - live.oy) / live.scale - padM);
    return { a, z };
  }

  return (
    <div
      ref={hostRef}
      className="relative w-full h-full min-h-0 overflow-hidden bg-[#0f1c24]"
      style={{ touchAction: "none" }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (readOnly) return;
        const luminaireId = e.dataTransfer.getData("application/x-luxsim-luminaire");
        if (!luminaireId) return;
        const w = clientToWorld(e.clientX, e.clientY);
        onDropLuminaire(luminaireId, w.a, Math.max(0.1, Math.min(height - 0.05, w.z)));
      }}
    >
      <div
        ref={navLayerRef}
        className="h-full w-full"
        data-plan-nav-layer=""
        style={{ transformOrigin: "0 0" }}
      >
      <svg ref={svgRef} viewBox={`0 0 ${viewW} ${viewH}`} className="w-full h-full">
        <rect width={viewW} height={viewH} fill="#0f1c24" />
        <g ref={navGroupRef} data-plan-nav-layer="">
        {outlineRing && outlineRing.length >= 3 && (() => {
          const xs = outlineRing.map((p) => (mode === "front" ? p.x : p.y));
          const a0 = Math.min(...xs);
          const a1 = Math.max(...xs);
          const p0 = toScreen(a0, elev);
          const p1 = toScreen(a1, elev + height);
          return (
            <rect
              data-storey-contour=""
              x={Math.min(p0.x, p1.x)}
              y={Math.min(p0.y, p1.y)}
              width={Math.abs(p1.x - p0.x)}
              height={Math.abs(p1.y - p0.y)}
              fill="rgba(42,168,160,0.18)"
              stroke="#2aa8a0"
              strokeDasharray="8 4"
              pointerEvents="none"
            />
          );
        })()}
        {rooms.map((room) => {
          const b = roomBounds(room);
          const a0 = mode === "front" ? b.minX : b.minY;
          const a1 = mode === "front" ? b.maxX : b.maxY;
          const p0 = toScreen(a0, elev);
          const p1 = toScreen(a1, elev + room.heightM);
          return (
            <rect
              key={room.id}
              x={Math.min(p0.x, p1.x)}
              y={Math.min(p0.y, p1.y)}
              width={Math.abs(p1.x - p0.x)}
              height={Math.abs(p1.y - p0.y)}
              fill="rgba(42,59,70,0.5)"
              stroke="#8aa0ad"
            />
          );
        })}
        {instances.map((inst) => {
          const a = mode === "front" ? inst.position.x : inst.position.y;
          const s = toScreen(a, inst.position.z);
          const selected = inst.instanceId === selectedId;
          return (
            <g
              key={inst.instanceId}
              style={{ cursor: readOnly ? "pointer" : "grab" }}
              onMouseDown={(e) => {
                if (e.button === PLAN_PAN_BUTTON || e.button !== 0 || panningRef.current) return;
                e.stopPropagation();
                onSelect(inst.instanceId);
                if (readOnly) return;
                if (onBeginMoveInstance && !onBeginMoveInstance(inst.instanceId)) return;
                const w0 = clientToWorld(e.clientX, e.clientY);
                grabOffset.current = { a: w0.a - a, z: w0.z - inst.position.z };

                const move = (ev: MouseEvent) => {
                  const w = clientToWorld(ev.clientX, ev.clientY);
                  onMoveInstance(
                    inst.instanceId,
                    w.a - grabOffset.current.a,
                    Math.max(0.1, Math.min(height - 0.05, w.z - grabOffset.current.z))
                  );
                };
                const up = () => {
                  window.removeEventListener("mousemove", move);
                  window.removeEventListener("mouseup", up);
                };
                window.addEventListener("mousemove", move);
                window.addEventListener("mouseup", up);
              }}
            >
              {(() => {
                const { body, rx } = planSymbolGeom(photometry?.[inst.luminaireId], scale, 3);
                const hPx = Math.max(body.heightM * scale, 3);
                const fill = selected ? "#c45c26" : body.housing === "black" ? "#2a2a2c" : "#d8d4cc";
                return (
                  <>
                    {body.isCircular ? (
                      <rect x={s.x - rx} y={s.y - hPx / 2} width={rx * 2} height={hPx} rx={hPx / 2} fill={fill} stroke="#fff" strokeWidth={0.8} />
                    ) : (
                      <rect x={s.x - rx} y={s.y - hPx / 2} width={rx * 2} height={hPx} fill={fill} stroke="#fff" strokeWidth={0.8} />
                    )}
                  </>
                );
              })()}
            </g>
          );
        })}
        </g>
      </svg>
      </div>
      <div className="absolute bottom-2 left-2 text-[10px] text-white/60">
        {(mode === "front" ? "Front (X-Z)" : "Side (Y-Z)") +
          " · drag fixtures vertically" +
          (planView.zoom !== 1 ? " · scroll to zoom · hold middle button to pan" : "")}
      </div>
    </div>
  );
}

export type { FixtureInstance };
