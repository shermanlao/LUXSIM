"use client";

import { useEffect, useLayoutEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import {
  PLAN_PAN_BUTTON,
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
  /** Untransformed view host; used for pointer-to-view mapping. */
  hostRef: RefObject<HTMLElement | null>;
  /** Set true while a middle-button pan is in progress so left-click tools stay idle. */
  panningRef?: RefObject<boolean>;
  /** World-space (or already-projected) plan content that should follow live pan/zoom. */
  navGroupRef?: RefObject<SVGGElement | null>;
  /** Latest view, including an in-progress pan or zoom. Event handlers should read this. */
  liveViewRef?: RefObject<PlanZoom>;
  /** View last committed to React state (the coordinates currently drawn). */
  committedViewRef?: RefObject<PlanZoom>;
  /** React-committed view; used to clear the live SVG transform after a redraw. */
  planView: PlanZoom;
};

/** Wait this long after the last wheel event before rebuilding plan coordinates. */
export const PLAN_NAV_WHEEL_COMMIT_MS = 80;

const CAPTURE_NONPASSIVE = { capture: true, passive: false } as const;
const CAPTURE = { capture: true } as const;

/**
 * Official view navigation: wheel zooms toward the cursor, and holding the
 * middle (scroll-wheel) button pans. Left-click is not used to pan.
 * Pan and zoom update an SVG group transform immediately (once per frame)
 * and only commit React state when the gesture finishes, so a dense plan
 * does not rebuild on every move. A CSS compositing layer is not used,
 * because promoting the whole CAD + false-colour SVG to a GPU texture
 * made the editor lag.
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

  useLayoutEffect(() => {
    const view = opts.planView;
    if (opts.liveViewRef) opts.liveViewRef.current = view;
    if (opts.committedViewRef) opts.committedViewRef.current = view;
    gestureCommittedRef.current = view;
    gestureLiveRef.current = view;
    opts.navGroupRef?.current?.removeAttribute("transform");
  }, [opts.planView, opts.liveViewRef, opts.committedViewRef, opts.navGroupRef]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;

    const screenOf = (view: PlanZoom) => {
      const o = optsRef.current;
      return planViewTransform(o.fitOx, o.fitOy, o.fitScale, o.viewW, o.viewH, view);
    };

    const hostBox = () => {
      const host = optsRef.current.hostRef.current;
      const rect = (host ?? el).getBoundingClientRect();
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    };

    const readCommitted = (): PlanZoom | null =>
      gestureCommittedRef.current ?? optsRef.current.committedViewRef?.current ?? null;

    const readLive = (): PlanZoom | null =>
      gestureLiveRef.current ?? optsRef.current.liveViewRef?.current ?? readCommitted();

    const paintLive = (view: PlanZoom) => {
      gestureLiveRef.current = view;
      if (optsRef.current.liveViewRef) optsRef.current.liveViewRef.current = view;
      const g = optsRef.current.navGroupRef?.current;
      const committed = readCommitted();
      if (!g || !committed) return;
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
      optsRef.current.setPlanView(view);
    };

    const beginGesture = () => {
      if (!gestureCommittedRef.current) {
        const current = readLive();
        if (current) gestureCommittedRef.current = current;
      }
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
      el.setPointerCapture(e.pointerId);
      el.style.cursor = "grabbing";
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
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      el.style.cursor = "";
      commitLive();
    };

    const onLostCapture = () => {
      if (!panning) return;
      setPanning(false);
      pointerId = -1;
      el.style.cursor = "";
      commitLive();
    };

    const onDocMiddleDown = (e: MouseEvent) => {
      if (e.button !== PLAN_PAN_BUTTON) return;
      const host = optsRef.current.hostRef.current ?? el;
      const target = e.target;
      if (target instanceof Node && host.contains(target)) {
        e.preventDefault();
      }
    };

    el.addEventListener("wheel", onWheel, CAPTURE_NONPASSIVE);
    el.addEventListener("pointerdown", onPointerDown, CAPTURE_NONPASSIVE);
    el.addEventListener("pointermove", onPointerMove, CAPTURE_NONPASSIVE);
    el.addEventListener("pointerup", endPan, CAPTURE);
    el.addEventListener("pointercancel", endPan, CAPTURE);
    el.addEventListener("lostpointercapture", onLostCapture);
    el.addEventListener("auxclick", preventMiddleAutoScroll, CAPTURE_NONPASSIVE);
    el.addEventListener("mousedown", preventMiddleAutoScroll, CAPTURE_NONPASSIVE);
    window.addEventListener("mousedown", onDocMiddleDown, CAPTURE_NONPASSIVE);
    return () => {
      clearWheelTimer();
      cancelRaf();
      el.removeEventListener("wheel", onWheel, CAPTURE_NONPASSIVE);
      el.removeEventListener("pointerdown", onPointerDown, CAPTURE_NONPASSIVE);
      el.removeEventListener("pointermove", onPointerMove, CAPTURE_NONPASSIVE);
      el.removeEventListener("pointerup", endPan, CAPTURE);
      el.removeEventListener("pointercancel", endPan, CAPTURE);
      el.removeEventListener("lostpointercapture", onLostCapture);
      el.removeEventListener("auxclick", preventMiddleAutoScroll, CAPTURE_NONPASSIVE);
      el.removeEventListener("mousedown", preventMiddleAutoScroll, CAPTURE_NONPASSIVE);
      window.removeEventListener("mousedown", onDocMiddleDown, CAPTURE_NONPASSIVE);
    };
  }, [svgRef]);
}
