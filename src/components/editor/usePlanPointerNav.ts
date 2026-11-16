"use client";

import { useEffect, useLayoutEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import { clientToSvgPoint } from "./svg-coords";
import {
  PLAN_PAN_BUTTON,
  livePlanNavTransformAttr,
  panPlanBy,
  planViewTransform,
  pointerDeltaToView,
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

/**
 * Official view navigation: wheel zooms toward the cursor, and holding the
 * middle (scroll-wheel) button pans. Left-click is not used to pan.
 * Pan and zoom update an SVG transform immediately and only commit React
 * state when the gesture finishes, so a dense plan does not redraw every move.
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

    const readCommitted = (): PlanZoom | null =>
      gestureCommittedRef.current ?? optsRef.current.committedViewRef?.current ?? null;

    const readLive = (): PlanZoom | null =>
      gestureLiveRef.current ?? optsRef.current.liveViewRef?.current ?? readCommitted();

    const applyLive = (view: PlanZoom) => {
      gestureLiveRef.current = view;
      if (optsRef.current.liveViewRef) optsRef.current.liveViewRef.current = view;
      const g = optsRef.current.navGroupRef?.current;
      const committed = readCommitted();
      if (!g || !committed) return;
      g.setAttribute("transform", livePlanNavTransformAttr(screenOf(committed), screenOf(view)));
    };

    const clearWheelTimer = () => {
      if (wheelTimerRef.current != null) {
        window.clearTimeout(wheelTimerRef.current);
        wheelTimerRef.current = null;
      }
    };

    const commitLive = () => {
      clearWheelTimer();
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
      const { x, y } = clientToSvgPoint(el, e.clientX, e.clientY);
      const o = optsRef.current;
      const factor = wheelZoomFactor(e.deltaY);
      beginGesture();
      const base = readLive();
      if (!base) return;
      applyLive(
        zoomPlanToward(base, {
          factor,
          cursorX: x,
          cursorY: y,
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

    const setPanning = (value: boolean) => {
      panning = value;
      if (optsRef.current.panningRef) optsRef.current.panningRef.current = value;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== PLAN_PAN_BUTTON) return;
      e.preventDefault();
      e.stopPropagation();
      beginGesture();
      setPanning(true);
      lastX = e.clientX;
      lastY = e.clientY;
      pointerId = e.pointerId;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = "grabbing";
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!panning || e.pointerId !== pointerId) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const o = optsRef.current;
      const delta = pointerDeltaToView(
        e.clientX - lastX,
        e.clientY - lastY,
        rect.width,
        rect.height,
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

    const onAuxClick = (e: MouseEvent) => {
      if (e.button !== PLAN_PAN_BUTTON) return;
      e.preventDefault();
      e.stopPropagation();
    };

    const onLostCapture = () => {
      if (!panning) return;
      setPanning(false);
      pointerId = -1;
      el.style.cursor = "";
      commitLive();
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", endPan);
    el.addEventListener("pointercancel", endPan);
    el.addEventListener("lostpointercapture", onLostCapture);
    el.addEventListener("auxclick", onAuxClick);
    return () => {
      clearWheelTimer();
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endPan);
      el.removeEventListener("pointercancel", endPan);
      el.removeEventListener("lostpointercapture", onLostCapture);
      el.removeEventListener("auxclick", onAuxClick);
    };
  }, [svgRef]);
}
