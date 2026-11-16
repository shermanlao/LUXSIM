"use client";

import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import { clientToSvgPoint } from "./svg-coords";
import {
  PLAN_PAN_BUTTON,
  panPlanBy,
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
};

/**
 * Official view navigation: wheel zooms toward the cursor, and holding the
 * middle (scroll-wheel) button pans. Left-click is not used to pan.
 */
export function usePlanPointerNav(
  svgRef: RefObject<SVGSVGElement | null>,
  opts: PlanPointerNavOpts
) {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const { x, y } = clientToSvgPoint(el, e.clientX, e.clientY);
      const o = optsRef.current;
      const factor = wheelZoomFactor(e.deltaY);
      o.setPlanView((view) =>
        zoomPlanToward(view, {
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
      o.setPlanView((view) => panPlanBy(view, delta.dx, delta.dy));
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
    };

    const onAuxClick = (e: MouseEvent) => {
      if (e.button !== PLAN_PAN_BUTTON) return;
      e.preventDefault();
      e.stopPropagation();
    };

    const onLostCapture = () => {
      setPanning(false);
      pointerId = -1;
      el.style.cursor = "";
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", endPan);
    el.addEventListener("pointercancel", endPan);
    el.addEventListener("lostpointercapture", onLostCapture);
    el.addEventListener("auxclick", onAuxClick);
    return () => {
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
