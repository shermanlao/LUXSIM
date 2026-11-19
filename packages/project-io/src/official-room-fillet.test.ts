import { describe, expect, it } from "vitest";
import { rectPolygon, roomAreaM2 } from "./geometry";
import { defaultSceneV2 } from "./migrate";
import { officialNewRoom } from "./new-room-defaults";
import { officialAppendStorey } from "./official-storey-metrics";
import {
  DXF_CURVE_SEGMENTS_PER_TURN,
  dxfCurveSegmentCount,
  tessellateCircularArcIntermediates,
} from "./dxf";
import { officialDxfPointsCoincide } from "./official-dxf-polyline";
import { officialPointInPolygonInclusive } from "./official-room-union";
import { officialRoomRingVertices } from "./official-room-vertex";
import {
  FILLET_ALL_CORNERS_REFUSE_MISSING_STATUS,
  FILLET_ALL_CORNERS_REFUSE_RADIUS_STATUS,
  FILLET_ALL_CORNERS_REFUSE_STRAIGHT_STATUS,
  FILLET_ALL_CORNERS_REFUSE_STOREY_STATUS,
  FILLET_ALL_CORNERS_REFUSE_TOO_LARGE_STATUS,
  FILLET_CORNER_REFUSE_CORNER_STATUS,
  FILLET_CORNER_REFUSE_MISSING_STATUS,
  FILLET_CORNER_REFUSE_RADIUS_STATUS,
  FILLET_CORNER_REFUSE_STRAIGHT_STATUS,
  FILLET_CORNER_REFUSE_STOREY_STATUS,
  FILLET_CORNER_REFUSE_TOO_LARGE_STATUS,
  FILLET_CORNER_REFUSE_AREA_STATUS,
  formatFilletAllCornersSuccessStatus,
  formatFilletCornerSuccessStatus,
  filletOfficialRoomAllCorners,
  filletOfficialRoomCorner,
  officialFilletRoomAllCorners,
  officialFilletRoomCorner,
  officialShortSweepRad,
} from "./official-room-fillet";
import type { FixtureInstance, ProjectSceneV2, Vec2 } from "./types";

const L_POLYGON: Vec2[] = [
  { x: 0, y: 0 },
  { x: 2, y: 0 },
  { x: 2, y: 1 },
  { x: 1, y: 1 },
  { x: 1, y: 2 },
  { x: 0, y: 2 },
];

function addRoom(
  scene: ProjectSceneV2,
  id: string,
  polygon: Vec2[],
  extra?: Partial<ProjectSceneV2["rooms"][number]>
) {
  const room = officialNewRoom({
    id,
    storeyId: extra?.storeyId ?? scene.ui.activeStoreyId,
    name: extra?.name ?? id,
    polygon,
    heightM: extra?.heightM ?? 2.8,
  });
  scene.rooms = [...scene.rooms, room];
  return room;
}

function fixture(
  scene: ProjectSceneV2,
  input: { instanceId: string; roomId: string | null; x: number; y: number; storeyId?: string }
): FixtureInstance {
  return {
    instanceId: input.instanceId,
    luminaireId: "lum-1",
    storeyId: input.storeyId ?? scene.ui.activeStoreyId,
    roomId: input.roomId,
    name: input.instanceId,
    position: { x: input.x, y: input.y, z: 2.7 },
    rotationDeg: 15,
  };
}

function expectedSquareFilletArea(sideM: number, radiusM: number, corners = 1): number {
  return sideM * sideM - corners * (radiusM * radiusM - (Math.PI * radiusM * radiusM) / 4);
}

describe("filletOfficialRoomCorner", () => {
  it("fillets one corner of a 2 m × 2 m square with R = 0.5 m as a quarter-circle", () => {
    const square = rectPolygon(0, 0, 2, 2);
    const result = filletOfficialRoomCorner(square, 0, 0.5);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ring = officialRoomRingVertices(result.polygon);
    // Replaced vertex 0: [T1, ...mid, T2, (2,0), (2,2), (0,2)]
    expect(officialDxfPointsCoincide(ring[0]!, { x: 0, y: 0.5 })).toBe(true);
    expect(ring[ring.length - 3]).toEqual({ x: 2, y: 0 });
    const firstAfterArc = ring.find((p, i) => i > 0 && Math.abs(p.y) < 1e-9 && p.x > 0)!;
    expect(firstAfterArc).toBeDefined();
    expect(officialDxfPointsCoincide(firstAfterArc, { x: 0.5, y: 0 })).toBe(true);

    const t1Idx = 0;
    const t2Idx = ring.findIndex((p) => officialDxfPointsCoincide(p, { x: 0.5, y: 0 }));
    expect(t2Idx).toBeGreaterThan(t1Idx);
    const mid = ring.slice(t1Idx + 1, t2Idx);
    const sweep = officialShortSweepRad(Math.PI, -Math.PI / 2);
    expect(Math.abs(sweep)).toBeCloseTo(Math.PI / 2, 12);
    expect(mid).toEqual(tessellateCircularArcIntermediates(0.5, 0.5, 0.5, Math.PI, sweep));
    expect(mid.length).toBe(dxfCurveSegmentCount(Math.PI / 2) - 1);
    expect(DXF_CURVE_SEGMENTS_PER_TURN).toBe(48);
    expect(dxfCurveSegmentCount(Math.PI / 2)).toBe(12);

    const arcMid = mid[Math.floor(mid.length / 2)]!;
    expect(arcMid.x).toBeCloseTo(0.5 - 0.5 / Math.SQRT2, 6);
    expect(arcMid.y).toBeCloseTo(0.5 - 0.5 / Math.SQRT2, 6);
    // 12-segment official tessellation undershoots the true quarter-disk slightly.
    const area = roomAreaM2({ polygon: ring } as ProjectSceneV2["rooms"][number]);
    const analytic = expectedSquareFilletArea(2, 0.5);
    expect(Math.abs(area - analytic)).toBeLessThan(1e-3);
    expect(area).toBeLessThan(analytic);
    expect(square).toEqual(rectPolygon(0, 0, 2, 2));
  });

  it("keeps a duplicated closing vertex when the input had one", () => {
    const closed = [...rectPolygon(0, 0, 2, 2), { x: 0, y: 0 }];
    const result = filletOfficialRoomCorner(closed, 0, 0.5);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      officialDxfPointsCoincide(result.polygon[0]!, result.polygon[result.polygon.length - 1]!)
    ).toBe(true);
  });

  it("refuses a radius of 0, a negative radius, and a non-finite radius", () => {
    const square = rectPolygon(0, 0, 2, 2);
    expect(filletOfficialRoomCorner(square, 0, 0)).toEqual({ ok: false, reason: "radius" });
    expect(filletOfficialRoomCorner(square, 0, -0.5)).toEqual({ ok: false, reason: "radius" });
    expect(filletOfficialRoomCorner(square, 0, Number.NaN)).toEqual({
      ok: false,
      reason: "radius",
    });
    expect(square).toEqual(rectPolygon(0, 0, 2, 2));
  });

  it("refuses a radius that is not strictly shorter than both adjacent edges", () => {
    const square = rectPolygon(0, 0, 2, 2);
    expect(filletOfficialRoomCorner(square, 0, 2)).toEqual({ ok: false, reason: "too-large" });
    expect(filletOfficialRoomCorner(square, 0, 3)).toEqual({ ok: false, reason: "too-large" });
    expect(square).toEqual(rectPolygon(0, 0, 2, 2));
  });

  it("refuses a collinear or already-straight corner", () => {
    const withMid: Vec2[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ];
    expect(filletOfficialRoomCorner(withMid, 1, 0.3)).toEqual({
      ok: false,
      reason: "straight",
    });
    expect(withMid).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ]);
  });

  it("refuses a missing corner index", () => {
    const square = rectPolygon(0, 0, 2, 2);
    expect(filletOfficialRoomCorner(square, -1, 0.5)).toEqual({ ok: false, reason: "corner" });
    expect(filletOfficialRoomCorner(square, 4, 0.5)).toEqual({ ok: false, reason: "corner" });
    expect(filletOfficialRoomCorner(square, 1.5, 0.5)).toEqual({ ok: false, reason: "corner" });
  });

  it("fillets the inner concave corner of an L-room with the arc on the interior side", () => {
    const result = filletOfficialRoomCorner(L_POLYGON, 3, 0.5);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ring = officialRoomRingVertices(result.polygon);
    const t1 = ring.find((p) => officialDxfPointsCoincide(p, { x: 1.5, y: 1 }));
    const t2 = ring.find((p) => officialDxfPointsCoincide(p, { x: 1, y: 1.5 }));
    expect(t1).toBeDefined();
    expect(t2).toBeDefined();
    expect(ring.some((p) => officialDxfPointsCoincide(p, { x: 1, y: 1 }))).toBe(false);
    const mid = ring.find(
      (p) =>
        Math.abs(p.x - (1.5 - 0.5 / Math.SQRT2)) < 1e-3 &&
        Math.abs(p.y - (1.5 - 0.5 / Math.SQRT2)) < 1e-3
    );
    expect(mid).toBeDefined();
    // The short arc sits in the missing notch (outside the original L, on the interior-rounded side).
    expect(officialPointInPolygonInclusive({ x: 1.1464, y: 1.1464 }, L_POLYGON)).toBe(false);
    expect(
      officialPointInPolygonInclusive({ x: 1.1464, y: 1.1464 }, officialRoomRingVertices(result.polygon))
    ).toBe(true);
    const added = 0.25 - Math.PI / 16;
    const area = roomAreaM2({ polygon: ring } as ProjectSceneV2["rooms"][number]);
    expect(Math.abs(area - (3 + added))).toBeLessThan(1e-3);
    expect(area).toBeGreaterThan(3 + added);
    expect(L_POLYGON).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
    ]);
  });

  it("refuses a fillet that would drop the room area below 0.01 m², leaving the polygon identical", () => {
    const tiny: Vec2[] = [
      { x: 0, y: 0 },
      { x: 0.15, y: 0 },
      { x: 0, y: 0.15 },
    ];
    const original = tiny.map((p) => ({ ...p }));
    const result = filletOfficialRoomCorner(tiny, 0, 0.14);
    expect(result).toEqual({ ok: false, reason: "area" });
    expect(tiny).toEqual(original);
  });
});

describe("officialFilletRoomCorner", () => {
  it("updates the room, unassigns fixtures that fall outside, and leaves inside fixtures put", () => {
    const scene = defaultSceneV2();
    addRoom(scene, "room-a", rectPolygon(0, 0, 2, 2), { name: "Office" });
    addRoom(scene, "room-b", rectPolygon(10, 0, 2, 2));
    scene.instances = [
      fixture(scene, { instanceId: "cut-away", roomId: "room-a", x: 0.05, y: 0.05 }),
      fixture(scene, { instanceId: "stays", roomId: "room-a", x: 1, y: 1 }),
      fixture(scene, { instanceId: "other", roomId: "room-b", x: 0.05, y: 0.05 }),
      fixture(scene, { instanceId: "loose", roomId: null, x: 0.05, y: 0.05 }),
    ];
    const result = officialFilletRoomCorner(scene, "room-a", 0, 0.5);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe(formatFilletCornerSuccessStatus("Office"));
    expect(result.scene).not.toBe(scene);
    const room = result.scene.rooms.find((r) => r.id === "room-a")!;
    const analytic = expectedSquareFilletArea(2, 0.5);
    expect(Math.abs(roomAreaM2(room) - analytic)).toBeLessThan(1e-3);
    expect(roomAreaM2(room)).toBeLessThan(analytic);
    expect(scene.rooms.find((r) => r.id === "room-a")!.polygon).toEqual(rectPolygon(0, 0, 2, 2));

    const byId = Object.fromEntries(result.scene.instances.map((i) => [i.instanceId, i]));
    expect(byId["cut-away"]!.roomId).toBeNull();
    expect(byId["cut-away"]!.storeyId).toBe(scene.ui.activeStoreyId);
    expect(byId["cut-away"]!.position).toEqual({ x: 0.05, y: 0.05, z: 2.7 });
    expect(byId["stays"]!.roomId).toBe("room-a");
    expect(byId["stays"]!.position).toEqual({ x: 1, y: 1, z: 2.7 });
    expect(byId["other"]!.roomId).toBe("room-b");
    expect(byId["loose"]!.roomId).toBeNull();
    expect(result.scene.instances).toHaveLength(4);
    expect(result.scene.rooms.find((r) => r.id === "room-b")!.polygon).toEqual(
      rectPolygon(10, 0, 2, 2)
    );
  });

  it("returns the same scene object and an identical polygon when the call is refused", () => {
    const scene = defaultSceneV2();
    const polygon = rectPolygon(0, 0, 2, 2);
    addRoom(scene, "room-a", polygon);
    scene.instances = [
      fixture(scene, { instanceId: "in-room", roomId: "room-a", x: 0.05, y: 0.05 }),
    ];

    const zero = officialFilletRoomCorner(scene, "room-a", 0, 0);
    expect(zero).toEqual({
      ok: false,
      scene,
      status: FILLET_CORNER_REFUSE_RADIUS_STATUS,
      reason: "radius",
    });
    expect(zero.scene).toBe(scene);

    const missing = officialFilletRoomCorner(scene, "no-such", 0, 0.5);
    expect(missing.status).toBe(FILLET_CORNER_REFUSE_MISSING_STATUS);
    expect(missing.scene).toBe(scene);

    const tooLarge = officialFilletRoomCorner(scene, "room-a", 0, 2);
    expect(tooLarge.status).toBe(FILLET_CORNER_REFUSE_TOO_LARGE_STATUS);
    expect(tooLarge.scene).toBe(scene);

    const noCorner = officialFilletRoomCorner(scene, "room-a", 9, 0.5);
    expect(noCorner.status).toBe(FILLET_CORNER_REFUSE_CORNER_STATUS);
    expect(noCorner.scene).toBe(scene);

    const other = officialAppendStorey(scene, { id: "storey-2" });
    const offStorey = officialFilletRoomCorner(other, "room-a", 0, 0.5);
    expect(offStorey.ok).toBe(false);
    if (offStorey.ok) return;
    expect(offStorey.status).toBe(FILLET_CORNER_REFUSE_STOREY_STATUS);
    expect(offStorey.scene).toBe(other);
    expect(other.rooms.find((r) => r.id === "room-a")!.polygon).toEqual(polygon);
    expect(scene.rooms.find((r) => r.id === "room-a")!.polygon).toEqual(polygon);
    expect(scene.instances[0]!.roomId).toBe("room-a");
  });

  it("refuses a straight corner on the scene path without changing the room", () => {
    const scene = defaultSceneV2();
    const polygon: Vec2[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ];
    addRoom(scene, "room-a", polygon);
    const result = officialFilletRoomCorner(scene, "room-a", 1, 0.3);
    expect(result).toEqual({
      ok: false,
      scene,
      status: FILLET_CORNER_REFUSE_STRAIGHT_STATUS,
      reason: "straight",
    });
    expect(result.scene).toBe(scene);
    expect(scene.rooms[0]!.polygon).toEqual(polygon);
  });
});

describe("filletOfficialRoomAllCorners", () => {
  it("fillets all four corners of a 2 m × 2 m square with R = 0.5 m as quarter-circles", () => {
    const square = rectPolygon(0, 0, 2, 2);
    const result = filletOfficialRoomAllCorners(square, 0.5);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ring = officialRoomRingVertices(result.polygon);
    const tangents = [
      { x: 0, y: 0.5 },
      { x: 0.5, y: 0 },
      { x: 1.5, y: 0 },
      { x: 2, y: 0.5 },
      { x: 2, y: 1.5 },
      { x: 1.5, y: 2 },
      { x: 0.5, y: 2 },
      { x: 0, y: 1.5 },
    ];
    for (const t of tangents) {
      expect(ring.some((p) => officialDxfPointsCoincide(p, t))).toBe(true);
    }
    expect(ring.some((p) => officialDxfPointsCoincide(p, { x: 0, y: 0 }))).toBe(false);
    expect(ring.some((p) => officialDxfPointsCoincide(p, { x: 2, y: 0 }))).toBe(false);
    expect(ring.some((p) => officialDxfPointsCoincide(p, { x: 2, y: 2 }))).toBe(false);
    expect(ring.some((p) => officialDxfPointsCoincide(p, { x: 0, y: 2 }))).toBe(false);

    const t1Idx = ring.findIndex((p) => officialDxfPointsCoincide(p, { x: 0, y: 0.5 }));
    const t2Idx = ring.findIndex((p) => officialDxfPointsCoincide(p, { x: 0.5, y: 0 }));
    expect(t1Idx).toBeGreaterThanOrEqual(0);
    expect(t2Idx).toBeGreaterThan(t1Idx);
    const mid = ring.slice(t1Idx + 1, t2Idx);
    const sweep = officialShortSweepRad(Math.PI, -Math.PI / 2);
    expect(Math.abs(sweep)).toBeCloseTo(Math.PI / 2, 12);
    expect(mid).toEqual(tessellateCircularArcIntermediates(0.5, 0.5, 0.5, Math.PI, sweep));
    expect(mid.length).toBe(dxfCurveSegmentCount(Math.PI / 2) - 1);
    expect(DXF_CURVE_SEGMENTS_PER_TURN).toBe(48);
    expect(dxfCurveSegmentCount(Math.PI / 2)).toBe(12);

    const area = roomAreaM2({ polygon: ring } as ProjectSceneV2["rooms"][number]);
    const analytic = expectedSquareFilletArea(2, 0.5, 4);
    // Four 12-segment official quarter-circles undershoot a little more than one.
    expect(Math.abs(area - analytic)).toBeLessThan(5e-3);
    expect(area).toBeLessThan(analytic);
    expect(square).toEqual(rectPolygon(0, 0, 2, 2));
  });

  it("keeps a duplicated closing vertex when the input had one", () => {
    const closed = [...rectPolygon(0, 0, 2, 2), { x: 0, y: 0 }];
    const result = filletOfficialRoomAllCorners(closed, 0.5);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      officialDxfPointsCoincide(result.polygon[0]!, result.polygon[result.polygon.length - 1]!)
    ).toBe(true);
  });

  it("refuses a radius of 0, a negative radius, and a non-finite radius", () => {
    const square = rectPolygon(0, 0, 2, 2);
    expect(filletOfficialRoomAllCorners(square, 0)).toEqual({ ok: false, reason: "radius" });
    expect(filletOfficialRoomAllCorners(square, -0.5)).toEqual({ ok: false, reason: "radius" });
    expect(filletOfficialRoomAllCorners(square, Number.NaN)).toEqual({
      ok: false,
      reason: "radius",
    });
    expect(square).toEqual(rectPolygon(0, 0, 2, 2));
  });

  it("refuses a radius that is too large for a 2 m square and leaves the polygon unchanged", () => {
    const square = rectPolygon(0, 0, 2, 2);
    expect(filletOfficialRoomAllCorners(square, 2)).toEqual({ ok: false, reason: "too-large" });
    expect(filletOfficialRoomAllCorners(square, 3)).toEqual({ ok: false, reason: "too-large" });
    expect(square).toEqual(rectPolygon(0, 0, 2, 2));
  });

  it("refuses when two fillets would overlap on a short edge", () => {
    const rect = rectPolygon(0, 0, 4, 1);
    const original = rect.map((p) => ({ ...p }));
    expect(filletOfficialRoomAllCorners(rect, 0.6)).toEqual({ ok: false, reason: "too-large" });
    expect(rect).toEqual(original);
    const one = filletOfficialRoomCorner(rect, 0, 0.6);
    expect(one.ok).toBe(true);
  });

  it("refuses a room that is already fully filleted, leaving the polygon unchanged", () => {
    const square = rectPolygon(0, 0, 2, 2);
    const first = filletOfficialRoomAllCorners(square, 0.5);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const original = first.polygon.map((p) => ({ ...p }));
    const again = filletOfficialRoomAllCorners(first.polygon, 0.5);
    expect(again).toEqual({ ok: false, reason: "straight" });
    expect(first.polygon).toEqual(original);
  });

  it("fillets only the remaining sharp corners and leaves already-straight corners", () => {
    const mixed: Vec2[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ];
    const original = mixed.map((p) => ({ ...p }));
    const result = filletOfficialRoomAllCorners(mixed, 0.3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ring = officialRoomRingVertices(result.polygon);
    expect(ring.some((p) => officialDxfPointsCoincide(p, { x: 1, y: 0 }))).toBe(true);
    expect(ring.some((p) => officialDxfPointsCoincide(p, { x: 0, y: 0 }))).toBe(false);
    expect(ring.some((p) => officialDxfPointsCoincide(p, { x: 2, y: 0 }))).toBe(false);
    expect(ring.some((p) => officialDxfPointsCoincide(p, { x: 2, y: 2 }))).toBe(false);
    expect(ring.some((p) => officialDxfPointsCoincide(p, { x: 0, y: 2 }))).toBe(false);
    expect(mixed).toEqual(original);
  });
});

describe("officialFilletRoomAllCorners", () => {
  it("updates the room, unassigns fixtures that fall outside, and leaves inside fixtures put", () => {
    const scene = defaultSceneV2();
    addRoom(scene, "room-a", rectPolygon(0, 0, 2, 2), { name: "Office" });
    addRoom(scene, "room-b", rectPolygon(10, 0, 2, 2));
    scene.instances = [
      fixture(scene, { instanceId: "cut-away", roomId: "room-a", x: 0.05, y: 0.05 }),
      fixture(scene, { instanceId: "stays", roomId: "room-a", x: 1, y: 1 }),
      fixture(scene, { instanceId: "other", roomId: "room-b", x: 0.05, y: 0.05 }),
      fixture(scene, { instanceId: "loose", roomId: null, x: 0.05, y: 0.05 }),
    ];
    const result = officialFilletRoomAllCorners(scene, "room-a", 0.5);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe(formatFilletAllCornersSuccessStatus("Office"));
    expect(result.scene).not.toBe(scene);
    const room = result.scene.rooms.find((r) => r.id === "room-a")!;
    const analytic = expectedSquareFilletArea(2, 0.5, 4);
    expect(Math.abs(roomAreaM2(room) - analytic)).toBeLessThan(5e-3);
    expect(roomAreaM2(room)).toBeLessThan(analytic);
    expect(scene.rooms.find((r) => r.id === "room-a")!.polygon).toEqual(rectPolygon(0, 0, 2, 2));

    const byId = Object.fromEntries(result.scene.instances.map((i) => [i.instanceId, i]));
    expect(byId["cut-away"]!.roomId).toBeNull();
    expect(byId["cut-away"]!.storeyId).toBe(scene.ui.activeStoreyId);
    expect(byId["cut-away"]!.position).toEqual({ x: 0.05, y: 0.05, z: 2.7 });
    expect(byId["stays"]!.roomId).toBe("room-a");
    expect(byId["stays"]!.position).toEqual({ x: 1, y: 1, z: 2.7 });
    expect(byId["other"]!.roomId).toBe("room-b");
    expect(byId["loose"]!.roomId).toBeNull();
    expect(result.scene.instances).toHaveLength(4);
    expect(result.scene.rooms.find((r) => r.id === "room-b")!.polygon).toEqual(
      rectPolygon(10, 0, 2, 2)
    );
  });

  it("returns the same scene object and an identical polygon when the call is refused", () => {
    const scene = defaultSceneV2();
    const polygon = rectPolygon(0, 0, 2, 2);
    addRoom(scene, "room-a", polygon);
    scene.instances = [
      fixture(scene, { instanceId: "in-room", roomId: "room-a", x: 0.05, y: 0.05 }),
    ];

    const zero = officialFilletRoomAllCorners(scene, "room-a", 0);
    expect(zero).toEqual({
      ok: false,
      scene,
      status: FILLET_ALL_CORNERS_REFUSE_RADIUS_STATUS,
      reason: "radius",
    });
    expect(zero.scene).toBe(scene);

    const missing = officialFilletRoomAllCorners(scene, "no-such", 0.5);
    expect(missing.status).toBe(FILLET_ALL_CORNERS_REFUSE_MISSING_STATUS);
    expect(missing.scene).toBe(scene);

    const tooLarge = officialFilletRoomAllCorners(scene, "room-a", 2);
    expect(tooLarge.status).toBe(FILLET_ALL_CORNERS_REFUSE_TOO_LARGE_STATUS);
    expect(tooLarge.scene).toBe(scene);

    const other = officialAppendStorey(scene, { id: "storey-2" });
    const offStorey = officialFilletRoomAllCorners(other, "room-a", 0.5);
    expect(offStorey.ok).toBe(false);
    if (offStorey.ok) return;
    expect(offStorey.status).toBe(FILLET_ALL_CORNERS_REFUSE_STOREY_STATUS);
    expect(offStorey.scene).toBe(other);
    expect(other.rooms.find((r) => r.id === "room-a")!.polygon).toEqual(polygon);
    expect(scene.rooms.find((r) => r.id === "room-a")!.polygon).toEqual(polygon);
    expect(scene.instances[0]!.roomId).toBe("room-a");
  });

  it("refuses an already fully filleted room on the scene path without changing it", () => {
    const scene = defaultSceneV2();
    addRoom(scene, "room-a", rectPolygon(0, 0, 2, 2), { name: "Office" });
    const first = officialFilletRoomAllCorners(scene, "room-a", 0.5);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const polygon = first.scene.rooms.find((r) => r.id === "room-a")!.polygon.map((p) => ({ ...p }));
    const again = officialFilletRoomAllCorners(first.scene, "room-a", 0.5);
    expect(again).toEqual({
      ok: false,
      scene: first.scene,
      status: FILLET_ALL_CORNERS_REFUSE_STRAIGHT_STATUS,
      reason: "straight",
    });
    expect(again.scene).toBe(first.scene);
    expect(first.scene.rooms.find((r) => r.id === "room-a")!.polygon).toEqual(polygon);
  });
});

