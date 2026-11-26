import { describe, expect, it } from "vitest";
import { parseIes } from "../../photometry/src/index";
import { calculate } from "../../solver/src/calculate";
import { readFileSync } from "fs";
import path from "path";
import { rectPolygon, roomAreaM2 } from "./geometry";
import { clipResultsToPolygon, roomToCalcOptions } from "./room-adapter";
import type { FixtureInstance, RoomV2 } from "./types";
import {
  buildWallChains,
  calculateRoomWalls,
  inwardNormal,
  locateOnPolyline,
  sampleWallGrid,
  signedPolygonArea,
  wallGridAxes,
} from "./wall-surfaces";

const fixture = readFileSync(
  path.join(process.cwd(), "fixtures/sample-downlight.ies"),
  "utf8"
);

function office(id = "r1"): RoomV2 {
  return {
    id,
    storeyId: "s1",
    name: "Office",
    polygon: rectPolygon(0, 0, 6, 5),
    heightM: 2.8,
    workplaneHeightM: 0.75,
    reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
    calc: { gridSpacing: 0.5, interreflection: true, bounces: 2, computeUgr: false },
  };
}

function lShapedRoom(): RoomV2 {
  return {
    ...office("r-l"),
    name: "Reception",
    polygon: [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 4 },
      { x: 3, y: 4 },
      { x: 3, y: 7 },
      { x: 0, y: 7 },
    ],
  };
}

describe("wall surface generation", () => {
  it("builds four walls on a rectangle with inward normals", () => {
    const room = office();
    expect(signedPolygonArea(room.polygon)).toBeGreaterThan(0);
    const chains = buildWallChains(room);
    expect(chains).toHaveLength(4);
    const lengths = chains.map((c) => c.lengthM).sort((a, b) => a - b);
    expect(lengths[0]).toBeCloseTo(5, 5);
    expect(lengths[3]).toBeCloseTo(6, 5);
    const mid = { x: 3, y: 2.5 };
    for (const c of chains) {
      const a = c.polyline[0]!;
      const b = c.polyline[1]!;
      const n = inwardNormal(a, b, true);
      // A point just inside along the normal stays inside the room.
      const inside = { x: (a.x + b.x) / 2 + n.x * 0.1, y: (a.y + b.y) / 2 + n.y * 0.1 };
      const towardMid = (mid.x - (a.x + b.x) / 2) * n.x + (mid.y - (a.y + b.y) / 2) * n.y;
      expect(towardMid).toBeGreaterThan(0);
      expect(inside.x).toBeGreaterThan(-0.01);
      expect(inside.x).toBeLessThan(6.01);
    }
  });

  it("insets the first grid point by the 0.25 m wall zone on a 6 m wall", () => {
    const { us, vs } = wallGridAxes(6, 2.8, 0.5, 0.25);
    expect(us[0]).toBeCloseTo(0.25, 6);
    expect(us[1]).toBeCloseTo(0.75, 6);
    expect(us[us.length - 1]!).toBeCloseTo(5.75, 6);
    expect(vs[0]).toBeCloseTo(0.25, 6);
    expect(vs[vs.length - 1]!).toBeLessThan(2.8);
  });

  it("places a single column on a short wall rather than dropping the surface", () => {
    const { us } = wallGridAxes(0.4, 2.8, 0.5, 0.25);
    expect(us).toEqual([0.2]);
  });

  it("keeps the L-shaped notch as a corner, not a bounding-box wall", () => {
    const room = lShapedRoom();
    const chains = buildWallChains(room);
    expect(chains.length).toBeGreaterThanOrEqual(6);
    // No wall should run through the missing rectangle (x>3, y>4) as a diagonal/bbox edge.
    for (const c of chains) {
      for (let i = 0; i < c.polyline.length - 1; i += 1) {
        const a = c.polyline[i]!;
        const b = c.polyline[i + 1]!;
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const inNotch = mid.x > 3.05 && mid.y > 4.05;
        expect(inNotch).toBe(false);
      }
    }
  });

  it("merges a shallow curve into one wall and keeps sharp corners separate", () => {
    const pts: { x: number; y: number }[] = [{ x: 0, y: 0 }, { x: 4, y: 0 }];
    // quarter-circle-ish from (4,0) to (4,2) would be a sharp corner first —
    // use a gentle arc from (4,0) toward (-x) with small turns, then a 90° corner.
    let x = 4;
    let y = 0;
    for (let i = 1; i <= 8; i += 1) {
      const ang = (i / 8) * (Math.PI / 2);
      // actually go along x=4+sin, wait: start at (4,0) heading +X, then curve to +Y.
      x = 4 + Math.sin(ang);
      y = 1 - Math.cos(ang);
      pts.push({ x, y });
    }
    // last ~ (5,1). Then 90° to a straight side back.
    pts.push({ x: 5, y: 3 }, { x: 0, y: 3 });
    const room: RoomV2 = { ...office(), polygon: pts };
    const chains = buildWallChains(room);
    const curved = chains.filter((c) => c.curved);
    expect(curved.length).toBeGreaterThanOrEqual(1);
    expect(curved[0]!.polyline.length).toBeGreaterThan(3);
    expect(chains.length).toBeGreaterThanOrEqual(3);
  });
});

describe("wall surface solver", () => {
  it("computes inward-facing vertical illuminance without changing workplane results", () => {
    const { data } = parseIes(fixture);
    const room = office();
    const inst: FixtureInstance = {
      instanceId: "i1",
      luminaireId: "lum",
      storeyId: "s1",
      roomId: "r1",
      name: "DL",
      position: { x: 3, y: 2.5, z: 2.6 },
      rotationDeg: 0,
    };
    const wp = clipResultsToPolygon(
      room,
      calculate(roomToCalcOptions(room, [inst], { lum: data }, { lum: 30 }))
    );
    const walls = calculateRoomWalls({
      room,
      instances: [inst],
      photometry: { lum: data },
      wattsById: { lum: 30 },
    });
    expect(walls).toHaveLength(4);
    for (const w of walls) {
      expect(w.grid.nu).toBeGreaterThanOrEqual(1);
      expect(w.grid.nv).toBeGreaterThanOrEqual(1);
      expect(w.grid.lux.length).toBe(w.grid.nu * w.grid.nv);
      expect(w.summary.eave).toBeGreaterThan(0);
      expect(w.summary.emax).toBeGreaterThanOrEqual(w.summary.eave);
      expect(w.summary.emin).toBeLessThanOrEqual(w.summary.eave);
      expect(w.normal.x * w.normal.x + w.normal.y * w.normal.y).toBeCloseTo(1, 5);
    }
    // Workplane figures must be untouched by the wall pass.
    expect(wp.summary.eave).toBeGreaterThan(0);
    const wp2 = clipResultsToPolygon(
      room,
      calculate(roomToCalcOptions(room, [inst], { lum: data }, { lum: 30 }))
    );
    expect(wp2.summary.eave).toBeCloseTo(wp.summary.eave, 8);
    expect(wp2.summary.emin).toBeCloseTo(wp.summary.emin, 8);
    expect(wp2.summary.emax).toBeCloseTo(wp.summary.emax, 8);
    expect(wp2.summary.uo).toBeCloseTo(wp.summary.uo, 8);
  });

  it("grid points sit on the wall with inward normals", () => {
    const room = office();
    const chains = buildWallChains(room);
    const south = chains.find((c) => Math.abs(c.polyline[0]!.y) < 1e-9 && Math.abs(c.polyline[1]!.y) < 1e-9);
    expect(south).toBeTruthy();
    const samples = sampleWallGrid(south!, 2.8, 0.5, 0.25);
    expect(samples.length).toBeGreaterThan(3);
    for (const s of samples) {
      expect(s.point.y).toBeCloseTo(0.005, 3);
      expect(s.normal.y).toBeGreaterThan(0.9); // inward = +Y for the y=0 wall
      expect(s.normal.z).toBe(0);
    }
    const loc = locateOnPolyline(south!.polyline, south!.normals, 3);
    expect(loc.y).toBeCloseTo(0, 5);
    expect(loc.x).toBeCloseTo(3, 5);
  });
});

void roomAreaM2;
