"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DxfEntity, ProjectSceneV2, RoomV2, RcpDetectionProposal, Vec2 } from "@luxsim/project-io";
import {
  findRoomAt,
  isCloseToStart,
  legacyScaleToMetersPerPixel,
  mToMm,
  parseLengthToM,
  resolveDraftPoint,
  roomBounds,
  underlayWorldSize,
} from "@luxsim/project-io";
import { clientToSvgPoint } from "./svg-coords";

type Props = {
  scene: ProjectSceneV2;
  /** Top = look-down; Bottom = look-up (X-mirrored plan). */
  variant?: "top" | "bottom";
  underlayUrl?: string | null;
  dxfEntities?: DxfEntity[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDropLuminaire: (luminaireId: string, x: number, y: number) => void;
  onMoveInstance: (instanceId: string, x: number, y: number) => void;
  onDrawRoomPolygon: (points: Vec2[]) => void;
  onMoveRoom?: (roomId: string, dx: number, dy: number) => void;
  onSelectRoom?: (roomId: string) => void;
  onCalibratePoints?: (a: { x: number; y: number }, b: { x: number; y: number }) => void;
  /** Persist native pixel size (and migrate legacy scale) for older underlays. */
  onUnderlaySourceSize?: (widthPx: number, heightPx: number) => void;
  /** Array tool preview positions (world m, Top plan). */
  arrayPreview?: { x: number; y: number; rotationDeg: number }[];
  rcpProposals?: RcpDetectionProposal[];
  showRcpOverlay?: boolean;
  selectedRcpId?: string | null;
};

function isTypingField(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function TopView2D({
  scene,
  variant = "top",
  underlayUrl,
  dxfEntities = [],
  selectedId,
  onSelect,
  onDropLuminaire,
  onMoveInstance,
  onDrawRoomPolygon,
  onMoveRoom,
  onSelectRoom,
  onCalibratePoints,
  onUnderlaySourceSize,
  arrayPreview = [],
  rcpProposals = [],
  showRcpOverlay = false,
  selectedRcpId = null,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draft, setDraft] = useState<Vec2[]>([]);
  const [cursor, setCursor] = useState<Vec2 | null>(null);
  const [lengthBuf, setLengthBuf] = useState("");
  const [ortho, setOrtho] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [movingRoomId, setMovingRoomId] = useState<string | null>(null);
  const grabOffset = useRef({ x: 0, y: 0 });
  const roomDragLast = useRef<Vec2 | null>(null);
  const calib = useRef<{ x: number; y: number } | null>(null);
  const [resolvedSource, setResolvedSource] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const storeyId = scene.ui.activeStoreyId;
  const rooms = scene.rooms.filter((r) => r.storeyId === storeyId);
  const instances = scene.instances.filter((i) => i.storeyId === storeyId);
  const underlay = scene.underlays.find((u) => u.storeyId === storeyId);
  const drawing = scene.ui.tool === "drawRoom";

  const sourceWidthPx = underlay?.sourceWidthPx ?? resolvedSource?.width;
  const sourceHeightPx = underlay?.sourceHeightPx ?? resolvedSource?.height;

  useEffect(() => {
    setResolvedSource(null);
  }, [underlay?.id, underlayUrl]);

  useEffect(() => {
    if (!drawing) {
      setDraft([]);
      setCursor(null);
      setLengthBuf("");
    }
  }, [drawing]);

  useEffect(() => {
    if (!underlayUrl || !underlay) return;
    if (
      typeof underlay.sourceWidthPx === "number" &&
      typeof underlay.sourceHeightPx === "number" &&
      underlay.sourceWidthPx > 0 &&
      underlay.sourceHeightPx > 0
    ) {
      return;
    }
    if (underlay.kind !== "image" && underlay.kind !== "pdf") return;

    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      if (!(width > 0 && height > 0)) return;
      setResolvedSource({ width, height });
      onUnderlaySourceSize?.(width, height);
    };
    img.onerror = () => {
      /* PDF or unsupported raster — leave underlay unset */
    };
    img.src = underlayUrl;
    return () => {
      cancelled = true;
    };
  }, [underlay, underlayUrl, onUnderlaySourceSize]);

  const underlaySize = useMemo(() => {
    if (!underlay || !(sourceWidthPx && sourceHeightPx)) return null;
    return underlayWorldSize({
      sourceWidthPx,
      sourceHeightPx,
      metersPerUnit:
        underlay.sourceWidthPx && underlay.sourceHeightPx
          ? underlay.metersPerUnit
          : legacyScaleToMetersPerPixel(underlay.metersPerUnit, sourceWidthPx),
    });
  }, [underlay, sourceWidthPx, sourceHeightPx]);

  const world = useMemo(() => {
    let minX = 0,
      minY = 0,
      maxX = 12,
      maxY = 10;
    let hasContent = false;

    for (const r of rooms) {
      const b = roomBounds(r);
      if (!hasContent) {
        minX = b.minX;
        minY = b.minY;
        maxX = b.maxX;
        maxY = b.maxY;
        hasContent = true;
      } else {
        minX = Math.min(minX, b.minX);
        minY = Math.min(minY, b.minY);
        maxX = Math.max(maxX, b.maxX);
        maxY = Math.max(maxY, b.maxY);
      }
    }
    for (const e of dxfEntities) {
      for (const p of e.points) {
        if (!hasContent) {
          minX = maxX = p.x;
          minY = maxY = p.y;
          hasContent = true;
        } else {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        }
      }
    }
    if (underlay && underlaySize) {
      const x0 = underlay.offsetX;
      const y0 = underlay.offsetY;
      const x1 = x0 + underlaySize.widthM;
      const y1 = y0 + underlaySize.heightM;
      if (!hasContent) {
        minX = x0;
        minY = y0;
        maxX = x1;
        maxY = y1;
        hasContent = true;
      } else {
        minX = Math.min(minX, x0);
        minY = Math.min(minY, y0);
        maxX = Math.max(maxX, x1);
        maxY = Math.max(maxY, y1);
      }
    }
    for (const p of draft) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }

    const pad = 1;
    return {
      minX: minX - pad,
      minY: minY - pad,
      width: Math.max(4, maxX - minX + 2 * pad),
      depth: Math.max(4, maxY - minY + 2 * pad),
    };
  }, [rooms, dxfEntities, underlay, underlaySize, draft]);

  const viewW = 640;
  const viewH = 480;
  const scale = Math.min(viewW / world.width, viewH / world.depth) * 0.92;
  const ox = (viewW - world.width * scale) / 2;
  const oy = (viewH - world.depth * scale) / 2;
  /**
   * Top = look-down (matches 3D). Bottom = look-up.
   * Top mirrors X so it matches the previous Bottom ↔ 3D pairing.
   */
  const mirrorX = variant === "top";

  const toScreen = (x: number, y: number) => ({
    x: mirrorX
      ? ox + (world.minX + world.width - x) * scale
      : ox + (x - world.minX) * scale,
    y: oy + (world.minY + world.depth - y) * scale,
  });

  const toWorld = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const { x: svgX, y: svgY } = clientToSvgPoint(svg, clientX, clientY);
    const x = mirrorX
      ? world.minX + world.width - (svgX - ox) / scale
      : world.minX + (svgX - ox) / scale;
    return {
      x,
      y: world.minY + world.depth - (svgY - oy) / scale,
    };
  };

  const radiusM = parseLengthToM(lengthBuf);
  const last = draft[draft.length - 1] ?? null;
  const preview =
    last && cursor
      ? resolveDraftPoint(last, cursor, radiusM, ortho)
      : cursor;

  const willClose =
    Boolean(last && preview && draft[0] && draft.length >= 3 && isCloseToStart(preview, draft[0]));

  function commitPoint(raw: Vec2) {
    const start = draft[0];
    if (start && draft.length >= 3 && isCloseToStart(raw, start)) {
      onDrawRoomPolygon(draft);
      setDraft([]);
      setCursor(null);
      setLengthBuf("");
      return;
    }
    setDraft((pts) => [...pts, raw]);
    setLengthBuf("");
  }

  useEffect(() => {
    if (!drawing) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTypingField(e.target)) return;
      if (e.key === "Shift") {
        setOrtho(true);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setDraft([]);
        setCursor(null);
        setLengthBuf("");
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        if (lengthBuf) {
          setLengthBuf((s) => s.slice(0, -1));
          return;
        }
        setDraft((pts) => pts.slice(0, -1));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (last && preview) commitPoint(preview);
        return;
      }
      if (e.key === "." || e.key === ",") {
        e.preventDefault();
        setLengthBuf((s) => (s.includes(".") ? s : `${s}.`));
        return;
      }
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        setLengthBuf((s) => s + e.key);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") setOrtho(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
    };
    // commitPoint uses latest draft/preview via closure; lengthBuf + draft keep it current
  }, [drawing, lengthBuf, last, preview, draft]);

  function polyPoints(room: RoomV2) {
    return room.polygon
      .map((p) => {
        const s = toScreen(p.x, p.y);
        return `${s.x},${s.y}`;
      })
      .join(" ");
  }

  function beginMove(instanceId: string, clientX: number, clientY: number, pos: { x: number; y: number }) {
    const w = toWorld(clientX, clientY);
    grabOffset.current = { x: w.x - pos.x, y: w.y - pos.y };
    setMovingId(instanceId);
  }

  const underlayScreen =
    underlay && underlaySize
      ? {
          x: mirrorX
            ? ox +
              (world.minX + world.width - (underlay.offsetX + underlaySize.widthM)) *
                scale
            : ox + (underlay.offsetX - world.minX) * scale,
          y:
            oy +
            (world.minY + world.depth - (underlay.offsetY + underlaySize.heightM)) * scale,
          width: underlaySize.widthM * scale,
          height: underlaySize.heightM * scale,
          // X: keep plan aligned when view is X-mirrored. Y: correct remaining plan flip.
          flipImageX: mirrorX,
          flipImageY: true,
        }
      : null;

  const liveMm =
    last && preview ? Math.round(mToMm(Math.hypot(preview.x - last.x, preview.y - last.y))) : null;

  return (
    <div
      className="relative w-full bg-[#0f1c24] h-[520px]"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const luminaireId = e.dataTransfer.getData("application/x-luxsim-luminaire");
        if (!luminaireId) return;
        const w = toWorld(e.clientX, e.clientY);
        onDropLuminaire(luminaireId, w.x, w.y);
      }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${viewW} ${viewH}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={(e) => {
          const w = toWorld(e.clientX, e.clientY);
          if (scene.ui.tool === "calibrate" && onCalibratePoints) {
            if (!calib.current) calib.current = w;
            else {
              onCalibratePoints(calib.current, w);
              calib.current = null;
            }
            return;
          }
          if (drawing) {
            if (draft.length === 0) {
              setDraft([w]);
              setCursor(w);
              setLengthBuf("");
              return;
            }
            if (preview) commitPoint(preview);
            return;
          }
          onSelect(null);
        }}
        onMouseMove={(e) => {
          setOrtho(e.shiftKey);
          const w = toWorld(e.clientX, e.clientY);
          if (drawing) {
            setCursor(w);
            return;
          }
          if (movingRoomId && onMoveRoom && roomDragLast.current) {
            onMoveRoom(movingRoomId, w.x - roomDragLast.current.x, w.y - roomDragLast.current.y);
            roomDragLast.current = w;
          }
        }}
        onMouseUp={() => {
          setMovingRoomId(null);
          roomDragLast.current = null;
        }}
        onMouseLeave={() => {
          setMovingRoomId(null);
          roomDragLast.current = null;
        }}
      >
        <rect width={viewW} height={viewH} fill="#0f1c24" />

        {underlayUrl && underlay && underlayScreen && (() => {
          const fx = underlayScreen.flipImageX ? -1 : 1;
          const fy = underlayScreen.flipImageY ? -1 : 1;
          const tx =
            underlayScreen.x + (fx === -1 ? underlayScreen.width : 0);
          const ty =
            underlayScreen.y + (fy === -1 ? underlayScreen.height : 0);
          return (
            <g transform={`translate(${tx} ${ty}) scale(${fx} ${fy})`}>
              <image
                href={underlayUrl}
                x={0}
                y={0}
                width={underlayScreen.width}
                height={underlayScreen.height}
                opacity={underlay.opacity}
                preserveAspectRatio="none"
              />
            </g>
          );
        })()}

        {dxfEntities.map((ent, idx) => {
          const pts = ent.points.map((p) => toScreen(p.x, p.y));
          if (pts.length < 2) return null;
          return (
            <polyline
              key={idx}
              fill="none"
              stroke="#6a8a9a"
              strokeWidth={1}
              points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
            />
          );
        })}

        {rooms.map((room) => {
          const active = room.id === scene.ui.activeRoomId;
          return (
            <polygon
              key={room.id}
              points={polyPoints(room)}
              fill={active ? "rgba(31,111,139,0.25)" : "rgba(42,59,70,0.55)"}
              stroke={active ? "#c45c26" : "#8aa0ad"}
              strokeWidth={active ? 2 : 1}
              style={{ cursor: scene.ui.tool === "select" ? "move" : "inherit" }}
              onMouseDown={(e) => {
                if (drawing || scene.ui.tool === "calibrate") return;
                e.stopPropagation();
                onSelectRoom?.(room.id);
                if (!onMoveRoom) return;
                const w = toWorld(e.clientX, e.clientY);
                roomDragLast.current = w;
                setMovingRoomId(room.id);
              }}
            />
          );
        })}

        {draft.length > 0 && (
          <polyline
            fill="none"
            stroke="#c45c26"
            strokeWidth={2}
            points={[...draft, preview ?? draft[draft.length - 1]!]
              .map((p) => {
                const s = toScreen(p.x, p.y);
                return `${s.x},${s.y}`;
              })
              .join(" ")}
          />
        )}

        {last && radiusM != null && radiusM > 0 && (
          <circle
            cx={toScreen(last.x, last.y).x}
            cy={toScreen(last.x, last.y).y}
            r={radiusM * scale}
            fill="none"
            stroke="#e8c27a"
            strokeDasharray="4 3"
            strokeWidth={1}
          />
        )}

        {draft.map((p, i) => {
          const s = toScreen(p.x, p.y);
          const start = i === 0 && draft.length >= 3;
          return (
            <circle
              key={i}
              cx={s.x}
              cy={s.y}
              r={start ? 5 : 3.5}
              fill={start ? "#e8c27a" : "#c45c26"}
              stroke="#fff"
              strokeWidth={1}
            />
          );
        })}

        {preview && last && (
          <circle
            cx={toScreen(preview.x, preview.y).x}
            cy={toScreen(preview.x, preview.y).y}
            r={willClose ? 6 : 4}
            fill={willClose ? "#e8c27a" : "#fff"}
            stroke="#c45c26"
            strokeWidth={1.5}
          />
        )}

        {showRcpOverlay &&
          rcpProposals.map((p) => {
            if (!p.pointM || p.status === "rejected" || p.status === "committed") return null;
            const s = toScreen(p.pointM.x, p.pointM.y);
            const selected = p.id === selectedRcpId;
            const accepted = p.status === "accepted" || p.status === "edited";
            return (
              <g key={p.id} pointerEvents="none">
                <circle
                  cx={s.x}
                  cy={s.y}
                  r={selected ? 10 : 7}
                  fill={accepted ? "#27ae60" : "#9b59b6"}
                  fillOpacity={selected ? 0.55 : 0.35}
                  stroke={selected ? "#fff" : "#e8d4ff"}
                  strokeWidth={selected ? 2.5 : 1.5}
                />
                <text
                  x={s.x + (selected ? 12 : 9)}
                  y={s.y - 6}
                  fill={selected ? "#fff" : "#e8d4ff"}
                  fontSize={selected ? 10 : 9}
                  fontFamily="system-ui,sans-serif"
                  fontWeight={selected ? "700" : "400"}
                >
                  {p.codeRaw}
                </text>
              </g>
            );
          })}

        {arrayPreview.map((ghost, idx) => {
          const s = toScreen(ghost.x, ghost.y);
          const rad = (ghost.rotationDeg * Math.PI) / 180;
          const len = 10;
          const x2 = Math.cos(rad) * len;
          const y2 = -Math.sin(rad) * len;
          return (
            <g key={`ghost_${idx}`} transform={`translate(${s.x},${s.y})`} pointerEvents="none">
              <rect
                x={-7}
                y={-7}
                width={14}
                height={14}
                fill="none"
                stroke="#7ec8e3"
                strokeWidth={1.5}
                strokeDasharray="3 2"
                opacity={0.85}
              />
              <line
                x1={0}
                y1={0}
                x2={x2}
                y2={y2}
                stroke="#7ec8e3"
                strokeWidth={1.2}
                strokeDasharray="2 2"
                opacity={0.85}
              />
            </g>
          );
        })}

        {instances.map((inst) => {
          const s = toScreen(inst.position.x, inst.position.y);
          const selected = inst.instanceId === selectedId;
          return (
            <g
              key={inst.instanceId}
              transform={`translate(${s.x},${s.y})`}
              style={{ cursor: movingId === inst.instanceId ? "grabbing" : "grab" }}
              onMouseDown={(e) => {
                e.stopPropagation();
                onSelect(inst.instanceId);
                beginMove(inst.instanceId, e.clientX, e.clientY, inst.position);

                const move = (ev: MouseEvent) => {
                  const w = toWorld(ev.clientX, ev.clientY);
                  onMoveInstance(
                    inst.instanceId,
                    w.x - grabOffset.current.x,
                    w.y - grabOffset.current.y
                  );
                };
                const up = () => {
                  setMovingId(null);
                  window.removeEventListener("mousemove", move);
                  window.removeEventListener("mouseup", up);
                };
                window.addEventListener("mousemove", move);
                window.addEventListener("mouseup", up);
              }}
            >
              <rect
                x={-8}
                y={-8}
                width={16}
                height={16}
                fill={selected ? "#c45c26" : "#e8c27a"}
                stroke="#fff"
                strokeWidth={1}
              />
              {(() => {
                const len = selected ? 14 : 10;
                const rad = (inst.rotationDeg * Math.PI) / 180;
                const x2 = Math.cos(rad) * len;
                const y2 = -Math.sin(rad) * len;
                return (
                  <>
                    <line
                      x1={0}
                      y1={0}
                      x2={x2}
                      y2={y2}
                      stroke={selected ? "#fff" : "#1f6f8b"}
                      strokeWidth={selected ? 2 : 1.5}
                      strokeLinecap="round"
                    />
                    <circle cx={x2} cy={y2} r={2} fill={selected ? "#fff" : "#1f6f8b"} />
                    {selected && (
                      <text
                        x={x2 + 4}
                        y={y2 - 4}
                        fill="#fff"
                        fontSize={9}
                        fontFamily="system-ui,sans-serif"
                      >
                        {Math.round(inst.rotationDeg)}°
                      </text>
                    )}
                  </>
                );
              })()}
            </g>
          );
        })}
      </svg>
      <div className="absolute bottom-2 left-2 text-[10px] text-white/60">
        {variant === "bottom" ? "Bottom" : "Top"} view · drop fixtures into
        rooms · tool: {scene.ui.tool}
        {drawing && (
          <>
            {" "}
            · click corners · type mm to lock length
            {lengthBuf ? ` · ${lengthBuf} mm` : ""}
            {liveMm != null ? ` · ${liveMm} mm` : ""}
            {ortho ? " · ortho" : ""}
            {willClose ? " · click to close" : ""}
          </>
        )}
      </div>
    </div>
  );
}

export function roomAtPoint(scene: ProjectSceneV2, x: number, y: number): RoomV2 | null {
  return findRoomAt(scene.rooms, scene.ui.activeStoreyId, { x, y });
}
