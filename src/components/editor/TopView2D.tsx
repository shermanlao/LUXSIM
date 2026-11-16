"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useViewElementSize } from "@/lib/use-view-element-size";
import { usePlanPointerNav } from "./usePlanPointerNav";
import type { DxfEntity, FalseColorScale, IsoluxMode, ProjectSceneV2, ResultsV2, RoomV2, RcpDetectionProposal, Vec2 } from "@luxsim/project-io";
import { PlanIsoluxOverlay } from "./PlanIsoluxOverlay";
import {
  findRoomAt,
  isCloseToStart,
  legacyScaleToMetersPerPixel,
  mToMm,
  parseLengthToM,
  resolveDraftPoint,
  isDisplayableRasterUnderlay,
  officialDrawRoomAllowed,
  officialDxfEntitiesToWorld,
  officialDxfPolylineStrokePoints,
  officialRoomRingVertices,
  underlayWorldSize,
  VERTEX_DELETE_NO_TARGET_STATUS,
  commitDeletedRoomPolygon,
  commitStretchedRoomPolygon,
  deleteRoomVertex,
  moveRoomVertex,
  resolveOfficialEdgeInsert,
} from "@luxsim/project-io";
import { clientToSvgPoint } from "./svg-coords";
import { applyRoomDrag, shouldBeginRoomDrag } from "@/lib/room-drag";
import {
  hitRoomEdgeInsert,
  hitRoomVertexHandle,
  officialVertexDeleteKeyAction,
  resolveVertexDeleteTarget,
  roomEdgeInsertAffordances,
  shouldBeginEdgeInsert,
  shouldBeginVertexStretch,
  vertexHandleRadiusM,
} from "@/lib/room-vertex-stretch";
import { applyStoreyDrag, isStoreyDragClick, shouldBeginStoreyDrag } from "@/lib/storey-drag";
import { applyDrawRoomBackspace, drawRoomEscapeAction } from "@/lib/draw-room-keys";
import {
  applyLineEndpointPick,
  EMPTY_LINE_PICK,
  isLinePickInProgress,
  linePickEscapeAction,
  type LinePickState,
} from "@/lib/line-array-pick";
import { roomUnionPickEscapeAction } from "@/lib/room-union-pick";
import {
  applyCircleCentrePick,
  EMPTY_CIRCLE_PICK,
  circlePickEscapeAction,
  isCircleCentrePicked,
  type CirclePickState,
} from "@/lib/circle-array-pick";
import {
  applyPolygonPathVertexPick,
  EMPTY_POLYGON_PATH_PICK,
  finishOpenPolygonPath,
  isCloseToPolygonPathStart,
  isPolygonPathComplete,
  isPolygonPathInProgress,
  polygonPathCloseSnapM,
  polygonPathEnterAction,
  polygonPathEscapeAction,
  worldMetresPerCssPixel,
  type PolygonPathPickState,
} from "@/lib/polygon-array-pick";
import {
  dxfObjectSnapRadiusM,
  officialDxfSnapEntities,
  pickDxfObjectSnap,
  type DxfSnapHit,
} from "@/lib/official-dxf-object-snap";
import {
  OFFICIAL_PLAN_VIEW_H,
  OFFICIAL_PLAN_VIEW_W,
  officialPlanFitTransform,
  officialPlanWorldBounds,
} from "@/lib/official-plan-world-bounds";
import {
  DEFAULT_PLAN_ZOOM,
  PLAN_PAN_BUTTON,
  planViewTransform,
} from "@/lib/plan-zoom";
import type { PhotometricData } from "@luxsim/photometry";
import { planSymbolGeom } from "./LuminaireBody";

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
  onSetRoomPolygon?: (roomId: string, polygon: Vec2[], opts?: { discrete?: boolean }) => void;
  onVertexStretchStatus?: (status: string) => void;
  onMoveStorey?: (storeyId: string, dx: number, dy: number) => void;
  onSelectRoom?: (roomId: string) => void;
  onCalibratePoints?: (a: { x: number; y: number }, b: { x: number; y: number }) => void;
  /** Persist native pixel size (and migrate legacy scale) for older underlays. */
  onUnderlaySourceSize?: (widthPx: number, heightPx: number) => void;
  /** Array tool preview positions (world m, Top plan). */
  arrayPreview?: { x: number; y: number; rotationDeg: number }[];
  rcpProposals?: RcpDetectionProposal[];
  showRcpOverlay?: boolean;
  selectedRcpId?: string | null;
  photometry?: Record<string, PhotometricData>;
  /** Official Line-array click-to-pick (world m). */
  linePick?: LinePickState;
  linePickActive?: boolean;
  onLinePickChange?: (next: LinePickState) => void;
  /** Official Circle-array click-to-pick (world m). */
  circlePick?: CirclePickState;
  circlePickActive?: boolean;
  onCirclePickChange?: (next: CirclePickState) => void;
  /** Official Polygon-array custom path click-to-pick (world m). */
  polygonPick?: PolygonPathPickState;
  polygonPickActive?: boolean;
  onPolygonPickChange?: (next: PolygonPathPickState) => void;
  /** Official Union / Subtract / Intersect / XOR / Align / Distribute rooms pick (Select idle). */
  unionPickActive?: boolean;
  unionPickMode?: "union" | "subtract" | "intersect" | "xor" | "align" | "distribute";
  onUnionRoomPick?: (roomId: string) => void;
  onUnionPickCancel?: () => void;
  onDistributeApply?: () => void;
  /** Calculation results for the plan isolux / value-label overlay. */
  results?: ResultsV2 | null;
  planIsoluxMode?: IsoluxMode;
  showValueLabels?: boolean;
  falseColorScale?: FalseColorScale;
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
  onSetRoomPolygon,
  onVertexStretchStatus,
  onMoveStorey,
  onSelectRoom,
  onCalibratePoints,
  onUnderlaySourceSize,
  arrayPreview = [],
  rcpProposals = [],
  showRcpOverlay = false,
  selectedRcpId = null,
  photometry,
  linePick,
  linePickActive = false,
  onLinePickChange,
  circlePick,
  circlePickActive = false,
  onCirclePickChange,
  polygonPick,
  polygonPickActive = false,
  onPolygonPickChange,
  unionPickActive = false,
  unionPickMode = "union",
  onUnionRoomPick,
  onUnionPickCancel,
  onDistributeApply,
  results = null,
  planIsoluxMode = "falsecolor",
  showValueLabels = false,
  falseColorScale,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const panningRef = useRef(false);
  const [planView, setPlanView] = useState(DEFAULT_PLAN_ZOOM);
  const [draft, setDraft] = useState<Vec2[]>([]);
  const [cursor, setCursor] = useState<Vec2 | null>(null);
  const [lengthBuf, setLengthBuf] = useState("");
  const [ortho, setOrtho] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [movingRoomId, setMovingRoomId] = useState<string | null>(null);
  const [movingStoreyId, setMovingStoreyId] = useState<string | null>(null);
  const [stretchingVertex, setStretchingVertex] = useState<{ roomId: string; index: number } | null>(
    null
  );
  const [activeVertex, setActiveVertex] = useState<{ roomId: string; index: number } | null>(null);
  const lastPointerRef = useRef<{ clientX: number; clientY: number; world: Vec2 } | null>(null);
  const grabOffset = useRef({ x: 0, y: 0 });
  const roomDragOrigin = useRef<Vec2 | null>(null);
  const roomDragApplied = useRef<Vec2>({ x: 0, y: 0 });
  const storeyDragOrigin = useRef<Vec2 | null>(null);
  const storeyDragApplied = useRef<Vec2>({ x: 0, y: 0 });
  const storeyDragClientOrigin = useRef<{ x: number; y: number } | null>(null);
  const storeyDragMoved = useRef(false);
  const calib = useRef<{ x: number; y: number } | null>(null);
  const [resolvedSource, setResolvedSource] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [lineCursor, setLineCursor] = useState<{ x: number; y: number } | null>(null);
  const [polygonCursor, setPolygonCursor] = useState<{ x: number; y: number } | null>(null);
  const [snapHit, setSnapHit] = useState<DxfSnapHit | null>(null);
  const polygonPickRef = useRef<PolygonPathPickState>(polygonPick ?? EMPTY_POLYGON_PATH_PICK);
  polygonPickRef.current = polygonPick ?? EMPTY_POLYGON_PATH_PICK;

  const storeyId = scene.ui.activeStoreyId;
  const rooms = scene.rooms.filter((r) => r.storeyId === storeyId);
  const instances = scene.instances.filter((i) => i.storeyId === storeyId);
  const underlay = scene.underlays.find((u) => u.storeyId === storeyId);
  const drawing =
    scene.ui.tool === "drawRoom" && officialDrawRoomAllowed(underlay);

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
    if (!linePickActive) setLineCursor(null);
  }, [linePickActive]);

  useEffect(() => {
    if (!polygonPickActive) setPolygonCursor(null);
  }, [polygonPickActive]);

  useEffect(() => {
    setPlanView(DEFAULT_PLAN_ZOOM);
  }, [storeyId]);

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
    if (!isDisplayableRasterUnderlay(underlay)) return;

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

  const world = useMemo(
    () => officialPlanWorldBounds({ rooms, dxfEntities, underlay, underlaySize }),
    [rooms, dxfEntities, underlay, underlaySize]
  );

  const { viewW, viewH } = useViewElementSize(
    hostRef,
    OFFICIAL_PLAN_VIEW_W,
    OFFICIAL_PLAN_VIEW_H
  );
  const { scale: fitScale, ox: fitOx, oy: fitOy } = officialPlanFitTransform(world, viewW, viewH);
  const { scale, ox, oy } = planViewTransform(fitOx, fitOy, fitScale, viewW, viewH, planView);
  /**
   * Look-down plan: +X right, +Y up (north), matching world coordinates,
   * the 3D view, and a typical CAD / lighting-plan top view.
   * Do not mirror X — that flipped the floor plate relative to 3D.
   */
  const toScreen = (x: number, y: number) => ({
    x: ox + (x - world.minX) * scale,
    y: oy + (world.minY + world.depth - y) * scale,
  });

  const toWorld = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const { x: svgX, y: svgY } = clientToSvgPoint(svg, clientX, clientY);
    return {
      x: world.minX + (svgX - ox) / scale,
      y: world.minY + world.depth - (svgY - oy) / scale,
    };
  };

  const dxfWorldEntities = officialDxfEntitiesToWorld(dxfEntities, underlay);
  const snapEntities = officialDxfSnapEntities(underlay, dxfWorldEntities);

  function snappedWorldAt(clientX: number, clientY: number): { x: number; y: number; hit: DxfSnapHit | null } {
    const raw = toWorld(clientX, clientY);
    if (snapEntities.length === 0) return { ...raw, hit: null };
    const radiusM = dxfObjectSnapRadiusM(worldMetresPerCssPixel(toWorld, clientX, clientY));
    const hit = pickDxfObjectSnap(raw, snapEntities, radiusM);
    return hit ? { x: hit.point.x, y: hit.point.y, hit } : { ...raw, hit: null };
  }

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
        if (drawRoomEscapeAction(lengthBuf, draft.length) === "pass") return;
        e.preventDefault();
        e.stopImmediatePropagation();
        setDraft([]);
        setCursor(null);
        setLengthBuf("");
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        const next = applyDrawRoomBackspace(lengthBuf, draft);
        setLengthBuf(next.lengthBuf);
        setDraft(next.draft);
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
    window.addEventListener("keydown", onKey, { capture: true });
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onKey, { capture: true });
      window.removeEventListener("keyup", onUp);
    };
    // commitPoint uses latest draft/preview via closure; lengthBuf + draft keep it current
  }, [drawing, lengthBuf, last, preview, draft]);

  useEffect(() => {
    setActiveVertex((current) => {
      if (!current) return current;
      if (current.roomId !== scene.ui.activeRoomId) return null;
      const room = scene.rooms.find((r) => r.id === current.roomId);
      if (!room) return null;
      if (current.index >= officialRoomRingVertices(room.polygon).length) return null;
      return current;
    });
  }, [scene.ui.activeRoomId, scene.rooms]);

  useEffect(() => {
    if (drawing) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTypingField(e.target)) return;
      if (
        officialVertexDeleteKeyAction({
          key: e.key,
          tool: scene.ui.tool,
          drawing,
          calibrating: scene.ui.tool === "calibrate",
          linePickActive,
          circlePickActive,
          polygonPickActive,
          unionPickActive,
          stretching: stretchingVertex != null,
        }) !== "delete"
      ) {
        return;
      }
      e.preventDefault();
      const room = rooms.find((r) => r.id === scene.ui.activeRoomId);
      if (!room || !onSetRoomPolygon) {
        onVertexStretchStatus?.(VERTEX_DELETE_NO_TARGET_STATUS);
        return;
      }
      const pointer = lastPointerRef.current;
      const radiusM = pointer
        ? vertexRadiusMAt(pointer.clientX, pointer.clientY)
        : vertexHandleRadiusM(0);
      const target = resolveVertexDeleteTarget({
        pointer: pointer?.world ?? null,
        polygon: room.polygon,
        radiusM,
        activeVertexIndex: activeVertex?.roomId === room.id ? activeVertex.index : null,
      });
      if (target == null) {
        onVertexStretchStatus?.(VERTEX_DELETE_NO_TARGET_STATUS);
        return;
      }
      const result = commitDeletedRoomPolygon(room.polygon, deleteRoomVertex(room.polygon, target));
      if (result.reverted) {
        if (result.status) onVertexStretchStatus?.(result.status);
        return;
      }
      onSetRoomPolygon(room.id, result.polygon, { discrete: true });
      setActiveVertex(null);
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [
    drawing,
    rooms,
    scene.ui.tool,
    scene.ui.activeRoomId,
    linePickActive,
    circlePickActive,
    polygonPickActive,
    unionPickActive,
    stretchingVertex,
    activeVertex,
    onSetRoomPolygon,
    onVertexStretchStatus,
  ]);

  useEffect(() => {
    if (!linePickActive || !linePick || drawing) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTypingField(e.target)) return;
      if (e.key !== "Escape") return;
      if (linePickEscapeAction(linePick) === "pass") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setLineCursor(null);
      onLinePickChange?.(EMPTY_LINE_PICK);
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [linePickActive, linePick, drawing, onLinePickChange]);

  useEffect(() => {
    if (!unionPickActive || drawing) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTypingField(e.target)) return;
      if (e.key === "Enter" && unionPickMode === "distribute") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onDistributeApply?.();
        return;
      }
      if (e.key !== "Escape") return;
      if (roomUnionPickEscapeAction({ active: true, firstRoomId: null }) === "pass") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onUnionPickCancel?.();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [unionPickActive, unionPickMode, drawing, onUnionPickCancel, onDistributeApply]);

  useEffect(() => {
    if (!circlePickActive || !circlePick || drawing) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTypingField(e.target)) return;
      if (e.key !== "Escape") return;
      if (circlePickEscapeAction(circlePick) === "pass") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onCirclePickChange?.(EMPTY_CIRCLE_PICK);
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [circlePickActive, circlePick, drawing, onCirclePickChange]);

  useEffect(() => {
    if (!polygonPickActive || drawing) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTypingField(e.target)) return;
      const current = polygonPickRef.current;
      if (e.key === "Escape") {
        if (polygonPathEscapeAction(current) === "pass") return;
        e.preventDefault();
        e.stopImmediatePropagation();
        setPolygonCursor(null);
        const next = EMPTY_POLYGON_PATH_PICK;
        polygonPickRef.current = next;
        onPolygonPickChange?.(next);
        return;
      }
      if (e.key === "Enter") {
        if (polygonPathEnterAction(current) === "pass") return;
        e.preventDefault();
        const next = finishOpenPolygonPath(current);
        polygonPickRef.current = next;
        onPolygonPickChange?.(next);
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [polygonPickActive, polygonPick, drawing, onPolygonPickChange]);

  function closeSnapMAt(clientX: number, clientY: number): number {
    return polygonPathCloseSnapM(worldMetresPerCssPixel(toWorld, clientX, clientY));
  }

  function currentPolygonCloseSnapM(): number {
    const svg = svgRef.current;
    if (!svg) return polygonPathCloseSnapM(0);
    const rect = svg.getBoundingClientRect();
    return closeSnapMAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  function commitPolygonPathClick(clientX: number, clientY: number) {
    if (!onPolygonPickChange) return;
    const snapped = snappedWorldAt(clientX, clientY);
    const next = applyPolygonPathVertexPick(
      polygonPickRef.current,
      { x: snapped.x, y: snapped.y },
      { closeSnapM: closeSnapMAt(clientX, clientY) }
    );
    polygonPickRef.current = next;
    onPolygonPickChange(next);
  }

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

  function endRoomDrag() {
    setMovingRoomId(null);
    roomDragOrigin.current = null;
    roomDragApplied.current = { x: 0, y: 0 };
  }

  function endStoreyDrag() {
    setMovingStoreyId(null);
    storeyDragOrigin.current = null;
    storeyDragApplied.current = { x: 0, y: 0 };
    storeyDragClientOrigin.current = null;
    storeyDragMoved.current = false;
  }

  function beginStoreyDrag(hitRoomId: string, start: Vec2, client: { x: number; y: number }) {
    setActiveVertex(null);
    const targetStoreyId = storeyId;
    storeyDragOrigin.current = start;
    storeyDragApplied.current = { x: 0, y: 0 };
    storeyDragClientOrigin.current = client;
    storeyDragMoved.current = false;
    setMovingStoreyId(targetStoreyId);
    const move = (ev: MouseEvent) => {
      const origin = storeyDragOrigin.current;
      const clientOrigin = storeyDragClientOrigin.current;
      if (!origin || !clientOrigin) return;
      if (!storeyDragMoved.current) {
        if (isStoreyDragClick(clientOrigin, { x: ev.clientX, y: ev.clientY })) return;
        storeyDragMoved.current = true;
      }
      const w = toWorld(ev.clientX, ev.clientY);
      storeyDragApplied.current = applyStoreyDrag(
        onMoveStorey,
        targetStoreyId,
        origin,
        storeyDragApplied.current,
        w,
        ev.shiftKey
      );
    };
    const up = (ev: MouseEvent) => {
      const clientOrigin = storeyDragClientOrigin.current;
      const wasClick =
        !storeyDragMoved.current &&
        !!clientOrigin &&
        isStoreyDragClick(clientOrigin, { x: ev.clientX, y: ev.clientY });
      endStoreyDrag();
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      if (wasClick) onSelectRoom?.(hitRoomId);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  function beginRoomDrag(roomId: string, start: Vec2) {
    setActiveVertex(null);
    roomDragOrigin.current = start;
    roomDragApplied.current = { x: 0, y: 0 };
    setMovingRoomId(roomId);
    const move = (ev: MouseEvent) => {
      const origin = roomDragOrigin.current;
      if (!origin) return;
      const w = toWorld(ev.clientX, ev.clientY);
      roomDragApplied.current = applyRoomDrag(
        onMoveRoom,
        roomId,
        origin,
        roomDragApplied.current,
        w,
        ev.shiftKey
      );
    };
    const up = () => {
      endRoomDrag();
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  function vertexRadiusMAt(clientX: number, clientY: number): number {
    return vertexHandleRadiusM(worldMetresPerCssPixel(toWorld, clientX, clientY));
  }

  function handleRadiusSvg(): number {
    const svg = svgRef.current;
    if (!svg) return 8;
    const rect = svg.getBoundingClientRect();
    const radiusM = vertexRadiusMAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return Math.max(5, radiusM * scale);
  }

  function beginVertexStretch(
    roomId: string,
    index: number,
    sourcePolygon: Vec2[],
    commitOriginal: Vec2[] = sourcePolygon,
    opts?: { selectOnClick?: boolean; startClient?: { x: number; y: number } }
  ) {
    const source = sourcePolygon.map((p) => ({ x: p.x, y: p.y }));
    const original = commitOriginal.map((p) => ({ x: p.x, y: p.y }));
    const selectOnClick = Boolean(opts?.selectOnClick && opts.startClient);
    const startClient = opts?.startClient;
    let dragged = !selectOnClick;
    if (!selectOnClick) setStretchingVertex({ roomId, index });
    const applyAt = (clientX: number, clientY: number, commit: boolean) => {
      const snapped = snappedWorldAt(clientX, clientY);
      setSnapHit(snapped.hit);
      const next = moveRoomVertex(source, index, { x: snapped.x, y: snapped.y });
      if (commit) {
        const result = commitStretchedRoomPolygon(original, next);
        onSetRoomPolygon?.(roomId, result.polygon);
        if (result.reverted && result.status) onVertexStretchStatus?.(result.status);
        return;
      }
      onSetRoomPolygon?.(roomId, next);
    };
    const move = (ev: MouseEvent) => {
      if (!dragged) {
        if (startClient && isStoreyDragClick(startClient, { x: ev.clientX, y: ev.clientY })) {
          return;
        }
        dragged = true;
        setStretchingVertex({ roomId, index });
      }
      applyAt(ev.clientX, ev.clientY, false);
    };
    const up = (ev: MouseEvent) => {
      if (!dragged) {
        setActiveVertex({ roomId, index });
        setStretchingVertex(null);
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
        return;
      }
      applyAt(ev.clientX, ev.clientY, true);
      setStretchingVertex(null);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  function beginEdgeInsert(
    roomId: string,
    original: Vec2[],
    edgeIndex: number,
    pointer: Vec2,
    clientX: number,
    clientY: number
  ) {
    const snapped = snappedWorldAt(clientX, clientY);
    setSnapHit(snapped.hit);
    const resolved = resolveOfficialEdgeInsert(
      original,
      edgeIndex,
      pointer,
      snapped.hit ? { x: snapped.x, y: snapped.y } : null
    );
    if (!resolved) return;
    setActiveVertex(null);
    onSetRoomPolygon?.(roomId, resolved.polygon);
    beginVertexStretch(roomId, resolved.vertexIndex, resolved.polygon, original);
  }

  const underlayScreen =
    underlay && underlaySize
      ? {
          x: ox + (underlay.offsetX - world.minX) * scale,
          y:
            oy +
            (world.minY + world.depth - (underlay.offsetY + underlaySize.heightM)) * scale,
          width: underlaySize.widthM * scale,
          height: underlaySize.heightM * scale,
          flipImageX: false,
          flipImageY: true,
        }
      : null;

  const liveMm =
    last && preview ? Math.round(mToMm(Math.hypot(preview.x - last.x, preview.y - last.y))) : null;

  usePlanPointerNav(svgRef, {
    viewW,
    viewH,
    fitOx,
    fitOy,
    fitScale,
    setPlanView,
    panningRef,
  });

  return (
    <div
      ref={hostRef}
      className="relative w-full h-full min-h-0 bg-[#0f1c24]"
      onDragOver={(e) => e.preventDefault()}
      onMouseLeave={() => {
        setSnapHit(null);
        lastPointerRef.current = null;
      }}
      onDoubleClick={(e) => {
        if (drawing || linePickActive || circlePickActive) return;
        if (polygonPickActive && polygonPathEnterAction(polygonPickRef.current) === "finish-open") {
          e.preventDefault();
          const next = finishOpenPolygonPath(polygonPickRef.current);
          polygonPickRef.current = next;
          onPolygonPickChange?.(next);
          return;
        }
        if (drawing || linePickActive || circlePickActive || polygonPickActive) return;
        const target = e.target;
        if (!(target instanceof Element) || !target.closest("[data-plan-bg]")) return;
        e.preventDefault();
        setPlanView(DEFAULT_PLAN_ZOOM);
      }}
      onDrop={(e) => {
        e.preventDefault();
        const luminaireId = e.dataTransfer.getData("application/x-luxsim-luminaire");
        if (!luminaireId) return;
        const snapped = snappedWorldAt(e.clientX, e.clientY);
        onDropLuminaire(luminaireId, snapped.x, snapped.y);
      }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${viewW} ${viewH}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={(e) => {
          if (e.button === PLAN_PAN_BUTTON || e.button !== 0 || panningRef.current) return;
          const snapped = snappedWorldAt(e.clientX, e.clientY);
          const w = { x: snapped.x, y: snapped.y };
          setSnapHit(snapped.hit);
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
          if (linePickActive && onLinePickChange && e.detail === 1) {
            onLinePickChange(applyLineEndpointPick(linePick ?? EMPTY_LINE_PICK, w));
            return;
          }
          if (circlePickActive && onCirclePickChange && e.detail === 1) {
            onCirclePickChange(applyCircleCentrePick(circlePick ?? EMPTY_CIRCLE_PICK, w));
            return;
          }
          if (polygonPickActive && onPolygonPickChange && e.detail === 1) {
            commitPolygonPathClick(e.clientX, e.clientY);
            return;
          }
          setActiveVertex(null);
          onSelect(null);
        }}
        onMouseMove={(e) => {
          setOrtho(e.shiftKey);
          const raw = toWorld(e.clientX, e.clientY);
          lastPointerRef.current = { clientX: e.clientX, clientY: e.clientY, world: raw };
          const snapped = snappedWorldAt(e.clientX, e.clientY);
          const w = { x: snapped.x, y: snapped.y };
          setSnapHit(snapped.hit);
          if (drawing) {
            setCursor(w);
            return;
          }
          if (linePickActive) {
            setLineCursor(w);
            return;
          }
          if (polygonPickActive) {
            setPolygonCursor(w);
            return;
          }
        }}
      >
        <rect data-plan-bg="true" width={viewW} height={viewH} fill="#0f1c24" />

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

        {dxfWorldEntities.map((ent, idx) => {
          const pts = officialDxfPolylineStrokePoints(ent).map((p) =>
            toScreen(p.x, p.y)
          );
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
              style={{
                cursor:
                  movingRoomId === room.id || movingStoreyId === room.storeyId
                    ? "grabbing"
                    : scene.ui.tool === "select"
                      ? "grab"
                      : "inherit",
              }}
              onMouseDown={(e) => {
                if (e.button !== 0 || panningRef.current) return;
                if (drawing || scene.ui.tool === "calibrate") return;
                if (linePickActive && onLinePickChange) {
                  e.stopPropagation();
                  if (e.detail === 1) {
                    onLinePickChange(
                      applyLineEndpointPick(linePick ?? EMPTY_LINE_PICK, snappedWorldAt(e.clientX, e.clientY))
                    );
                  }
                  return;
                }
                if (circlePickActive && onCirclePickChange) {
                  e.stopPropagation();
                  if (e.detail === 1) {
                    onCirclePickChange(
                      applyCircleCentrePick(circlePick ?? EMPTY_CIRCLE_PICK, snappedWorldAt(e.clientX, e.clientY))
                    );
                  }
                  return;
                }
                if (polygonPickActive && onPolygonPickChange) {
                  e.stopPropagation();
                  if (e.detail === 1) {
                    commitPolygonPathClick(e.clientX, e.clientY);
                  }
                  return;
                }
                if (unionPickActive && onUnionRoomPick) {
                  e.stopPropagation();
                  onUnionRoomPick(room.id);
                  return;
                }
                e.stopPropagation();
                if (room.id === scene.ui.activeRoomId) {
                  const handleIndex = hitRoomVertexHandle(
                    toWorld(e.clientX, e.clientY),
                    room.polygon,
                    vertexRadiusMAt(e.clientX, e.clientY)
                  );
                  if (
                    shouldBeginVertexStretch({
                      tool: scene.ui.tool,
                      drawing,
                      calibrating: false,
                      linePickActive,
                      circlePickActive,
                      polygonPickActive,
                      unionPickActive,
                      handleIndex,
                      onSetRoomPolygon,
                    })
                  ) {
                    beginVertexStretch(room.id, handleIndex!, room.polygon, room.polygon, {
                      selectOnClick: true,
                      startClient: { x: e.clientX, y: e.clientY },
                    });
                    return;
                  }
                  const edgeHit = hitRoomEdgeInsert(
                    toWorld(e.clientX, e.clientY),
                    room.polygon,
                    vertexRadiusMAt(e.clientX, e.clientY)
                  );
                  if (
                    shouldBeginEdgeInsert({
                      tool: scene.ui.tool,
                      drawing,
                      calibrating: false,
                      linePickActive,
                      circlePickActive,
                      polygonPickActive,
                      unionPickActive,
                      edgeIndex: edgeHit?.edgeIndex,
                      onSetRoomPolygon,
                    })
                  ) {
                    beginEdgeInsert(
                      room.id,
                      room.polygon,
                      edgeHit!.edgeIndex,
                      toWorld(e.clientX, e.clientY),
                      e.clientX,
                      e.clientY
                    );
                    return;
                  }
                }
                if (
                  shouldBeginStoreyDrag({
                    tool: scene.ui.tool,
                    drawing,
                    calibrating: false,
                    linePickActive,
                    circlePickActive,
                    polygonPickActive,
                    unionPickActive,
                    activeRoomId: scene.ui.activeRoomId,
                    activeStoreyId: scene.ui.activeStoreyId,
                    hitRoomStoreyId: room.storeyId,
                    onMoveStorey,
                  })
                ) {
                  beginStoreyDrag(
                    room.id,
                    toWorld(e.clientX, e.clientY),
                    { x: e.clientX, y: e.clientY }
                  );
                  return;
                }
                onSelectRoom?.(room.id);
                if (
                  !shouldBeginRoomDrag({
                    tool: scene.ui.tool,
                    drawing,
                    calibrating: false,
                    linePickActive,
                    circlePickActive,
                    polygonPickActive,
                    unionPickActive,
                    onMoveRoom,
                  })
                ) {
                  return;
                }
                beginRoomDrag(room.id, toWorld(e.clientX, e.clientY));
              }}
            />
          );
        })}

        {scene.ui.tool === "select" &&
          !drawing &&
          !linePickActive &&
          !circlePickActive &&
          !polygonPickActive &&
          !unionPickActive &&
          rooms
            .filter((room) => room.id === scene.ui.activeRoomId)
            .map((room) => {
              const hitR = handleRadiusSvg();
              const radiusM = hitR / scale;
              return roomEdgeInsertAffordances(room.polygon, radiusM).map((edge) => {
                const mid = toScreen(edge.mid.x, edge.mid.y);
                const a = toScreen(edge.a.x, edge.a.y);
                const b = toScreen(edge.b.x, edge.b.y);
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const len = Math.hypot(dx, dy);
                const inset = Math.min(hitR, len / 2);
                const ux = len > 0 ? dx / len : 0;
                const uy = len > 0 ? dy / len : 0;
                const hx1 = a.x + ux * inset;
                const hy1 = a.y + uy * inset;
                const hx2 = b.x - ux * inset;
                const hy2 = b.y - uy * inset;
                const size = 3;
                return (
                  <g
                    key={`${room.id}-edge-insert-${edge.edgeIndex}`}
                    data-room-edge-insert={edge.edgeIndex}
                    style={{ cursor: "pointer" }}
                    onMouseDown={(e) => {
                      if (e.button !== 0 || panningRef.current) return;
                      if (drawing) return;
                      if (linePickActive || circlePickActive || polygonPickActive) return;
                      if (unionPickActive) return;
                      e.stopPropagation();
                      const pointer = toWorld(e.clientX, e.clientY);
                      const edgeHit =
                        hitRoomEdgeInsert(
                          pointer,
                          room.polygon,
                          vertexRadiusMAt(e.clientX, e.clientY)
                        ) ?? { edgeIndex: edge.edgeIndex, point: edge.mid };
                      if (
                        !shouldBeginEdgeInsert({
                          tool: scene.ui.tool,
                          drawing,
                          calibrating: false,
                          linePickActive,
                          circlePickActive,
                          polygonPickActive,
                          unionPickActive,
                          edgeIndex: edgeHit.edgeIndex,
                          onSetRoomPolygon,
                        })
                      ) {
                        return;
                      }
                      onSelectRoom?.(room.id);
                      beginEdgeInsert(
                        room.id,
                        room.polygon,
                        edgeHit.edgeIndex,
                        pointer,
                        e.clientX,
                        e.clientY
                      );
                    }}
                  >
                    <line
                      x1={hx1}
                      y1={hy1}
                      x2={hx2}
                      y2={hy2}
                      stroke="transparent"
                      strokeWidth={Math.max(2, 2 * hitR)}
                      strokeLinecap="butt"
                    />
                    <rect
                      x={mid.x - size}
                      y={mid.y - size}
                      width={size * 2}
                      height={size * 2}
                      fill="#7eb8da"
                      stroke="#1a1510"
                      strokeWidth={1}
                      transform={`rotate(45 ${mid.x} ${mid.y})`}
                    />
                  </g>
                );
              });
            })}

        {scene.ui.tool === "select" &&
          !drawing &&
          !linePickActive &&
          !circlePickActive &&
          !polygonPickActive &&
          !unionPickActive &&
          rooms
            .filter((room) => room.id === scene.ui.activeRoomId)
            .map((room) => {
              const ring = officialRoomRingVertices(room.polygon);
              const hitR = handleRadiusSvg();
              return ring.map((p, index) => {
                const s = toScreen(p.x, p.y);
                const stretching =
                  stretchingVertex?.roomId === room.id && stretchingVertex.index === index;
                const selectedVertex =
                  activeVertex?.roomId === room.id && activeVertex.index === index;
                return (
                  <g
                    key={`${room.id}-vertex-${index}`}
                    data-room-vertex-handle={index}
                    data-room-vertex-active={selectedVertex ? "true" : undefined}
                    style={{ cursor: stretching ? "grabbing" : "pointer" }}
                    onMouseDown={(e) => {
                      if (e.button !== 0 || panningRef.current) return;
                      if (drawing) return;
                      if (linePickActive || circlePickActive || polygonPickActive) return;
                      if (unionPickActive) return;
                      e.stopPropagation();
                      if (
                        !shouldBeginVertexStretch({
                          tool: scene.ui.tool,
                          drawing,
                          calibrating: false,
                          linePickActive,
                          circlePickActive,
                          polygonPickActive,
                          unionPickActive,
                          handleIndex: index,
                          onSetRoomPolygon,
                        })
                      ) {
                        return;
                      }
                      onSelectRoom?.(room.id);
                      beginVertexStretch(room.id, index, room.polygon, room.polygon, {
                        selectOnClick: true,
                        startClient: { x: e.clientX, y: e.clientY },
                      });
                    }}
                  >
                    <circle cx={s.x} cy={s.y} r={hitR} fill="transparent" />
                    <circle
                      cx={s.x}
                      cy={s.y}
                      r={5}
                      fill={stretching || selectedVertex ? "#e8c27a" : "#f4d35e"}
                      stroke="#1a1510"
                      strokeWidth={selectedVertex && !stretching ? 2 : 1}
                    />
                  </g>
                );
              });
            })}

        {results && (
          <PlanIsoluxOverlay
            scene={scene}
            rooms={rooms}
            results={results}
            mode={planIsoluxMode}
            showValueLabels={showValueLabels}
            toScreen={toScreen}
            viewW={viewW}
            viewH={viewH}
            colorScale={falseColorScale}
          />
        )}


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

        {linePickActive && linePick?.start && (() => {
          const start = toScreen(linePick.start.x, linePick.start.y);
          const rubber = linePick.end ?? lineCursor;
          const end = rubber ? toScreen(rubber.x, rubber.y) : null;
          return (
            <g pointerEvents="none">
              {end && (
                <line
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke="#7ec8e3"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  opacity={0.9}
                />
              )}
              <circle cx={start.x} cy={start.y} r={4} fill="#7ec8e3" stroke="#fff" strokeWidth={1} />
              {linePick.end && end && (
                <circle cx={end.x} cy={end.y} r={4} fill="#7ec8e3" stroke="#fff" strokeWidth={1} />
              )}
            </g>
          );
        })()}

        {circlePickActive && isCircleCentrePicked(circlePick ?? EMPTY_CIRCLE_PICK) && (() => {
          const c = toScreen(circlePick!.centre!.x, circlePick!.centre!.y);
          return (
            <g pointerEvents="none">
              <circle cx={c.x} cy={c.y} r={4} fill="#7ec8e3" stroke="#fff" strokeWidth={1} />
            </g>
          );
        })()}

        {polygonPickActive && (polygonPick?.vertices.length ?? 0) > 0 && (() => {
          const vertices = polygonPick!.vertices;
          const rubber = !polygonPick!.finished ? polygonCursor : null;
          const first = vertices[0]!;
          const willClose = Boolean(
            rubber &&
              vertices.length >= 3 &&
              isCloseToPolygonPathStart(rubber, first, currentPolygonCloseSnapM())
          );
          const screenPts = [
            ...vertices,
            ...(polygonPick!.finished && polygonPick!.closed ? [first] : []),
            ...(rubber && !polygonPick!.finished ? [willClose ? first : rubber] : []),
          ].map((pt) => toScreen(pt.x, pt.y));
          return (
            <g pointerEvents="none">
              {screenPts.length >= 2 && (
                <polyline
                  fill="none"
                  stroke="#7ec8e3"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  opacity={0.9}
                  points={screenPts.map((pt) => `${pt.x},${pt.y}`).join(" ")}
                />
              )}
              {vertices.map((pt, idx) => {
                const s = toScreen(pt.x, pt.y);
                const start = idx === 0;
                return (
                  <circle
                    key={idx}
                    cx={s.x}
                    cy={s.y}
                    r={start ? 5 : 4}
                    fill={start && willClose ? "#e8c27a" : "#7ec8e3"}
                    stroke="#fff"
                    strokeWidth={1}
                  />
                );
              })}
            </g>
          );
        })()}

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
                if (e.button !== 0 || panningRef.current) return;
                e.stopPropagation();
                if (linePickActive && onLinePickChange) {
                  if (e.detail === 1) {
                    onLinePickChange(
                      applyLineEndpointPick(linePick ?? EMPTY_LINE_PICK, snappedWorldAt(e.clientX, e.clientY))
                    );
                  }
                  return;
                }
                if (circlePickActive && onCirclePickChange) {
                  if (e.detail === 1) {
                    onCirclePickChange(
                      applyCircleCentrePick(circlePick ?? EMPTY_CIRCLE_PICK, snappedWorldAt(e.clientX, e.clientY))
                    );
                  }
                  return;
                }
                if (polygonPickActive && onPolygonPickChange) {
                  if (e.detail === 1) {
                    commitPolygonPathClick(e.clientX, e.clientY);
                  }
                  return;
                }
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
              {(() => {
                const { body, rx, ry, hitR } = planSymbolGeom(photometry?.[inst.luminaireId], scale);
                const fill = selected ? "#c45c26" : body.housing === "black" ? "#2a2a2c" : "#d8d4cc";
                const len = selected ? Math.max(14, rx + 6) : Math.max(10, rx + 4);
                const rad = (inst.rotationDeg * Math.PI) / 180;
                const x2 = Math.cos(rad) * len;
                const y2 = -Math.sin(rad) * len;
                return (
                  <>
                    <circle r={hitR} fill="transparent" />
                    {body.isCircular ? (
                      <>
                        <circle r={rx} fill={fill} stroke="#fff" strokeWidth={0.8} />
                        <circle r={rx * 0.62} fill="#f3e2b0" />
                      </>
                    ) : (
                      <rect
                        x={-rx}
                        y={-ry}
                        width={rx * 2}
                        height={ry * 2}
                        fill={fill}
                        stroke="#fff"
                        strokeWidth={0.8}
                      />
                    )}
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

        {snapHit &&
          (() => {
            const spt = toScreen(snapHit.point.x, snapHit.point.y);
            const r = 6;
            const stroke = "#f4d35e";
            return (
              <g
                data-dxf-snap={snapHit.kind}
                transform={`translate(${spt.x},${spt.y})`}
                pointerEvents="none"
              >
                {snapHit.kind === "endpoint" && (
                  <rect
                    x={-r}
                    y={-r}
                    width={r * 2}
                    height={r * 2}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={1.5}
                  />
                )}
                {snapHit.kind === "midpoint" && (
                  <polygon
                    points={`0,${-r} ${r},${r} ${-r},${r}`}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={1.5}
                  />
                )}
                {snapHit.kind === "nearest" && (
                  <>
                    <line x1={-r} y1={-r} x2={r} y2={r} stroke={stroke} strokeWidth={1.5} />
                    <line x1={r} y1={-r} x2={-r} y2={r} stroke={stroke} strokeWidth={1.5} />
                  </>
                )}
              </g>
            );
          })()}
      </svg>
      <div className="absolute bottom-2 left-2 text-[10px] text-white/60">
        {variant === "bottom" ? "Bottom" : "Top"} view · scroll to zoom
        {planView.zoom !== 1 ? " · double-click empty area to reset" : ""}
        {" "}
        · drop fixtures into rooms · tool: {scene.ui.tool}
        {unionPickActive && (
          <>
            {" "}
            {unionPickMode === "subtract"
              ? "· click a room to subtract · Esc cancels"
              : unionPickMode === "intersect"
                ? "· click a room to intersect · Esc cancels"
                : unionPickMode === "xor"
                  ? "· click a room to XOR · Esc cancels"
                  : unionPickMode === "align"
                    ? "· click a room to align · Esc cancels"
                    : unionPickMode === "distribute"
                      ? "· click rooms to distribute · Enter applies when three or more are selected · Esc cancels"
                      : "· click a room to union · Esc cancels"}
          </>
        )}
        {linePickActive && (
          <>
            {" "}
            · click two points to set the line
            {isLinePickInProgress(linePick ?? { start: null, end: null })
              ? " · click the end point · Esc cancels the start"
              : linePick?.end
                ? " · click again to start a new line"
                : ""}
          </>
        )}
        {circlePickActive && (
          <>
            {" "}
            · click to set the circle centre
            {isCircleCentrePicked(circlePick ?? EMPTY_CIRCLE_PICK)
              ? " · click again to move it · Esc clears the centre"
              : ""}
          </>
        )}
        {polygonPickActive && (
          <>
            {" "}
            · click to add polygon path vertices
            {isPolygonPathInProgress(polygonPick ?? EMPTY_POLYGON_PATH_PICK)
              ? " · Enter or double-click finishes an open path · click near the first vertex to close · Esc cancels the path"
              : isPolygonPathComplete(polygonPick ?? EMPTY_POLYGON_PATH_PICK)
                ? " · click again to start a new path"
                : ""}
          </>
        )}
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
