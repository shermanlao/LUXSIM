import { describe, expect, it } from "vitest";
import { luxToRgb, pointInPolygon, rectPolygon, type RoomV2, type WallSurfaceResult } from "@luxsim/project-io";
import * as THREE from "three";
import { editorOverviewCamera, type ProjectSceneV2 } from "@luxsim/project-io";
import {
  FALSE_COLOR_WALL_SHELL_OPACITY,
  createCeilingGeometry,
  createClippedWorkplaneGeometry,
  createFloorGeometry,
  createPlanHandednessRoot,
  createWallFalseColorGeometry,
  mirrorPlanX,
  sampleGridLux,
  wallShellOpacity,
  workplaneVerticesInsideRoom,
} from "./scene-3d-model";
import type { CalcResults } from "@luxsim/solver";

function lShapedRoom(): RoomV2 {
  return {
    id: "r-l",
    storeyId: "s1",
    name: "Reception",
    polygon: [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 4 },
      { x: 3, y: 4 },
      { x: 3, y: 7 },
      { x: 0, y: 7 },
    ],
    heightM: 2.8,
    workplaneHeightM: 0.75,
    reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
    calc: { gridSpacing: 0.5, interreflection: false, bounces: 0, computeUgr: false },
  };
}

function gridFor(room: RoomV2, fill: number): CalcResults {
  const nx = 13;
  const ny = 15;
  return {
    grid: {
      nx,
      ny,
      spacing: 0.5,
      originX: 0.25,
      originY: 0.25,
      z: 0.75,
      lux: Array.from({ length: nx * ny }, () => fill),
    },
    summary: { eave: fill, emin: fill, emax: fill, uo: 1, areaM2: 33, totalWatts: 0, lpd: null, ugr: null },
    version: 1,
    meta: { interreflection: false, bounces: 0, calculatedAt: "2026-01-01T00:00:00Z", disclaimer: "" },
  };
}

describe("clipped false-colour workplane", () => {
  it("samples lux in world coordinates relative to the room AABB origin", () => {
    const room: RoomV2 = {
      ...lShapedRoom(),
      polygon: rectPolygon(10, 20, 4, 2),
    };
    const results = gridFor(room, 0);
    results.grid.nx = 3;
    results.grid.ny = 2;
    results.grid.spacing = 1;
    results.grid.originX = 0.5;
    results.grid.originY = 0.5;
    results.grid.lux = [10, 20, 30, 40, 50, 60];
    // world x = 10 + 0.5 + i, y = 20 + 0.5 + j
    expect(sampleGridLux(room, results.grid, 10.5, 20.5)).toBeCloseTo(10, 5);
    expect(sampleGridLux(room, results.grid, 12.5, 21.5)).toBeCloseTo(60, 5);
  });

  it("does not place workplane vertices in the missing rectangle of an L-shaped room", () => {
    const room = lShapedRoom();
    const results = gridFor(room, 200);
    const geo = createClippedWorkplaneGeometry(room, results, 0);
    expect(geo).not.toBeNull();
    const { inside, total } = workplaneVerticesInsideRoom(geo!, room, 0.05);
    expect(total).toBeGreaterThanOrEqual(6);
    expect(inside).toBe(total);

    const pos = geo!.getAttribute("position");
    let inNotch = 0;
    for (let i = 0; i < pos.count; i += 1) {
      const p = { x: pos.getX(i), y: pos.getZ(i) };
      // The missing rectangle is x>3, y>4 (outside the L).
      if (p.x > 3.08 && p.y > 4.08 && !pointInPolygon(p, room.polygon)) {
        inNotch += 1;
      }
    }
    expect(inNotch).toBe(0);
    geo!.dispose();
  });
});


function fakeWall(
  id: string,
  roomId: string,
  name: string,
  polyline: { x: number; y: number }[],
  normals: { x: number; y: number }[],
  widthM: number,
  fill = 200
): WallSurfaceResult {
  const nu = 3;
  const nv = 3;
  return {
    id,
    roomId,
    name,
    polyline,
    normals,
    heightM: 2.8,
    insetM: 0.25,
    normal: normals[0]!,
    widthM,
    curved: polyline.length > 2,
    grid: {
      originU: 0.25,
      originV: 0.25,
      spacing: 0.5,
      nu,
      nv,
      lux: Array.from({ length: nu * nv }, () => fill),
    },
    summary: { eave: fill, emin: fill, emax: fill, uo: 1, areaM2: widthM * 2.3 },
  };
}

describe("vertical wall false-colour geometry", () => {
  it("follows each wall segment of an L-shaped room and stays out of the notch", () => {
    const room = lShapedRoom();
    const walls: WallSurfaceResult[] = [
      fakeWall("w1", room.id, "Wall 1", [{ x: 0, y: 0 }, { x: 6, y: 0 }], [{ x: 0, y: 1 }], 6),
      fakeWall("w2", room.id, "Wall 2", [{ x: 6, y: 0 }, { x: 6, y: 4 }], [{ x: -1, y: 0 }], 4),
      fakeWall("w3", room.id, "Wall 3", [{ x: 6, y: 4 }, { x: 3, y: 4 }], [{ x: 0, y: -1 }], 3),
      fakeWall("w4", room.id, "Wall 4", [{ x: 3, y: 4 }, { x: 3, y: 7 }], [{ x: -1, y: 0 }], 3),
      fakeWall("w5", room.id, "Wall 5", [{ x: 3, y: 7 }, { x: 0, y: 7 }], [{ x: 0, y: -1 }], 3),
      fakeWall("w6", room.id, "Wall 6", [{ x: 0, y: 7 }, { x: 0, y: 0 }], [{ x: 1, y: 0 }], 7),
    ];
    let inNotch = 0;
    let total = 0;
    for (const w of walls) {
      const geo = createWallFalseColorGeometry(w, 0, 0.02);
      expect(geo).not.toBeNull();
      const pos = geo!.getAttribute("position");
      for (let i = 0; i < pos.count; i += 1) {
        total += 1;
        const x = pos.getX(i);
        const yPlan = pos.getZ(i);
        const z = pos.getY(i);
        expect(z).toBeGreaterThanOrEqual(-1e-6);
        expect(z).toBeLessThanOrEqual(2.8 + 1e-6);
        if (x > 3.08 && yPlan > 4.08) inNotch += 1;
      }
      geo!.dispose();
    }
    expect(total).toBeGreaterThan(20);
    expect(inNotch).toBe(0);
  });

  it("follows a curved polyline rather than a bounding-box face", () => {
    const pts: { x: number; y: number }[] = [];
    const normals: { x: number; y: number }[] = [];
    for (let i = 0; i <= 8; i += 1) {
      const a = (i / 8) * (Math.PI / 2);
      pts.push({ x: 4 + 2 * Math.cos(a), y: 2 * Math.sin(a) });
    }
    for (let i = 0; i < pts.length - 1; i += 1) {
      const dx = pts[i + 1]!.x - pts[i]!.x;
      const dy = pts[i + 1]!.y - pts[i]!.y;
      const L = Math.hypot(dx, dy) || 1;
      // Inward for this quarter-circle (centre 4,0) is toward the centre.
      const midX = (pts[i]!.x + pts[i + 1]!.x) / 2;
      const midY = (pts[i]!.y + pts[i + 1]!.y) / 2;
      const nx = 4 - midX;
      const ny = 0 - midY;
      const nL = Math.hypot(nx, ny) || 1;
      normals.push({ x: nx / nL, y: ny / nL });
      void L;
    }
    let width = 0;
    for (let i = 0; i < pts.length - 1; i += 1) {
      width += Math.hypot(pts[i + 1]!.x - pts[i]!.x, pts[i + 1]!.y - pts[i]!.y);
    }
    const wall = fakeWall("curve", "r1", "Wall 1 (curved)", pts, normals, width);
    const geo = createWallFalseColorGeometry(wall, 0, 0.02);
    expect(geo).not.toBeNull();
    const pos = geo!.getAttribute("position");
    expect(pos.count).toBeGreaterThan(8);
    // Vertices should stay near the radius-2 arc (plus 0.02 inward offset → r≈1.98),
    // not collapse onto the chord bounding box (x=4..6, y=0..2 as a flat diagonal).
    let nearArc = 0;
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const y = pos.getZ(i);
      const r = Math.hypot(x - 4, y - 0);
      if (Math.abs(r - 1.98) < 0.08) nearArc += 1;
    }
    expect(nearArc).toBe(pos.count);
    geo!.dispose();
  });
});

describe("ceiling geometry", () => {
  it("places a downward-facing ceiling at room height, aligned with the floor plan", () => {
    const room = lShapedRoom();
    const elev = 0.5;
    const ceiling = createCeilingGeometry(room, elev);
    const floor = createFloorGeometry(room, elev);
    expect(ceiling).not.toBeNull();
    expect(floor).not.toBeNull();
    ceiling!.computeBoundingBox();
    floor!.computeBoundingBox();
    const cb = ceiling!.boundingBox!;
    const fb = floor!.boundingBox!;
    const expectedY = elev + room.heightM - 0.002;
    expect(cb.min.y).toBeCloseTo(expectedY, 5);
    expect(cb.max.y).toBeCloseTo(expectedY, 5);
    expect(cb.min.x).toBeCloseTo(fb.min.x, 5);
    expect(cb.max.x).toBeCloseTo(fb.max.x, 5);
    expect(cb.min.z).toBeCloseTo(fb.min.z, 5);
    expect(cb.max.z).toBeCloseTo(fb.max.z, 5);

    const normals = ceiling!.getAttribute("normal");
    expect(normals).toBeTruthy();
    let ny = 0;
    for (let i = 0; i < normals!.count; i += 1) ny += normals!.getY(i);
    expect(ny / normals!.count).toBeLessThan(-0.9);
  });
});


describe("false-colour exterior facing and scale", () => {
  it("points wall false-colour normals inward so FrontSide is hidden from outside", () => {
    // South edge of a CCW room: (0,0)→(4,0), inward is +Y (Three.js +Z).
    const wall = fakeWall(
      "south",
      "r1",
      "Wall 1",
      [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ],
      [{ x: 0, y: 1 }],
      4
    );
    const geo = createWallFalseColorGeometry(wall, 0, 0.02);
    expect(geo).not.toBeNull();
    const normals = geo!.getAttribute("normal");
    let nz = 0;
    for (let i = 0; i < normals.count; i += 1) nz += normals.getZ(i);
    expect(nz / normals.count).toBeGreaterThan(0.9);
    geo!.dispose();
  });

  it("recolours workplane vertices when the legend scale changes", () => {
    const room: RoomV2 = { ...lShapedRoom(), polygon: rectPolygon(0, 0, 4, 4) };
    const results = gridFor(room, 200);
    const wide = createClippedWorkplaneGeometry(room, results, 0, { minLux: 0, maxLux: 1000 });
    const tight = createClippedWorkplaneGeometry(room, results, 0, { minLux: 100, maxLux: 250 });
    expect(wide).not.toBeNull();
    expect(tight).not.toBeNull();
    const cWide = wide!.getAttribute("color");
    const cTight = tight!.getAttribute("color");
    expect(cWide.getX(0)).not.toBeCloseTo(cTight.getX(0), 3);
    const expected = luxToRgb(200, { minLux: 100, maxLux: 250 });
    expect(cTight.getX(0)).toBeCloseTo(expected[0], 5);
    expect(cTight.getY(0)).toBeCloseTo(expected[1], 5);
    expect(cTight.getZ(0)).toBeCloseTo(expected[2], 5);
    wide!.dispose();
    tight!.dispose();
  });

  it("keeps false-colour wall shells nearly opaque so the exterior stays uncoloured", () => {
    expect(wallShellOpacity("falsecolor")).toBe(FALSE_COLOR_WALL_SHELL_OPACITY);
    expect(FALSE_COLOR_WALL_SHELL_OPACITY).toBeGreaterThanOrEqual(0.9);
    expect(wallShellOpacity("greyscale")).toBeLessThan(FALSE_COLOR_WALL_SHELL_OPACITY);
  });
});

describe("plan handedness in a south look-down", () => {
  it("puts a west/north room on the left and above a south room, matching Top", () => {
    const meeting = { x: 5.27, y: 12.7 };
    const office = { x: 28, y: 5 };
    const reception = { x: 5, y: 3 };
    const scene = {
      schemaVersion: 2,
      storeys: [{ id: "s1", name: "L9M", elevationM: 0, heightM: 2.8 }],
      rooms: [
        { ...lShapedRoom(), id: "meet", name: "Meeting", storeyId: "s1", polygon: [
          { x: 0.5, y: 10.3 }, { x: 10, y: 10.3 }, { x: 10, y: 15.1 }, { x: 0.5, y: 15.1 },
        ] },
        { ...lShapedRoom(), id: "off", name: "Open Office", storeyId: "s1", polygon: [
          { x: 10, y: 0.5 }, { x: 29, y: 0.5 }, { x: 29, y: 10 }, { x: 10, y: 10 },
        ] },
      ],
      instances: [],
      ui: { activeStoreyId: "s1", activeRoomId: null },
    } as unknown as ProjectSceneV2;

    const view = editorOverviewCamera(scene, "s1");
    expect(view.position[2]).toBeLessThan(view.target[2]);

    const { root, content } = createPlanHandednessRoot(view.target[0]);
    const marker = (name: string, x: number, y: number) => {
      const g = new THREE.Object3D();
      g.name = name;
      g.position.set(x, 1.2, y);
      content.add(g);
    };
    marker("meeting", meeting.x, meeting.y);
    marker("office", office.x, office.y);
    marker("reception", reception.x, reception.y);
    expect(mirrorPlanX(meeting.x, view.target[0])).toBeCloseTo(2 * view.target[0] - meeting.x);

    root.updateMatrixWorld(true);
    const cam = new THREE.PerspectiveCamera(45, 16 / 9, 0.05, 800);
    cam.position.set(...view.position);
    cam.up.set(0, 1, 0);
    cam.lookAt(...view.target);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();

    const ndc = (name: string) => {
      const obj = content.getObjectByName(name)!;
      const v = new THREE.Vector3();
      obj.getWorldPosition(v);
      v.project(cam);
      return v;
    };
    const m = ndc("meeting");
    const o = ndc("office");
    const r = ndc("reception");
    expect(m.x).toBeLessThan(o.x);
    expect(m.y).toBeGreaterThan(r.y);
  });
});
