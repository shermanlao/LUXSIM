import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { DxfEntity, Vec2 } from "@luxsim/project-io";
import {
  officialDxfEntitiesToWorld,
  parseDxfEntities,
  dxfBounds,
  DXF_CURVE_SEGMENTS_PER_TURN,
} from "@luxsim/project-io";
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
    expect(top).toContain("DxfSnapMarkerLayer");
    expect(top).toContain("snapMarkerRef");
    expect(top).toContain('pointerEvents="none"');
    const snapMarker = readFileSync(
      path.join(process.cwd(), "src/components/editor/DxfSnapMarkerLayer.tsx"),
      "utf8"
    );
    expect(snapMarker).toContain("data-dxf-snap");
    expect(snapMarker).toContain('pointerEvents="none"');
    expect(top).toMatch(/function snappedWorldAt/);
    expect(top).toContain("beginRoomDrag(room.id, toWorld(e.clientX, e.clientY))");
    expect(top).toContain("beginMove(inst.instanceId, e.clientX, e.clientY, inst.position)");
    expect(top).not.toMatch(/beginRoomDrag\(room\.id,\s*snappedWorldAt/);
    expect(top).not.toMatch(/beginStoreyDrag\([^)]*snappedWorldAt/);
    expect(top).not.toMatch(/beginMove\([^)]*snappedWorldAt/);
    expect(top).toContain("onDropLuminaire(luminaireId, snapped.x, snapped.y)");
    expect(top).toContain("if (drawing || linePickActive || circlePickActive) return;");
    expect(top).toContain("usePlanPointerNav");
    expect(top).not.toContain("click-drag pan");
    expect(top).not.toMatch(/auto-?room/i);
    expect(top).not.toMatch(/intersection snap/i);
  });
});

describe("object snap and bounds on tessellated CIRCLE, ARC, ELLIPSE, SPLINE, and POLYLINE bulges", () => {
  it("snaps to tessellated CIRCLE and ARC segments and includes them in bounds", () => {
    const circle = parseDxfEntities(
      "  0\nSECTION\n  2\nENTITIES\n  0\nCIRCLE\n  10\n0\n  20\n0\n  40\n2\n  0\nENDSEC\n  0\nEOF\n"
    );
    expect(circle[0]?.points).toHaveLength(DXF_CURVE_SEGMENTS_PER_TURN);
    const bounds = dxfBounds(circle)!;
    expect(bounds.minX).toBeCloseTo(-2);
    expect(bounds.maxX).toBeCloseTo(2);
    expect(bounds.minY).toBeCloseTo(-2);
    expect(bounds.maxY).toBeCloseTo(2);

    const end = pickDxfObjectSnap({ x: 2.02, y: 0 }, circle, 0.1);
    expect(end?.kind).toBe("endpoint");
    expect(end?.point.x).toBeCloseTo(2);
    expect(end?.point.y).toBeCloseTo(0);

    const first = circle[0]!.points[0]!;
    const second = circle[0]!.points[1]!;
    const midPt = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
    const mid = pickDxfObjectSnap(midPt, circle, 0.05);
    expect(mid?.kind).toBe("midpoint");
    expect(mid?.point.x).toBeCloseTo(midPt.x);
    expect(mid?.point.y).toBeCloseTo(midPt.y);

    const off = {
      x: midPt.x,
      y: midPt.y + 0.02,
    };
    const nearest = pickDxfObjectSnap(off, circle, 0.08);
    expect(nearest?.kind).toBe("nearest");

    const arc = parseDxfEntities(
      "  0\nSECTION\n  2\nENTITIES\n  0\nARC\n  10\n0\n  20\n0\n  40\n2\n  50\n0\n  51\n90\n  0\nENDSEC\n  0\nEOF\n"
    );
    // Open ARC must not invent a closing chord from (0,2) back to (2,0).
    const invented = pickDxfObjectSnap({ x: 1, y: 1 }, arc, 0.2);
    expect(invented).toBeNull();
    const arcEnd = pickDxfObjectSnap({ x: 0, y: 2.02 }, arc, 0.1);
    expect(arcEnd?.kind).toBe("endpoint");
    expect(arcEnd?.point.x).toBeCloseTo(0);
    expect(arcEnd?.point.y).toBeCloseTo(2);
    const arcBounds = dxfBounds(arc)!;
    expect(arcBounds.minX).toBeCloseTo(0);
    expect(arcBounds.maxX).toBeCloseTo(2);
    expect(arcBounds.minY).toBeCloseTo(0);
    expect(arcBounds.maxY).toBeCloseTo(2);
  });

  it("snaps to a tessellated old POLYLINE bulge and includes it in bounds", () => {
    const entities = parseDxfEntities(
      "  0\nSECTION\n  2\nENTITIES\n  0\nPOLYLINE\n  70\n0\n" +
        "  0\nVERTEX\n  10\n1\n  20\n0\n  42\n1\n" +
        "  0\nVERTEX\n  10\n-1\n  20\n0\n" +
        "  0\nSEQEND\n  0\nENDSEC\n  0\nEOF\n"
    );
    const apex = pickDxfObjectSnap({ x: 0, y: 1.02 }, entities, 0.1);
    expect(apex?.kind).toBe("endpoint");
    expect(apex?.point.x).toBeCloseTo(0);
    expect(apex?.point.y).toBeCloseTo(1);
    const bounds = dxfBounds(entities)!;
    expect(bounds.minX).toBeCloseTo(-1);
    expect(bounds.maxX).toBeCloseTo(1);
    expect(bounds.maxY).toBeCloseTo(1);
    expect(bounds.minY).toBeCloseTo(0);
  });

  it("snaps to a tessellated LWPOLYLINE bulge and includes it in bounds", () => {
    const entities = parseDxfEntities(
      "  0\nSECTION\n  2\nENTITIES\n  0\nLWPOLYLINE\n  70\n0\n  90\n2\n" +
        "  10\n1\n  20\n0\n  42\n1\n" +
        "  10\n-1\n  20\n0\n" +
        "  0\nENDSEC\n  0\nEOF\n"
    );
    const apex = pickDxfObjectSnap({ x: 0, y: 1.02 }, entities, 0.1);
    expect(apex?.kind).toBe("endpoint");
    expect(apex?.point.x).toBeCloseTo(0);
    expect(apex?.point.y).toBeCloseTo(1);
    const first = entities[0]!.points[0]!;
    const second = entities[0]!.points[1]!;
    const midPt = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
    const mid = pickDxfObjectSnap(midPt, entities, 0.05);
    expect(mid?.kind).toBe("midpoint");
    expect(mid?.point.x).toBeCloseTo(midPt.x);
    expect(mid?.point.y).toBeCloseTo(midPt.y);
    const nearest = pickDxfObjectSnap({ x: midPt.x, y: midPt.y + 0.02 }, entities, 0.08);
    expect(nearest?.kind).toBe("nearest");
    const bounds = dxfBounds(entities)!;
    expect(bounds.minX).toBeCloseTo(-1);
    expect(bounds.maxX).toBeCloseTo(1);
    expect(bounds.maxY).toBeCloseTo(1);
    expect(bounds.minY).toBeCloseTo(0);
  });

  it("snaps to tessellated ELLIPSE segments and does not invent a chord on an open arc", () => {
    const full = parseDxfEntities(
      "  0\nSECTION\n  2\nENTITIES\n  0\nELLIPSE\n  10\n0\n  20\n0\n  11\n2\n  21\n0\n  40\n0.5\n  41\n0\n  42\n" +
        `${Math.PI * 2}\n  0\nENDSEC\n  0\nEOF\n`
    );
    expect(full[0]?.closed).toBe(true);
    expect(full[0]?.points).toHaveLength(DXF_CURVE_SEGMENTS_PER_TURN);
    const bounds = dxfBounds(full)!;
    expect(bounds.minX).toBeCloseTo(-2);
    expect(bounds.maxX).toBeCloseTo(2);
    expect(bounds.minY).toBeCloseTo(-1);
    expect(bounds.maxY).toBeCloseTo(1);

    const end = pickDxfObjectSnap({ x: 2.02, y: 0 }, full, 0.1);
    expect(end?.kind).toBe("endpoint");
    expect(end?.point.x).toBeCloseTo(2);
    expect(end?.point.y).toBeCloseTo(0);

    const first = full[0]!.points[0]!;
    const second = full[0]!.points[1]!;
    const midPt = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
    const mid = pickDxfObjectSnap(midPt, full, 0.05);
    expect(mid?.kind).toBe("midpoint");
    expect(mid?.point.x).toBeCloseTo(midPt.x);
    expect(mid?.point.y).toBeCloseTo(midPt.y);
    const nearest = pickDxfObjectSnap({ x: midPt.x, y: midPt.y + 0.02 }, full, 0.08);
    expect(nearest?.kind).toBe("nearest");

    const quarter = parseDxfEntities(
      "  0\nSECTION\n  2\nENTITIES\n  0\nELLIPSE\n  10\n0\n  20\n0\n  11\n2\n  21\n0\n  40\n0.5\n  41\n0\n  42\n" +
        `${Math.PI / 2}\n  0\nENDSEC\n  0\nEOF\n`
    );
    expect(quarter[0]?.closed).toBeUndefined();
    // Open elliptical arc must not invent a closing chord from (0,1) back to (2,0).
    const invented = pickDxfObjectSnap({ x: 1, y: 0.5 }, quarter, 0.15);
    expect(invented).toBeNull();
    const arcEnd = pickDxfObjectSnap({ x: 0, y: 1.02 }, quarter, 0.1);
    expect(arcEnd?.kind).toBe("endpoint");
    expect(arcEnd?.point.x).toBeCloseTo(0);
    expect(arcEnd?.point.y).toBeCloseTo(1);
    const arcBounds = dxfBounds(quarter)!;
    expect(arcBounds.minX).toBeCloseTo(0);
    expect(arcBounds.maxX).toBeCloseTo(2);
    expect(arcBounds.minY).toBeCloseTo(0);
    expect(arcBounds.maxY).toBeCloseTo(1);
  });


  it("snaps to tessellated SPLINE segments and does not invent a chord on an open spline", () => {
    const w = Math.SQRT1_2;
    const full = parseDxfEntities(
      "  0\nSECTION\n  2\nENTITIES\n  0\nSPLINE\n  70\n5\n  71\n2\n  72\n12\n  73\n9\n" +
        "  40\n0\n  40\n0\n  40\n0\n  40\n1\n  40\n1\n  40\n2\n  40\n2\n  40\n3\n  40\n3\n  40\n4\n  40\n4\n  40\n4\n" +
        "  41\n1\n  41\n" + `${w}\n  41\n1\n  41\n${w}\n  41\n1\n  41\n${w}\n  41\n1\n  41\n${w}\n  41\n1\n` +
        "  10\n1\n  20\n0\n  10\n1\n  20\n1\n  10\n0\n  20\n1\n  10\n-1\n  20\n1\n" +
        "  10\n-1\n  20\n0\n  10\n-1\n  20\n-1\n  10\n0\n  20\n-1\n  10\n1\n  20\n-1\n  10\n1\n  20\n0\n" +
        "  0\nENDSEC\n  0\nEOF\n"
    );
    expect(full[0]?.closed).toBe(true);
    expect(full[0]?.points).toHaveLength(DXF_CURVE_SEGMENTS_PER_TURN);
    const bounds = dxfBounds(full)!;
    expect(bounds.minX).toBeCloseTo(-1, 6);
    expect(bounds.maxX).toBeCloseTo(1, 6);
    expect(bounds.minY).toBeCloseTo(-1, 6);
    expect(bounds.maxY).toBeCloseTo(1, 6);

    const end = pickDxfObjectSnap({ x: 1.02, y: 0 }, full, 0.1);
    expect(end?.kind).toBe("endpoint");
    expect(end?.point.x).toBeCloseTo(1);
    expect(end?.point.y).toBeCloseTo(0);

    const first = full[0]!.points[0]!;
    const second = full[0]!.points[1]!;
    const midPt = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
    const mid = pickDxfObjectSnap(midPt, full, 0.05);
    expect(mid?.kind).toBe("midpoint");
    expect(mid?.point.x).toBeCloseTo(midPt.x);
    expect(mid?.point.y).toBeCloseTo(midPt.y);
    const nearest = pickDxfObjectSnap({ x: midPt.x, y: midPt.y + 0.02 }, full, 0.08);
    expect(nearest?.kind).toBe("nearest");

    const quarter = parseDxfEntities(
      "  0\nSECTION\n  2\nENTITIES\n  0\nSPLINE\n  70\n4\n  71\n2\n  72\n6\n  73\n3\n" +
        "  40\n0\n  40\n0\n  40\n0\n  40\n1\n  40\n1\n  40\n1\n" +
        "  41\n1\n  41\n" + `${w}\n  41\n1\n` +
        "  10\n1\n  20\n0\n  10\n1\n  20\n1\n  10\n0\n  20\n1\n" +
        "  0\nENDSEC\n  0\nEOF\n"
    );
    expect(quarter[0]?.closed).toBeUndefined();
    // Open spline must not invent a closing chord from (0,1) back to (1,0).
    const invented = pickDxfObjectSnap({ x: 0.5, y: 0.5 }, quarter, 0.15);
    expect(invented).toBeNull();
    const arcEnd = pickDxfObjectSnap({ x: 0, y: 1.02 }, quarter, 0.1);
    expect(arcEnd?.kind).toBe("endpoint");
    expect(arcEnd?.point.x).toBeCloseTo(0);
    expect(arcEnd?.point.y).toBeCloseTo(1);
    const start = pickDxfObjectSnap({ x: 1.02, y: 0 }, quarter, 0.1);
    expect(start?.kind).toBe("endpoint");
    expect(start?.point.x).toBeCloseTo(1);
    expect(start?.point.y).toBeCloseTo(0);
    const arcBounds = dxfBounds(quarter)!;
    expect(arcBounds.minX).toBeCloseTo(0);
    expect(arcBounds.maxX).toBeCloseTo(1);
    expect(arcBounds.minY).toBeCloseTo(0);
    expect(arcBounds.maxY).toBeCloseTo(1);
  });
});
