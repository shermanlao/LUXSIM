import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { DxfEntity, Vec2 } from "@luxsim/project-io";
import { officialDxfEntitiesToWorld } from "@luxsim/project-io";
import {
  collectDxfSnapCandidates,
  DXF_OBJECT_SNAP_CSS_PX,
  DXF_SNAP_TIE_EPS_M,
  dxfObjectSnapRadiusM,
  officialDxfSnapEntities,
  pickDxfObjectSnap,
  pickDxfSnapCandidate,
} from "./official-dxf-object-snap";

const L_POLY: DxfEntity = {
  type: "polyline",
  points: [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 3 },
  ],
};

const LINE: DxfEntity = {
  type: "line",
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ],
};

function kindsAt(entities: DxfEntity[], pointer: Vec2) {
  return collectDxfSnapCandidates(entities, pointer).map((c) => c.kind);
}

describe("dxfObjectSnapRadiusM", () => {
  it("converts 8 CSS pixels to world metres at the current zoom", () => {
    expect(DXF_OBJECT_SNAP_CSS_PX).toBe(8);
    expect(dxfObjectSnapRadiusM(0.01)).toBeCloseTo(0.08);
    expect(dxfObjectSnapRadiusM(0.1)).toBeCloseTo(0.8);
  });

  it("treats a zoomed-in radius as smaller in world units than a zoomed-out one", () => {
    const zoomedIn = dxfObjectSnapRadiusM(0.01);
    const zoomedOut = dxfObjectSnapRadiusM(0.1);
    expect(zoomedIn).toBeLessThan(zoomedOut);
    // 0.2 m off the (0,0) endpoint, not on the segment, so nearest coincides with that end.
    const pointer: Vec2 = { x: 0, y: 0.2 };
    const hitOut = pickDxfObjectSnap(pointer, [LINE], zoomedOut);
    const hitIn = pickDxfObjectSnap(pointer, [LINE], zoomedIn);
    expect(hitOut?.kind).toBe("endpoint");
    expect(hitOut?.point).toEqual({ x: 0, y: 0 });
    expect(hitIn).toBeNull();
  });

  it("returns 0 for non-finite or non-positive metres-per-pixel", () => {
    expect(dxfObjectSnapRadiusM(0)).toBe(0);
    expect(dxfObjectSnapRadiusM(-0.02)).toBe(0);
    expect(dxfObjectSnapRadiusM(Number.NaN)).toBe(0);
    expect(dxfObjectSnapRadiusM(Number.POSITIVE_INFINITY)).toBe(0);
    expect(pickDxfObjectSnap({ x: 0, y: 0 }, [LINE], 0)).toBeNull();
  });
});

describe("collectDxfSnapCandidates", () => {
  it("emits endpoints, midpoints, and nearest-on-segment for an L-shaped polyline", () => {
    const pointer: Vec2 = { x: 4.05, y: 0.1 };
    const candidates = collectDxfSnapCandidates([L_POLY], pointer);
    const endpoints = candidates.filter((c) => c.kind === "endpoint").map((c) => c.point);
    const midpoints = candidates.filter((c) => c.kind === "midpoint").map((c) => c.point);
    const nearest = candidates.filter((c) => c.kind === "nearest").map((c) => c.point);

    expect(endpoints).toEqual(
      expect.arrayContaining([
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 3 },
      ])
    );
    expect(midpoints).toEqual(
      expect.arrayContaining([
        { x: 2, y: 0 },
        { x: 4, y: 1.5 },
      ])
    );
    expect(midpoints).toHaveLength(2);
    expect(nearest).toHaveLength(2);
    const nearCorner = nearest.find((p) => Math.abs(p.y) < 0.05);
    const nearVertical = nearest.find((p) => Math.abs(p.y - 0.1) < 1e-9 || Math.abs(p.y - 0.1) < 1e-8);
    expect(nearCorner?.x).toBeCloseTo(4);
    expect(nearCorner?.y).toBeCloseTo(0);
    expect(nearVertical?.x).toBeCloseTo(4);
    expect(nearVertical?.y).toBeCloseTo(0.1);
    expect(kindsAt([L_POLY], pointer).filter((k) => k === "endpoint").length).toBe(4);
    expect(kindsAt([L_POLY], pointer).filter((k) => k === "midpoint").length).toBe(2);
    expect(kindsAt([L_POLY], pointer).filter((k) => k === "nearest").length).toBe(2);
  });

  it("does not invent a closing segment that the open polyline display path does not draw", () => {
    const pointer: Vec2 = { x: 0, y: 3 };
    const candidates = collectDxfSnapCandidates([L_POLY], pointer);
    const mids = candidates.filter((c) => c.kind === "midpoint").map((c) => c.point);
    expect(mids).not.toEqual(expect.arrayContaining([{ x: 0, y: 1.5 }]));
    const hit = pickDxfObjectSnap(pointer, [L_POLY], 0.2);
    expect(hit).toBeNull();
  });

  it("includes the official closing segment on a closed polyline", () => {
    const closed: DxfEntity = {
      type: "polyline",
      closed: true,
      points: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 3 },
        { x: 0, y: 3 },
      ],
    };
    const pointer: Vec2 = { x: 0, y: 1.5 };
    const candidates = collectDxfSnapCandidates([closed], pointer);
    const mids = candidates.filter((c) => c.kind === "midpoint").map((c) => c.point);
    expect(mids).toEqual(expect.arrayContaining([{ x: 0, y: 1.5 }]));
    const hit = pickDxfObjectSnap(pointer, [closed], 0.2);
    expect(hit?.kind).toBe("midpoint");
    expect(hit?.point).toEqual({ x: 0, y: 1.5 });
    expect(kindsAt([closed], pointer).filter((k) => k === "midpoint")).toHaveLength(4);
  });
});

describe("pickDxfObjectSnap priority and empty input", () => {
  it("returns null when there are no entities", () => {
    expect(pickDxfObjectSnap({ x: 0, y: 0 }, [], 1)).toBeNull();
    expect(collectDxfSnapCandidates([], { x: 0, y: 0 })).toEqual([]);
  });

  it("prefers the closest candidate inside the radius", () => {
    const pointer: Vec2 = { x: 4.05, y: 0.1 };
    const hit = pickDxfObjectSnap(pointer, [L_POLY], 1);
    expect(hit?.kind).toBe("nearest");
    expect(hit?.point.x).toBeCloseTo(4);
    expect(hit?.point.y).toBeCloseTo(0.1);
    expect(hit!.distanceM).toBeCloseTo(0.05);
  });

  it("tie-breaks endpoint, then midpoint, then nearest at the same distance", () => {
    const atEnd = pickDxfObjectSnap({ x: 0, y: 0 }, [LINE], 1);
    expect(atEnd?.kind).toBe("endpoint");
    expect(atEnd?.point).toEqual({ x: 0, y: 0 });
    expect(atEnd!.distanceM).toBeLessThanOrEqual(DXF_SNAP_TIE_EPS_M);

    const atMid = pickDxfObjectSnap({ x: 5, y: 0 }, [LINE], 1);
    expect(atMid?.kind).toBe("midpoint");
    expect(atMid?.point).toEqual({ x: 5, y: 0 });

    const samePoint: Vec2 = { x: 0, y: 0 };
    const tied = pickDxfSnapCandidate(
      samePoint,
      [
        { kind: "nearest", point: { x: 0, y: 0 } },
        { kind: "midpoint", point: { x: 0, y: 0 } },
        { kind: "endpoint", point: { x: 0, y: 0 } },
      ],
      1
    );
    expect(tied?.kind).toBe("endpoint");
  });

  it("does not snap outside the radius even when a farther endpoint exists", () => {
    // 1 m off the segment; radius 0.5 m cannot reach the line or either end.
    expect(pickDxfObjectSnap({ x: 1, y: 1 }, [LINE], 0.5)).toBeNull();
  });
});

describe("officialDxfSnapEntities", () => {
  it("is inactive without a parsed DXF underlay or when entities are empty", () => {
    expect(officialDxfSnapEntities(null, [LINE])).toEqual([]);
    expect(officialDxfSnapEntities({ kind: "image", dxfEntities: [LINE] })).toEqual([]);
    expect(officialDxfSnapEntities({ kind: "pdf", dxfEntities: [LINE] })).toEqual([]);
    expect(officialDxfSnapEntities({ kind: "dwg", dxfEntities: [LINE] })).toEqual([]);
    expect(officialDxfSnapEntities({ kind: "dxf", dxfEntities: [] })).toEqual([]);
    expect(officialDxfSnapEntities({ kind: "dxf" })).toEqual([]);
    expect(officialDxfSnapEntities({ kind: "dxf", dxfEntities: [L_POLY] })).toEqual([L_POLY]);
    expect(officialDxfSnapEntities({ kind: "dxf" }, [LINE])).toEqual([LINE]);
  });
});

describe("official DXF snap follows entity→world scale", () => {
  it("hits the same raw endpoints when metersPerUnit is 1", () => {
    const raw = [LINE];
    const world = officialDxfEntitiesToWorld(raw, { metersPerUnit: 1, offsetX: 0, offsetY: 0 });
    expect(world).toBe(raw);
    const hit = pickDxfObjectSnap({ x: 0, y: 0.05 }, world, 0.2);
    expect(hit?.kind).toBe("endpoint");
    expect(hit?.point).toEqual({ x: 0, y: 0 });
  });

  it("hits scaled endpoints when metersPerUnit is 2 or 0.001", () => {
    const twice = officialDxfEntitiesToWorld([LINE], { metersPerUnit: 2 });
    expect(twice[0]?.points).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
    ]);
    const mid = pickDxfObjectSnap({ x: 10, y: 0.05 }, twice, 0.2);
    expect(mid?.kind).toBe("midpoint");
    expect(mid?.point).toEqual({ x: 10, y: 0 });
    const end = pickDxfObjectSnap({ x: 20.04, y: 0 }, twice, 0.1);
    expect(end?.kind).toBe("endpoint");
    expect(end?.point).toEqual({ x: 20, y: 0 });
    // The unscaled endpoint at x=10 is no longer a candidate after mpu 2.
    expect(pickDxfObjectSnap({ x: 10, y: 0 }, [LINE], 0.2)?.point).toEqual({ x: 10, y: 0 });
    expect(pickDxfObjectSnap({ x: 10, y: 0 }, twice, 0.2)?.kind).toBe("midpoint");

    const mm = officialDxfEntitiesToWorld(
      [{ type: "line", points: [{ x: 0, y: 0 }, { x: 10000, y: 0 }] }],
      { metersPerUnit: 0.001 }
    );
    const mmHit = pickDxfObjectSnap({ x: 10.02, y: 0 }, mm, 0.05);
    expect(mmHit?.kind).toBe("endpoint");
    expect(mmHit?.point.x).toBeCloseTo(10);
    expect(mmHit?.point.y).toBeCloseTo(0);
    // 8 CSS px still convert to world metres; only the candidate points scale.
    expect(DXF_OBJECT_SNAP_CSS_PX).toBe(8);
    expect(dxfObjectSnapRadiusM(0.01)).toBeCloseTo(0.08);
  });
});

describe("official DXF object-snap wiring", () => {
  it("snaps official plan picks through pickDxfObjectSnap and does not start drags from the marker", () => {
    const top = readFileSync(
      path.join(process.cwd(), "src/components/editor/TopView2D.tsx"),
      "utf8"
    );
    expect(top).toContain('from "@/lib/official-dxf-object-snap"');
    expect(top).toContain("officialDxfEntitiesToWorld");
    expect(top).toContain("officialDxfSnapEntities");
    expect(top).toContain("pickDxfObjectSnap");
    expect(top).toContain("officialDxfEntitiesToWorld(dxfEntities, underlay)");
    expect(top).toContain("officialDxfSnapEntities(underlay, dxfWorldEntities)");
    expect(top).toContain("dxfWorldEntities.map");
    const underlay3d = readFileSync(
      path.join(process.cwd(), "src/components/editor/PlanUnderlay3D.tsx"),
      "utf8"
    );
    expect(underlay3d).toContain("officialDxfEntitiesToWorld");
    expect(underlay3d).toContain("officialDxfEntitiesToWorld(dxfEntities, underlay)");
    expect(top).toContain("dxfObjectSnapRadiusM");
    expect(top).toContain("worldMetresPerCssPixel");
    expect(top).toContain("data-dxf-snap");
    expect(top).toContain('pointerEvents="none"');
    expect(top).toMatch(/function snappedWorldAt/);
    expect(top).toContain("beginRoomDrag(room.id, toWorld(e.clientX, e.clientY))");
    expect(top).toContain("beginMove(inst.instanceId, e.clientX, e.clientY, inst.position)");
    expect(top).not.toMatch(/beginRoomDrag\(room\.id,\s*snappedWorldAt/);
    expect(top).not.toMatch(/beginStoreyDrag\([^)]*snappedWorldAt/);
    expect(top).not.toMatch(/beginMove\([^)]*snappedWorldAt/);
    expect(top).toContain("onDropLuminaire(luminaireId, snapped.x, snapped.y)");
    expect(top).toContain("if (drawing || linePickActive || circlePickActive) return;");
    expect(top).toContain("wheelZoomFactor");
    expect(top).not.toContain("click-drag pan");
    expect(top).not.toMatch(/auto-?room/i);
    expect(top).not.toMatch(/intersection snap/i);
  });
});
