import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { buildDialuxPack } from "./dialux-pack";
import { defaultSceneV2 } from "./migrate";
import { rectPolygon } from "./geometry";
import type { SceneJson } from "./types";

function nineRoomScene() {
  const scene = defaultSceneV2();
  const storeyId = scene.storeys[0]!.id;
  const shapes = [
    [0, 0, 5, 4],
    [5.5, 0, 4, 3.5],
    [10, 0, 6, 4],
    [0, 5, 3, 6],
    [4, 5.5, 5, 5],
    [10, 5, 4, 4],
    [0, 12, 7, 3],
    [8, 11, 5, 4.5],
    [14, 10, 4, 3],
  ] as const;
  shapes.forEach(([x, y, w, d], i) => {
    scene.rooms.push({
      id: `r${i}`,
      storeyId,
      name: `Room ${i + 1}`,
      polygon: rectPolygon(x, y, w, d),
      heightM: 2.8,
      workplaneHeightM: 0.75,
      reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
      calc: {
        gridSpacing: 0.5,
        interreflection: true,
        bounces: 2,
        computeUgr: false,
      },
    });
  });
  return scene;
}

describe("buildDialuxPack", () => {
  it("exports all v2 rooms in rooms.json (not a default 8×6 rectangle)", async () => {
    const scene = nineRoomScene();
    const blob = await buildDialuxPack({
      projectName: "L9M",
      scene,
      sourceFiles: {},
      luminaireNames: {},
    });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(zip.file("rooms.json")).toBeTruthy();
    expect(zip.file("room.json")).toBeFalsy();
    const rooms = JSON.parse(await zip.file("rooms.json")!.async("string")) as {
      name: string;
      polygon: { x: number; y: number }[];
    }[];
    expect(rooms).toHaveLength(9);
    expect(rooms.map((r) => r.name)).toContain("Room 9");
    expect(rooms[0]!.polygon.length).toBeGreaterThanOrEqual(4);
    const combined = rooms.flatMap((r) => r.polygon).map((p) => `${p.x},${p.y}`).join("|");
    expect(combined).not.toContain("8,6");
  });

  it("keeps v1 room.json for legacy scenes", async () => {
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
      luminaires: [],
      calcOptions: { interreflection: true, bounces: 2, computeUgr: true },
    };
    const blob = await buildDialuxPack({
      projectName: "Legacy",
      scene: v1,
      sourceFiles: {},
      luminaireNames: {},
    });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const room = JSON.parse(await zip.file("room.json")!.async("string")) as { width: number };
    expect(room.width).toBe(8);
    expect(zip.file("rooms.json")).toBeFalsy();
  });
});
