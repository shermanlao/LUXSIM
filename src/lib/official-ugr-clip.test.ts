import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { parseIes } from "@luxsim/photometry";
import {
  defaultSceneV2,
  pointInPolygon,
  rectPolygon,
  roomBounds,
  ugrObserverPositionsInRoom,
  type ProjectSceneV2,
  type ResultsV2,
  type RoomV2,
  type Vec2,
} from "@luxsim/project-io";
import { calculate } from "@luxsim/solver";
import {
  computeUgr,
  defaultUgrObserverPositions,
  UGR_EYE_HEIGHT_M,
} from "../../packages/solver/src/ugr";
import { roomSpecFromV2, roomToCalcOptions } from "../../packages/project-io/src/room-adapter";
import { runClientCalcForRooms } from "./write-instances";

const fixture = readFileSync(
  path.join(process.cwd(), "fixtures/sample-downlight.ies"),
  "utf8"
);

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

function makeRoom(polygon: Vec2[], id = "room_l"): RoomV2 {
  return {
    id,
    storeyId: "storey_test",
    name: "L room",
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
  };
}

function emptyResults(): ResultsV2 {
  return { version: 2, byRoomId: {}, wallsByRoomId: {} };
}

function worldOf(room: RoomV2, local: { x: number; y: number }): Vec2 {
  const b = roomBounds(room);
  return { x: b.minX + local.x, y: b.minY + local.y };
}

describe("official calc UGR clip", () => {
  it("keeps L-room observers inside the polygon and uses clipped Ēm for Lb", async () => {
    const { data } = parseIes(fixture);
    const base = defaultSceneV2();
    const storeyId = base.ui.activeStoreyId;
    const room = { ...makeRoom(lShapedPolygon(8, -2)), storeyId };
    const b = roomBounds(room);
    const instances: ProjectSceneV2["instances"] = [
      {
        instanceId: "i1",
        luminaireId: "lum",
        storeyId,
        roomId: room.id,
        name: "DL1",
        position: { x: b.minX + 3.0, y: b.minY + 1.0, z: 2.6 },
        rotationDeg: 0,
      },
      {
        instanceId: "i2",
        luminaireId: "lum",
        storeyId,
        roomId: room.id,
        name: "DL2",
        position: { x: b.minX + 3.0, y: b.minY + 3.0, z: 2.6 },
        rotationDeg: 0,
      },
      {
        instanceId: "i3",
        luminaireId: "lum",
        storeyId,
        roomId: room.id,
        name: "DL3",
        position: { x: b.minX + 1.0, y: b.minY + 1.0, z: 2.6 },
        rotationDeg: 0,
      },
    ];
    const scene: ProjectSceneV2 = {
      ...base,
      rooms: [room],
      instances,
      fixtureLibraryIds: ["lum"],
      ui: { ...base.ui, activeRoomId: room.id, activeStoreyId: storeyId },
    };

    const defaultsOutside = defaultUgrObserverPositions(b.width, b.depth).filter(
      (p) => !pointInPolygon(worldOf(room, p), room.polygon)
    );
    expect(defaultsOutside.length).toBe(2);

    const official = await runClientCalcForRooms(scene, emptyResults(), [room.id], {
      ensurePhotometry: async () => data,
      getWatts: () => 30,
      runSolver: async (opts) => calculate(opts),
    });

    const calc = official.byRoomId[room.id];
    expect(calc).toBeDefined();
    expect(scene.instances.length).toBe(3);
    expect(calc!.ugrObservers).toHaveLength(6);
    for (const o of calc!.ugrObservers ?? []) {
      expect(o.z).toBe(UGR_EYE_HEIGHT_M);
      expect(pointInPolygon(worldOf(room, o), room.polygon)).toBe(true);
    }

    const opts = roomToCalcOptions(room, instances, { lum: data }, { lum: 30 });
    const raw = calculate(opts);
    expect(Math.abs(calc!.summary.eave - raw.summary.eave)).toBeGreaterThan(5);

    const fromClipped = computeUgr(
      roomSpecFromV2(room),
      opts.luminaires,
      calc!.summary.eave,
      ugrObserverPositionsInRoom(room)
    );
    const fromUnclipped = computeUgr(
      roomSpecFromV2(room),
      opts.luminaires,
      raw.summary.eave,
      ugrObserverPositionsInRoom(room)
    );
    expect(calc!.summary.ugr).toBeCloseTo(fromClipped.ugr, 8);
    expect(Math.abs((calc!.summary.ugr ?? 0) - fromUnclipped.ugr)).toBeGreaterThan(0.05);
  });

  it("keeps all six rectangular-room observers inside at the default layout", async () => {
    const { data } = parseIes(fixture);
    const base = defaultSceneV2();
    const storeyId = base.ui.activeStoreyId;
    const room: RoomV2 = {
      ...makeRoom(rectPolygon(0, 0, 5, 4), "room_rect"),
      name: "Rect",
      storeyId,
    };
    const instances: ProjectSceneV2["instances"] = [
      {
        instanceId: "i1",
        luminaireId: "lum",
        storeyId,
        roomId: room.id,
        name: "DL1",
        position: { x: 1.25, y: 1.0, z: 2.6 },
        rotationDeg: 0,
      },
      {
        instanceId: "i2",
        luminaireId: "lum",
        storeyId,
        roomId: room.id,
        name: "DL2",
        position: { x: 3.75, y: 3.0, z: 2.6 },
        rotationDeg: 0,
      },
    ];
    const scene: ProjectSceneV2 = {
      ...base,
      rooms: [room],
      instances,
      fixtureLibraryIds: ["lum"],
      ui: { ...base.ui, activeRoomId: room.id, activeStoreyId: storeyId },
    };
    const official = await runClientCalcForRooms(scene, emptyResults(), [room.id], {
      ensurePhotometry: async () => data,
      getWatts: () => 30,
      runSolver: async (opts) => calculate(opts),
    });
    const calc = official.byRoomId[room.id]!;
    const defaults = defaultUgrObserverPositions(5, 4);
    expect(calc.ugrObservers).toHaveLength(6);
    for (let i = 0; i < 6; i += 1) {
      const o = calc.ugrObservers![i]!;
      expect(o.z).toBe(UGR_EYE_HEIGHT_M);
      expect(o.x).toBeCloseTo(defaults[i]!.x, 10);
      expect(o.y).toBeCloseTo(defaults[i]!.y, 10);
      expect(pointInPolygon(worldOf(room, o), room.polygon)).toBe(true);
    }
    expect(scene.instances.length).toBe(2);
  });
});
