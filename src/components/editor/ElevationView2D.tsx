"use client";

import { useRef } from "react";
import type { FixtureInstance, ProjectSceneV2 } from "@luxsim/project-io";
import { roomBounds } from "@luxsim/project-io";
import { clientToSvgPoint } from "./svg-coords";

type Props = {
  scene: ProjectSceneV2;
  mode: "front" | "side";
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDropLuminaire: (luminaireId: string, a: number, z: number) => void;
  onMoveInstance: (instanceId: string, a: number, z: number) => void;
};

/** Front: X–Z plane; Side: Y–Z plane */
export function ElevationView2D({
  scene,
  mode,
  selectedId,
  onSelect,
  onDropLuminaire,
  onMoveInstance,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const grabOffset = useRef({ a: 0, z: 0 });

  const storey = scene.storeys.find((s) => s.id === scene.ui.activeStoreyId);
  const rooms = scene.rooms.filter((r) => r.storeyId === scene.ui.activeStoreyId);
  const instances = scene.instances.filter((i) => i.storeyId === scene.ui.activeStoreyId);
  const elev = storey?.elevationM ?? 0;
  const height = storey?.heightM ?? 3;

  let minA = 0,
    maxA = 10;
  for (const r of rooms) {
    const b = roomBounds(r);
    if (mode === "front") {
      minA = Math.min(minA, b.minX);
      maxA = Math.max(maxA, b.maxX);
    } else {
      minA = Math.min(minA, b.minY);
      maxA = Math.max(maxA, b.maxY);
    }
  }
  const widthM = Math.max(4, maxA - minA + 2);
  const viewW = 640;
  const viewH = 360;
  const scale = Math.min(viewW / widthM, viewH / (height + 1)) * 0.9;
  const ox = (viewW - widthM * scale) / 2;
  const oy = 40;

  const toScreen = (a: number, z: number) => ({
    x: ox + (a - minA + 1) * scale,
    y: oy + (elev + height - z) * scale,
  });

  function clientToWorld(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { a: 0, z: 0 };
    const { x: sx, y: sy } = clientToSvgPoint(svg, clientX, clientY);
    const a = minA - 1 + (sx - ox) / scale;
    const z = elev + height - (sy - oy) / scale;
    return { a, z };
  }

  return (
    <div
      className="relative w-full bg-[#0f1c24] h-[520px]"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const luminaireId = e.dataTransfer.getData("application/x-luxsim-luminaire");
        if (!luminaireId) return;
        const w = clientToWorld(e.clientX, e.clientY);
        onDropLuminaire(luminaireId, w.a, Math.max(0.1, Math.min(height - 0.05, w.z)));
      }}
    >
      <svg ref={svgRef} viewBox={`0 0 ${viewW} ${viewH}`} className="w-full h-full">
        <rect width={viewW} height={viewH} fill="#0f1c24" />
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
            <rect
              key={inst.instanceId}
              x={s.x - 7}
              y={s.y - 7}
              width={14}
              height={14}
              fill={selected ? "#c45c26" : "#e8c27a"}
              style={{ cursor: "grab" }}
              onMouseDown={(e) => {
                e.stopPropagation();
                onSelect(inst.instanceId);
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
            />
          );
        })}
      </svg>
      <div className="absolute bottom-2 left-2 text-[10px] text-white/60">
        {mode === "front" ? "Front (X–Z)" : "Side (Y–Z)"} · drag fixtures vertically
      </div>
    </div>
  );
}

export type { FixtureInstance };
