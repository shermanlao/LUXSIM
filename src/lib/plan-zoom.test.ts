import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { rectPolygon } from "@luxsim/project-io";
import {
  officialPlanFitTransform,
  officialPlanWorldBounds,
} from "./official-plan-world-bounds";
import {
  DEFAULT_PLAN_ZOOM,
  PLAN_PAN_BUTTON,
  PLAN_ZOOM_MAX,
  PLAN_ZOOM_MIN,
  centeredFitOrigin,
  clampPlanZoom,
  panPlanBy,
  planViewTransform,
  pointerDeltaToView,
  wheelZoomFactor,
  zoomPlanToward,
} from "./plan-zoom";

function topViewSrc() {
  return readFileSync(
    path.join(process.cwd(), "src/components/editor/TopView2D.tsx"),
    "utf8"
  );
}

describe("plan zoom", () => {
  const viewW = 640;
  const viewH = 480;
  const fitScale = 40;
  const fit = centeredFitOrigin(viewW, viewH, 7, 6, fitScale);
  const box = { viewW, viewH, fitOx: fit.ox, fitOy: fit.oy, fitScale };

  it("clamps zoom to 0.25–16 and treats a zero wheel as no change", () => {
    expect(PLAN_ZOOM_MIN).toBe(0.25);
    expect(PLAN_ZOOM_MAX).toBe(16);
    expect(clampPlanZoom(0.01)).toBe(0.25);
    expect(clampPlanZoom(99)).toBe(16);
    expect(clampPlanZoom(Number.NaN)).toBe(1);
    expect(clampPlanZoom(Number.POSITIVE_INFINITY)).toBe(1);
    expect(wheelZoomFactor(0)).toBe(1);
    expect(wheelZoomFactor(Number.NaN)).toBe(1);
    expect(wheelZoomFactor(-100)).toBeGreaterThan(1);
    expect(wheelZoomFactor(100)).toBeLessThan(1);
  });

  it("keeps the default view as a centred fit", () => {
    expect(DEFAULT_PLAN_ZOOM).toEqual({ zoom: 1, panX: 0, panY: 0 });
    const t = planViewTransform(fit.ox, fit.oy, fitScale, viewW, viewH, DEFAULT_PLAN_ZOOM);
    expect(t.scale).toBe(40);
    expect(t.ox).toBeCloseTo((640 - 7 * 40) / 2);
    expect(t.oy).toBeCloseTo((480 - 6 * 40) / 2);
  });

  it("matches the official auto-fit when zoom is 1 and pan is 0", () => {
    const world = officialPlanWorldBounds({ rooms: [{ polygon: rectPolygon(0, 0, 5, 4) }] });
    const official = officialPlanFitTransform(world, viewW, viewH);
    const layered = planViewTransform(
      official.ox,
      official.oy,
      official.scale,
      viewW,
      viewH,
      DEFAULT_PLAN_ZOOM
    );
    expect(layered).toEqual(official);
  });

  it("does not change the view when the wheel factor is 1", () => {
    const view = { zoom: 2, panX: 12, panY: -8 };
    const next = zoomPlanToward(view, { factor: 1, cursorX: 200, cursorY: 150, ...box });
    expect(next).toBe(view);
    expect(next).toEqual({ zoom: 2, panX: 12, panY: -8 });
  });

  it("keeps the cursor world point stable when zooming by a known factor", () => {
    const cursorX = 200;
    const cursorY = 150;
    const before = planViewTransform(fit.ox, fit.oy, fitScale, viewW, viewH, DEFAULT_PLAN_ZOOM);
    const worldX = (cursorX - before.ox) / before.scale;
    const worldY = (cursorY - before.oy) / before.scale;
    const next = zoomPlanToward(DEFAULT_PLAN_ZOOM, { factor: 2, cursorX, cursorY, ...box });
    const after = planViewTransform(fit.ox, fit.oy, fitScale, viewW, viewH, next);
    expect(next.zoom).toBe(2);
    expect((cursorX - after.ox) / after.scale).toBeCloseTo(worldX);
    expect((cursorY - after.oy) / after.scale).toBeCloseTo(worldY);
  });

  it("keeps the cursor world point stable when zooming out, and clamps past 16 or 0.25", () => {
    const cursorX = 400;
    const cursorY = 300;
    const zoomed = zoomPlanToward(DEFAULT_PLAN_ZOOM, { factor: 0.5, cursorX, cursorY, ...box });
    const before = planViewTransform(fit.ox, fit.oy, fitScale, viewW, viewH, zoomed);
    const worldX = (cursorX - before.ox) / before.scale;
    const worldY = (cursorY - before.oy) / before.scale;
    expect(zoomed.zoom).toBe(0.5);
    const afterView = zoomPlanToward(zoomed, { factor: 0.5, cursorX, cursorY, ...box });
    const after = planViewTransform(fit.ox, fit.oy, fitScale, viewW, viewH, afterView);
    expect(afterView.zoom).toBe(0.25);
    expect((cursorX - after.ox) / after.scale).toBeCloseTo(worldX);
    expect((cursorY - after.oy) / after.scale).toBeCloseTo(worldY);

    const atMax = zoomPlanToward(DEFAULT_PLAN_ZOOM, { factor: 32, cursorX, cursorY, ...box });
    expect(atMax.zoom).toBe(16);
    expect(zoomPlanToward(atMax, { factor: 2, cursorX, cursorY, ...box })).toBe(atMax);
    const atMin = { zoom: 0.25, panX: 0, panY: 0 };
    expect(zoomPlanToward(atMin, { factor: 0.5, cursorX, cursorY, ...box })).toBe(atMin);
  });
});

describe("plan pan", () => {
  it("adds a finite pan delta and leaves a zero or non-finite delta unchanged", () => {
    const view = { zoom: 2, panX: 4, panY: -3 };
    expect(PLAN_PAN_BUTTON).toBe(1);
    expect(panPlanBy(view, 10, -5)).toEqual({ zoom: 2, panX: 14, panY: -8 });
    expect(panPlanBy(view, 0, 0)).toBe(view);
    expect(panPlanBy(view, Number.NaN, 1)).toBe(view);
    expect(panPlanBy(view, 1, Number.POSITIVE_INFINITY)).toBe(view);
  });

  it("converts CSS pointer deltas into viewBox units", () => {
    expect(pointerDeltaToView(20, -10, 200, 100, 640, 480)).toEqual({ dx: 64, dy: -48 });
    expect(pointerDeltaToView(10, 10, 0, 100, 640, 480)).toEqual({ dx: 0, dy: 0 });
    expect(pointerDeltaToView(Number.NaN, 8, 200, 100, 640, 480)).toEqual({ dx: 0, dy: 0 });
  });
});

describe("TopView2D wheel-zoom wiring", () => {
  it("applies cursor-stable wheel zoom on the official fit and does not put draft in the auto-fit deps", () => {
    const src = topViewSrc();
    expect(src).toContain('from "@/lib/plan-zoom"');
    expect(src).toContain("DEFAULT_PLAN_ZOOM");
    expect(src).toContain("planViewTransform");
    expect(src).toContain("usePlanPointerNav");
    expect(src).toContain("useViewElementSize");
    expect(src).toContain("PLAN_PAN_BUTTON");
    expect(src).toContain("panningRef");
    expect(src).toContain("officialPlanWorldBounds");
    expect(src).toContain("officialPlanFitTransform");
    expect(src).toMatch(
      /officialPlanWorldBounds\(\{\s*rooms,\s*dxfEntities,\s*underlay,\s*underlaySize\s*\}\)/
    );
    expect(src).toMatch(
      /\[rooms,\s*dxfEntities,\s*underlay,\s*underlaySize\]/
    );
    expect(src).not.toMatch(/for \(const p of draft\)/);
    expect(src).not.toMatch(/underlaySize,\s*draft/);
    const navSrc = readFileSync(
      path.join(process.cwd(), "src/components/editor/usePlanPointerNav.ts"),
      "utf8"
    );
    expect(navSrc).toContain("wheelZoomFactor");
    expect(navSrc).toContain("zoomPlanToward");
    expect(navSrc).toContain("panPlanBy");
    expect(navSrc).toContain("pointerDeltaToView");
    expect(navSrc).toContain("PLAN_PAN_BUTTON");
    expect(navSrc).toContain("e.preventDefault()");
    expect(navSrc).toContain("e.stopPropagation()");
    expect(navSrc).toContain('addEventListener("wheel"');
    expect(navSrc).toContain("passive: false");
    expect(navSrc).toContain("setPointerCapture");
    expect(navSrc).not.toMatch(/e\.button\s*===\s*0/);
    expect(src).toMatch(/e\.button === PLAN_PAN_BUTTON \|\| e\.button !== 0 \|\| panningRef\.current/);
    expect(src).toContain('data-plan-bg="true"');
    expect(src).toContain('closest("[data-plan-bg]")');
    expect(src).toContain("double-click empty area to reset");
    expect(src).toContain("setPlanView(DEFAULT_PLAN_ZOOM)");
    expect(src).toMatch(/if \(drawing \|\| linePickActive \|\| circlePickActive\) return/);
  });
});
