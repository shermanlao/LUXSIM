import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { parseIes } from "../../photometry/src/index";
import { calculate } from "../../solver/src/calculate";
import {
  computeUgr,
  defaultUgrObserverPositions,
  UGR_EYE_HEIGHT_M,
} from "../../solver/src/ugr";
import { clipResultsToPolygon, roomSpecFromV2, roomToCalcOptions } from "./room-adapter";
import { pointInPolygon, rectPolygon, roomBounds } from "./geometry";
import { ugrObserverPositionsInRoom } from "./ugr-observers";
import type { FixtureInstance, RoomV2, Vec2 } from "./types";

const fixture = readFileSync(
  path.join(process.cwd(), "fixtures/sample-downlight.ies"),
  "utf8"
);

function baseRoom(
  id: string,
  name: string,
  polygon: Vec2[],
  extras?: Partial<RoomV2>
): RoomV2 {
  return {
    id,
    storeyId: "s1",
    name,
    polygon,
    heightM: 2.8,
    workplaneHeightM: 0.75,
    reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
    calc: {
      gridSpacing: 0.5,
      interreflection: true,
      bounces: 2,
      computeUgr: true,
    },
    ...extras,
  };
}

/** Orthogonal L: 4×4 m AABB with a notch in the upper-left (x < 2.2 m, y > 2 m). */
function lShapedPolygon(ox = 0, oy = 0): Vec2[] {
  return [
    { x: ox + 0, y: oy + 0 },
    { x: ox + 4, y: oy + 0 },
    { x: ox + 4, y: oy + 4 },
    { x: ox + 2.2, y: oy + 4 },
    { x: ox + 2.2, y: oy + 2 },
    { x: ox + 0, y: oy + 2 },
  ];
}

/**
 * Synthetic copy of the Method 1 complex Room 2 outline (world metres).
 * Used only as an in-memory reference; the golden project is not opened or written.
 */
const ROOM2_REFERENCE_POLYGON: Vec2[] = [
  { x: 10.223773799955184, y: -0.06189757253877026 },
  { x: 10.335779273891092, y: 4.158168571107008 },
  { x: 8.252983971042285, y: 4.140168843630864 },
  { x: 8.252983971042285, y: 2.0315998388816587 },
  { x: 6.1444149662930805, y: 2.0315998388816587 },
  { x: 6.1444149662930805, y: -0.11601674002956397 },
];

function fixtureInRoom(
  room: RoomV2,
  id: string,
  localX: number,
  localY: number,
  z = 2.6
): FixtureInstance {
  const b = roomBounds(room);
  return {
    instanceId: id,
    luminaireId: "lum",
    storeyId: room.storeyId,
    roomId: room.id,
    name: "DL",
    position: { x: b.minX + localX, y: b.minY + localY, z },
    rotationDeg: 0,
  };
}

function worldOf(room: RoomV2, local: { x: number; y: number }): Vec2 {
  const b = roomBounds(room);
  return { x: b.minX + local.x, y: b.minY + local.y };
}

function expectObserversInside(
  room: RoomV2,
  observers: { x: number; y: number; z: number }[]
) {
  expect(observers.length).toBe(6);
  for (const o of observers) {
    expect(o.z).toBe(UGR_EYE_HEIGHT_M);
    expect(pointInPolygon(worldOf(room, o), room.polygon)).toBe(true);
  }
}

function countDefaultOutside(room: RoomV2): number {
  const b = roomBounds(room);
  return defaultUgrObserverPositions(b.width, b.depth).filter(
    (p) => !pointInPolygon(worldOf(room, p), room.polygon)
  ).length;
}

describe("ugr observers clipped to the room polygon", () => {
  it("keeps all six default positions inside a rectangular room", () => {
    const room = baseRoom("rect", "Rect", rectPolygon(10, 2, 5, 4));
    const placed = ugrObserverPositionsInRoom(room);
    const defaults = defaultUgrObserverPositions(5, 4);
    expect(countDefaultOutside(room)).toBe(0);
    expectObserversInside(room, placed);
    for (let i = 0; i < 6; i += 1) {
      expect(placed[i]!.x).toBeCloseTo(defaults[i]!.x, 10);
      expect(placed[i]!.y).toBeCloseTo(defaults[i]!.y, 10);
      expect(placed[i]!.z).toBe(UGR_EYE_HEIGHT_M);
    }
  });

  it("moves L-shaped AABB points out of the notch so all six sit inside", () => {
    const room = baseRoom("l1", "L", lShapedPolygon(6, -1));
    const defaultsOutside = countDefaultOutside(room);
    expect(defaultsOutside).toBe(2);
    const placed = ugrObserverPositionsInRoom(room);
    expectObserversInside(room, placed);
    const moved = placed.filter((p, i) => {
      const d = defaultUgrObserverPositions(4, 4)[i]!;
      return Math.hypot(p.x - d.x, p.y - d.y) > 1e-9;
    });
    expect(moved.length).toBe(defaultsOutside);
  });

  it("places all six observers inside the Room 2 reference L polygon", () => {
    const room = baseRoom("r2", "Room 2 ref", ROOM2_REFERENCE_POLYGON, {
      heightM: 3.2,
    });
    expect(countDefaultOutside(room)).toBe(2);
    expectObserversInside(room, ugrObserverPositionsInRoom(room));
  });

  it("official clip uses clipped Ēm for Lb and keeps observers inside an L-room", () => {
    const { data } = parseIes(fixture);
    const room = baseRoom("l2", "L", lShapedPolygon(3, 1));
    const instances = [
      fixtureInRoom(room, "i1", 3.0, 1.0),
      fixtureInRoom(room, "i2", 3.0, 3.0),
      fixtureInRoom(room, "i3", 1.0, 1.0),
    ];
    const opts = roomToCalcOptions(room, instances, { lum: data }, { lum: 30 });
    const raw = calculate(opts);
    expect(raw.summary.ugr).not.toBeNull();
    expect(countDefaultOutside(room)).toBe(2);

    const clippedStats = clipResultsToPolygon(room, raw);
    expect(Math.abs(clippedStats.summary.eave - raw.summary.eave)).toBeGreaterThan(5);

    const official = clipResultsToPolygon(room, raw, opts.luminaires);
    expect(official.summary.eave).toBeCloseTo(clippedStats.summary.eave, 10);
    expectObserversInside(room, official.ugrObservers ?? []);

    const positions = ugrObserverPositionsInRoom(room);
    const fromClippedEm = computeUgr(
      roomSpecFromV2(room),
      opts.luminaires,
      official.summary.eave,
      positions
    );
    const fromUnclippedEm = computeUgr(
      roomSpecFromV2(room),
      opts.luminaires,
      raw.summary.eave,
      positions
    );
    expect(official.summary.ugr).toBeCloseTo(fromClippedEm.ugr, 8);
    expect(Math.abs(fromClippedEm.ugr - fromUnclippedEm.ugr)).toBeGreaterThan(0.05);
    expect(Math.abs((official.summary.ugr ?? 0) - fromUnclippedEm.ugr)).toBeGreaterThan(
      0.05
    );
  });

  it("does not change rectangular-room observer layout or UGR after clip", () => {
    const { data } = parseIes(fixture);
    const room = baseRoom("rect2", "Rect", rectPolygon(0, 0, 5, 4));
    const instances = [
      fixtureInRoom(room, "i1", 1.25, 1.0),
      fixtureInRoom(room, "i2", 3.75, 3.0),
    ];
    const opts = roomToCalcOptions(room, instances, { lum: data }, { lum: 30 });
    const raw = calculate(opts);
    const official = clipResultsToPolygon(room, raw, opts.luminaires);
    expect(official.summary.eave).toBeCloseTo(raw.summary.eave, 8);
    expectObserversInside(room, official.ugrObservers ?? []);
    const defaults = defaultUgrObserverPositions(5, 4);
    for (let i = 0; i < 6; i += 1) {
      expect(official.ugrObservers![i]!.x).toBeCloseTo(defaults[i]!.x, 10);
      expect(official.ugrObservers![i]!.y).toBeCloseTo(defaults[i]!.y, 10);
    }
    expect(official.summary.ugr).toBeCloseTo(raw.summary.ugr!, 8);
  });
});
