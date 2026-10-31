import { describe, expect, it } from "vitest";
import { defaultSceneV2, migrateSceneV1toV2, normalizeScene } from "./migrate";
import type { SceneJson } from "./types";
import { pointInPolygon, findRoomAt } from "./geometry";
import { rectPolygon } from "./geometry";

const v1: SceneJson = {
  version: 1,
  room: {
    width: 8,
    depth: 6,
    height: 2.8,
    reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
    workplaneHeight: 0.75,
  },
  gridSpacing: 0.5,
  luminaires: [
    {
      instanceId: "i1",
      luminaireId: "lum1",
      name: "DL",
      position: { x: 2, y: 2, z: 2.6 },
      rotationDeg: 0,
    },
  ],
  calcOptions: { interreflection: true, bounces: 2, computeUgr: true },
};

describe("migrateSceneV1toV2", () => {
  it("wraps room and instances", () => {
    const v2 = migrateSceneV1toV2(v1);
    expect(v2.version).toBe(2);
    expect(v2.storeys).toHaveLength(1);
    expect(v2.rooms).toHaveLength(1);
    expect(v2.instances).toHaveLength(1);
    expect(v2.fixtureLibraryIds).toContain("lum1");
    expect(v2.instances[0]!.roomId).toBe(v2.rooms[0]!.id);
  });

  it("normalizeScene upgrades v1", () => {
    const n = normalizeScene(v1);
    expect(n.version).toBe(2);
  });

  it("defaultSceneV2 has no rooms/instances", () => {
    const d = defaultSceneV2();
    expect(d.rooms).toHaveLength(0);
    expect(d.instances).toHaveLength(0);
    expect(d.fixtureLibraryIds).toHaveLength(0);
  });

  it("normalizeScene preserves viewMode and camera3d", () => {
    const base = defaultSceneV2();
    const n = normalizeScene({
      ...base,
      ui: {
        ...base.ui,
        viewMode: "persp3d",
        camera3d: {
          position: [1, 2, 3],
          target: [4, 5, 6],
        },
      },
    });
    expect(n.ui.viewMode).toBe("persp3d");
    expect(n.ui.camera3d).toEqual({
      position: [1, 2, 3],
      target: [4, 5, 6],
    });
  });
});

describe("geometry", () => {
  it("pointInPolygon", () => {
    const poly = rectPolygon(0, 0, 4, 3);
    expect(pointInPolygon({ x: 1, y: 1 }, poly)).toBe(true);
    expect(pointInPolygon({ x: 5, y: 1 }, poly)).toBe(false);
  });

  it("findRoomAt", () => {
    const room = {
      id: "r1",
      storeyId: "s1",
      name: "A",
      polygon: rectPolygon(0, 0, 4, 3),
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
    expect(findRoomAt([room], "s1", { x: 1, y: 1 })?.id).toBe("r1");
    expect(findRoomAt([room], "s1", { x: 9, y: 9 })).toBeNull();
  });
});
