"use client";

import { useEffect, useLayoutEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import {
  captureSvgViewportToCanvas,
  hidePlanNavSnapshot,
  showPlanNavSnapshot,
  snapshotViewKey,
} from "@/lib/plan-nav-snapshot";
import {
  PLAN_PAN_BUTTON,
  livePlanNavCssTransform,
  livePlanNavTransformAttr,
  panPlanBy,
  planViewTransform,
  pointerDeltaToView,
  clientPointToView,
  type PlanZoom,
  wheelZoomFactor,
  zoomPlanToward,
} from "@/lib/plan-zoom";

type PlanPointerNavOpts = {
  viewW: number;
  viewH: number;
  fitOx: number;
  fitOy: number;
  fitScale: number;
  setPlanView: Dispatch<SetStateAction<PlanZoom>>;
  /** Untransformed view host; used for pointer-to-view mapping and nav events. */
  hostRef: RefObject<HTMLElement | null>;
  /** Viewport-sized canvas that shows a bitmap snapshot during pan/zoom. */
  snapshotRef?: RefObject<HTMLCanvasElement | null>;
  /** Set true while a middle-button pan is in progress so left-click tools stay idle. */
  panningRef?: RefObject<boolean>;
  /** World-space (or already-projected) plan content, used only as a fallback. */
  navGroupRef?: RefObject<SVGGElement | null>;
  /** Latest view, including an in-progress pan or zoom. Event handlers should read this. */
  liveViewRef?: RefObject<PlanZoom>;
  /** View last committed to React state (the coordinates currently drawn). */
  committedViewRef?: RefObject<PlanZoom>;
  /** React-committed view; used to clear the live transform after a redraw. */
  planView: PlanZoom;
};

/** Wait this long after the last wheel event before rebuilding plan coordinates. */
export const PLAN_NAV_WHEEL_COMMIT_MS = 80;

const CAPTURE_NONPASSIVE = { capture: true, passive: false } as const;
const CAPTURE = { capture: true } as const;

function samePlanView(a: PlanZoom, b: PlanZoom): boolean {
  return a.zoom === b.zoom && a.panX === b.panX && a.panY === b.panY;
}

/**
 * Official view navigation: wheel zooms toward the cursor, and holding the
 * middle (scroll-wheel) button pans. Left-click is not used to pan.
 *
 * During a gesture the visible viewport is captured once to a bitmap. That
 * snapshot is CSS-transformed once per frame, and the dense live SVG is hidden
 * so it is not re-rasterized on every move. React state is committed when the
 * gesture finishes, then the live SVG is shown at the new view.
 */
export function usePlanPointerNav(
  svgRef: RefObject<SVGSVGElement | null>,
  opts: PlanPointerNavOpts
) {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const gestureCommittedRef = useRef<PlanZoom | null>(null);
  const gestureLiveRef = useRef<PlanZoom | null>(null);
  const wheelTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingLiveRef = useRef<PlanZoom | null>(null);
  const snapshotActiveRef = useRef(false);
  const snapshotPendingRef = useRef(0);
  const snapshotWarmReadyRef = useRef(false);
  const snapshotWarmKeyRef = useRef("");
  const idleCaptureRef = useRef<number | null>(null);
  const gestureActiveRef = useRef(false);
  const endSnapshotRef = useRef<() => void>(() => {});
  const scheduleWarmRef = useRef<() => void>(() => {});

  useLayoutEffect(() => {
    const view = opts.planView;
    if (opts.liveViewRef) opts.liveViewRef.current = view;
    if (opts.committedViewRef) opts.committedViewRef.current = view;
    gestureCommittedRef.current = view;
    gestureLiveRef.current = view;
    opts.navGroupRef?.current?.removeAttribute("transform");
    endSnapshotRef.current();
    scheduleWarmRef.current();
  }, [opts.planView, opts.liveViewRef, opts.committedViewRef, opts.navGroupRef]);

  useEffect(() => {
    const svg = svgRef.current;
    const host = optsRef.current.hostRef.current;
    if (!svg || !host) return;

    const screenOf = (view: PlanZoom) => {
      const o = optsRef.current;
      return planViewTransform(o.fitOx, o.fitOy, o.fitScale, o.viewW, o.viewH, view);
    };

    const hostBox = () => {
      const rect = host.getBoundingClientRect();
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    };

    const readCommitted = (): PlanZoom | null =>
      gestureCommittedRef.current ?? optsRef.current.committedViewRef?.current ?? null;

    const readLive = (): PlanZoom | null =>
      gestureLiveRef.current ?? optsRef.current.liveViewRef?.current ?? readCommitted();

    const cancelIdleCapture = () => {
      if (idleCaptureRef.current == null) return;
      const cancelIdle = window.cancelIdleCallback;
      if (typeof cancelIdle === "function") cancelIdle(idleCaptureRef.current);
      else window.clearTimeout(idleCaptureRef.current);
      idleCaptureRef.current = null;
    };

    const endSnapshot = () => {
      snapshotActiveRef.current = false;
      hidePlanNavSnapshot(optsRef.current.snapshotRef?.current ?? null, svg);
    };
    endSnapshotRef.current = endSnapshot;

    const paintLive = (view: PlanZoom) => {
      gestureLiveRef.current = view;
      if (optsRef.current.liveViewRef) optsRef.current.liveViewRef.current = view;
      const committed = readCommitted();
      if (!committed) return;
      const o = optsRef.current;
      const canvas = o.snapshotRef?.current;
      if (snapshotActiveRef.current && canvas) {
        const box = hostBox();
        const cssX = box.width > 0 ? box.width / o.viewW : 1;
        const cssY = box.height > 0 ? box.height / o.viewH : 1;
        canvas.style.transform = livePlanNavCssTransform(screenOf(committed), screenOf(view), cssX, cssY);
        o.navGroupRef?.current?.removeAttribute("transform");
        return;
      }
      if (snapshotPendingRef.current !== 0) {
        // Wait for the bitmap; do not transform the dense live SVG.
        return;
      }
      const g = o.navGroupRef?.current;
      if (!g) return;
      const attr = livePlanNavTransformAttr(screenOf(committed), screenOf(view));
      if (attr) g.setAttribute("transform", attr);
      else g.removeAttribute("transform");
    };

    const cancelRaf = () => {
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      pendingLiveRef.current = null;
    };

    const applyLive = (view: PlanZoom) => {
      pendingLiveRef.current = view;
      gestureLiveRef.current = view;
      if (optsRef.current.liveViewRef) optsRef.current.liveViewRef.current = view;
      if (rafRef.current != null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        const next = pendingLiveRef.current;
        pendingLiveRef.current = null;
        if (next) paintLive(next);
      });
    };

    const flushLive = () => {
      const next = pendingLiveRef.current ?? gestureLiveRef.current;
      cancelRaf();
      if (next) paintLive(next);
    };

    const currentSnapshotKey = (box = hostBox()) => {
      const view = readCommitted();
      const o = optsRef.current;
      if (!view) return "";
      return snapshotViewKey(view, box.width, box.height, o.viewW, o.viewH);
    };

    const activateSnapshot = () => {
      const canvas = optsRef.current.snapshotRef?.current;
      if (!canvas) return false;
      showPlanNavSnapshot(canvas, svg);
      snapshotActiveRef.current = true;
      snapshotWarmReadyRef.current = true;
      snapshotWarmKeyRef.current = currentSnapshotKey();
      return true;
    };

    const startCapture = (forGesture: boolean) => {
      const canvas = optsRef.current.snapshotRef?.current;
      if (!canvas) return;
      const box = hostBox();
      if (!(box.width > 0) || !(box.height > 0)) return;
      const key = currentSnapshotKey(box);
      if (forGesture && snapshotWarmReadyRef.current && snapshotWarmKeyRef.current === key) {
        activateSnapshot();
        const view = readLive();
        if (view) paintLive(view);
        return;
      }
      const token = snapshotPendingRef.current + 1;
      snapshotPendingRef.current = token;
      void captureSvgViewportToCanvas(svg, canvas, box.width, box.height).then((ok) => {
        if (snapshotPendingRef.current !== token) return;
        snapshotPendingRef.current = 0;
        if (!ok) {
          snapshotWarmReadyRef.current = false;
          snapshotWarmKeyRef.current = "";
          if (forGesture && gestureActiveRef.current) {
            const view = readLive();
            if (view) paintLive(view);
          }
          return;
        }
        snapshotWarmReadyRef.current = true;
        snapshotWarmKeyRef.current = key;
        if (forGesture && gestureActiveRef.current) {
          activateSnapshot();
          const view = readLive();
          if (view) paintLive(view);
        }
      });
    };

    const scheduleWarmSnapshot = () => {
      cancelIdleCapture();
      if (gestureActiveRef.current || snapshotActiveRef.current) return;
      const run = () => {
        idleCaptureRef.current = null;
        if (gestureActiveRef.current || snapshotActiveRef.current) return;
        const key = currentSnapshotKey();
        if (snapshotWarmReadyRef.current && snapshotWarmKeyRef.current === key) return;
        startCapture(false);
      };
      if (typeof window.requestIdleCallback === "function") {
        idleCaptureRef.current = window.requestIdleCallback(run, { timeout: 240 });
      } else {
        idleCaptureRef.current = window.setTimeout(run, 50);
      }
    };
    scheduleWarmRef.current = scheduleWarmSnapshot;

    const clearWheelTimer = () => {
      if (wheelTimerRef.current != null) {
        window.clearTimeout(wheelTimerRef.current);
        wheelTimerRef.current = null;
      }
    };

    const commitLive = () => {
      clearWheelTimer();
      flushLive();
      const view = gestureLiveRef.current ?? readLive();
      if (!view) return;
      gestureCommittedRef.current = view;
      gestureLiveRef.current = view;
      if (optsRef.current.liveViewRef) optsRef.current.liveViewRef.current = view;
      if (optsRef.current.committedViewRef) optsRef.current.committedViewRef.current = view;
      gestureActiveRef.current = false;
      const current = optsRef.current.planView;
      optsRef.current.setPlanView(view);
      if (samePlanView(current, view)) {
        endSnapshot();
        scheduleWarmSnapshot();
      }
    };

    const beginGesture = () => {
      if (!gestureCommittedRef.current) {
        const current = readLive();
        if (current) gestureCommittedRef.current = current;
      }
      if (gestureActiveRef.current && (snapshotActiveRef.current || snapshotPendingRef.current !== 0)) {
        return;
      }
      gestureActiveRef.current = true;
      cancelIdleCapture();
      startCapture(true);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const o = optsRef.current;
      const box = hostBox();
      const cursor = clientPointToView(
        e.clientX,
        e.clientY,
        box.left,
        box.top,
        box.width,
        box.height,
        o.viewW,
        o.viewH
      );
      const factor = wheelZoomFactor(e.deltaY);
      beginGesture();
      const base = readLive();
      if (!base) return;
      applyLive(
        zoomPlanToward(base, {
          factor,
          cursorX: cursor.x,
          cursorY: cursor.y,
          viewW: o.viewW,
          viewH: o.viewH,
          fitOx: o.fitOx,
          fitOy: o.fitOy,
          fitScale: o.fitScale,
        })
      );
      clearWheelTimer();
      wheelTimerRef.current = window.setTimeout(commitLive, PLAN_NAV_WHEEL_COMMIT_MS);
    };

    let panning = false;
    let lastX = 0;
    let lastY = 0;
    let pointerId = -1;
    let panBoxW = 0;
    let panBoxH = 0;

    const setPanning = (value: boolean) => {
      panning = value;
      if (optsRef.current.panningRef) optsRef.current.panningRef.current = value;
    };

    const preventMiddleAutoScroll = (e: MouseEvent | PointerEvent) => {
      if (e.button !== PLAN_PAN_BUTTON) return;
      e.preventDefault();
      e.stopPropagation();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== PLAN_PAN_BUTTON) return;
      preventMiddleAutoScroll(e);
      beginGesture();
      setPanning(true);
      lastX = e.clientX;
      lastY = e.clientY;
      const box = hostBox();
      panBoxW = box.width;
      panBoxH = box.height;
      pointerId = e.pointerId;
      host.setPointerCapture(e.pointerId);
      host.style.cursor = "grabbing";
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!panning || e.pointerId !== pointerId) return;
      e.preventDefault();
      const o = optsRef.current;
      const delta = pointerDeltaToView(
        e.clientX - lastX,
        e.clientY - lastY,
        panBoxW,
        panBoxH,
        o.viewW,
        o.viewH
      );
      lastX = e.clientX;
      lastY = e.clientY;
      const base = readLive();
      if (!base) return;
      applyLive(panPlanBy(base, delta.dx, delta.dy));
    };

    const endPan = (e: PointerEvent) => {
      if (!panning || (pointerId !== -1 && e.pointerId !== pointerId)) return;
      setPanning(false);
      pointerId = -1;
      try {
        host.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      host.style.cursor = "";
      commitLive();
    };

    const onLostCapture = () => {
      if (!panning) return;
      setPanning(false);
      pointerId = -1;
      host.style.cursor = "";
      commitLive();
    };

    const onDocMiddleDown = (e: MouseEvent) => {
      if (e.button !== PLAN_PAN_BUTTON) return;
      const target = e.target;
      if (target instanceof Node && host.contains(target)) {
        e.preventDefault();
      }
    };

    host.addEventListener("wheel", onWheel, CAPTURE_NONPASSIVE);
    host.addEventListener("pointerdown", onPointerDown, CAPTURE_NONPASSIVE);
    host.addEventListener("pointermove", onPointerMove, CAPTURE_NONPASSIVE);
    host.addEventListener("pointerup", endPan, CAPTURE);
    host.addEventListener("pointercancel", endPan, CAPTURE);
    host.addEventListener("lostpointercapture", onLostCapture);
    host.addEventListener("auxclick", preventMiddleAutoScroll, CAPTURE_NONPASSIVE);
    host.addEventListener("mousedown", preventMiddleAutoScroll, CAPTURE_NONPASSIVE);
    window.addEventListener("mousedown", onDocMiddleDown, CAPTURE_NONPASSIVE);
    scheduleWarmSnapshot();
    return () => {
      clearWheelTimer();
      cancelRaf();
      cancelIdleCapture();
      snapshotPendingRef.current += 1;
      endSnapshot();
      endSnapshotRef.current = () => {};
      scheduleWarmRef.current = () => {};
      host.style.cursor = "";
      host.removeEventListener("wheel", onWheel, CAPTURE_NONPASSIVE);
      host.removeEventListener("pointerdown", onPointerDown, CAPTURE_NONPASSIVE);
      host.removeEventListener("pointermove", onPointerMove, CAPTURE_NONPASSIVE);
      host.removeEventListener("pointerup", endPan, CAPTURE);
      host.removeEventListener("pointercancel", endPan, CAPTURE);
      host.removeEventListener("lostpointercapture", onLostCapture);
      host.removeEventListener("auxclick", preventMiddleAutoScroll, CAPTURE_NONPASSIVE);
      host.removeEventListener("mousedown", preventMiddleAutoScroll, CAPTURE_NONPASSIVE);
      window.removeEventListener("mousedown", onDocMiddleDown, CAPTURE_NONPASSIVE);
    };
  }, [svgRef]);
}
