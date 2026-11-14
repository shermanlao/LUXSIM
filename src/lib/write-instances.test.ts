import { describe, expect, it, vi } from "vitest";
import type { PhotometricData } from "@luxsim/photometry";
import {
  defaultSceneV2,
  rectPolygon,
  type CalcResults,
  type WallSurfaceResult,
} from "@luxsim/project-io";
import {
  clearResultsForRooms,
  mergeInstanceDrafts,
  writeFixtureInstances,
} from "./write-instances";

function workplane(eave: number): CalcResults {
  return {
    version: 1,
    summary: { eave, emin: eave, emax: eave, uo: 1, ugr: 1, lpd: 1 },
    grid: { originX: 0, originY: 0, spacing: 1, nx: 1, ny: 1, z: 0.75, lux: [eave] },
  };
}

function stubWalls(roomId: string, eave: number): WallSurfaceResult[] {
  return [
    {
      id: `${roomId}-wall`,
      roomId,
      name: `${roomId} wall`,
      polyline: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      normals: [{ x: 0, y: 1 }],
      heightM: 2.8,
      insetM: 0.05,
      normal: { x: 0, y: 1 },
      widthM: 1,
      curved: false,
      grid: { originU: 0, originV: 0, spacing: 0.5, nu: 1, nv: 1, lux: [eave] },
      summary: { eave, emin: eave, emax: eave, uo: 1, areaM2: 2.8 },
    },
  ];
}

describe("writeFixtureInstances", () => {
  it("batch-writes instances and clears room results", async () => {
    let scene = defaultSceneV2();
    const roomId = "room_batch";
    scene = {
      ...scene,
      rooms: [
        {
          id: roomId,
          storeyId: scene.ui.activeStoreyId,
          name: "Batch",
          polygon: rectPolygon(0, 0, 6, 6),
          heightM: 2.8,
          workplaneHeightM: 0.75,
          reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
          calc: { gridSpacing: 0.5, maintenanceFactor: 0.8, en12464TemplateId: "" },
        },
      ],
      fixtureLibraryIds: ["lum_1"],
    };
    const results = {
      version: 2 as const,
      byRoomId: {
        [roomId]: {
          version: 1,
          summary: { eave: 100, emin: 80, emax: 120, uo: 0.8, ugr: 19, lpd: 1 },
          grid: {
            originX: 0,
            originY: 0,
            spacing: 0.5,
            nx: 1,
            ny: 1,
            z: 0.75,
            lux: [100],
          },
        },
      },
    };

    const drafts = Array.from({ length: 10 }, (_, i) => ({
      luminaireId: "lum_1",
      storeyId: scene.ui.activeStoreyId,
      roomId,
      name: `L${i + 1}`,
      position: { x: 1 + i * 0.4, y: 1, z: 2.7 },
      rotationDeg: 0,
    }));

    const out = await writeFixtureInstances(
      {
        scene,
        results,
        drafts,
        options: { runCalc: false, calcScope: "room" },
      },
      {
        ensurePhotometry: async () => ({}) as PhotometricData,
        getWatts: () => 30,
      }
    );

    expect(out.scene.instances).toHaveLength(10);
    expect(out.results.byRoomId[roomId]).toBeUndefined();
    expect(out.instanceIds).toHaveLength(10);
  });

  it("runCalc invokes solver hook for affected room", async () => {
    let scene = defaultSceneV2();
    const roomId = "room_calc";
    scene = {
      ...scene,
      rooms: [
        {
          id: roomId,
          storeyId: scene.ui.activeStoreyId,
          name: "Calc",
          polygon: rectPolygon(0, 0, 4, 4),
          heightM: 2.8,
          workplaneHeightM: 0.75,
          reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
          calc: { gridSpacing: 0.5, maintenanceFactor: 0.8, en12464TemplateId: "" },
        },
      ],
      fixtureLibraryIds: ["lum_1"],
      instances: [],
    };

    const runSolver = vi.fn(async () => ({
      version: 1 as const,
      summary: { eave: 200, emin: 150, emax: 250, uo: 0.75, ugr: 18, lpd: 2 },
      grid: {
        originX: 0,
        originY: 0,
        spacing: 0.5,
        nx: 2,
        ny: 2,
        z: 0.75,
        lux: [200, 200, 200, 200],
      },
    }));

    const out = await writeFixtureInstances(
      {
        scene,
        results: { version: 2, byRoomId: {} },
        drafts: [
          {
            luminaireId: "lum_1",
            storeyId: scene.ui.activeStoreyId,
            roomId,
            name: "A",
            position: { x: 2, y: 2, z: 2.7 },
            rotationDeg: 0,
          },
        ],
        options: { runCalc: true, calcScope: "room" },
      },
      {
        ensurePhotometry: async () => ({}) as PhotometricData,
        getWatts: () => 30,
        runSolver,
      }
    );

    expect(runSolver).toHaveBeenCalledTimes(1);
    expect(out.results.byRoomId[roomId]?.summary.eave).toBe(200);
  });

  it("keeps instances when post-place calc fails", async () => {
    let scene = defaultSceneV2();
    const roomId = "room_calc_fail";
    scene = {
      ...scene,
      rooms: [
        {
          id: roomId,
          storeyId: scene.ui.activeStoreyId,
          name: "Calc",
          polygon: rectPolygon(0, 0, 4, 4),
          heightM: 2.8,
          workplaneHeightM: 0.75,
          reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
          calc: { gridSpacing: 0.5, maintenanceFactor: 0.8, en12464TemplateId: "" },
        },
      ],
      fixtureLibraryIds: ["lum_1"],
      instances: [],
    };

    const out = await writeFixtureInstances(
      {
        scene,
        results: { version: 2, byRoomId: {} },
        drafts: [
          {
            luminaireId: "lum_1",
            storeyId: scene.ui.activeStoreyId,
            roomId,
            name: "A",
            position: { x: 2, y: 2, z: 2.7 },
            rotationDeg: 0,
          },
        ],
        options: { runCalc: true, calcScope: "room" },
      },
      {
        ensurePhotometry: async () => ({}) as PhotometricData,
        getWatts: () => 30,
        runSolver: vi.fn(async () => {
          throw new Error("solver fail");
        }),
      }
    );

    expect(out.scene.instances).toHaveLength(1);
    expect(out.calcFailed).toBe(true);
    expect(out.results.byRoomId[roomId]).toBeUndefined();
  });

  it("placement without calc keeps other rooms' wall and workplane results", async () => {
    let scene = defaultSceneV2();
    const roomA = "room_place";
    const roomB = "room_keep";
    const room = (id: string, name: string) => ({
      id,
      storeyId: scene.ui.activeStoreyId,
      name,
      polygon: rectPolygon(0, 0, 6, 6),
      heightM: 2.8,
      workplaneHeightM: 0.75,
      reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
      calc: { gridSpacing: 0.5, maintenanceFactor: 0.8, en12464TemplateId: "" },
    });
    scene = {
      ...scene,
      rooms: [room(roomA, "Place"), room(roomB, "Keep")],
      fixtureLibraryIds: ["lum_1"],
    };
    const wallsA = stubWalls(roomA, 111);
    const wallsB = stubWalls(roomB, 222);
    const results = {
      version: 2 as const,
      byRoomId: {
        [roomA]: workplane(111),
        [roomB]: workplane(222),
      },
      wallsByRoomId: {
        [roomA]: wallsA,
        [roomB]: wallsB,
      },
    };

    const out = await writeFixtureInstances(
      {
        scene,
        results,
        drafts: [
          {
            luminaireId: "lum_1",
            storeyId: scene.ui.activeStoreyId,
            roomId: roomA,
            name: "L1",
            position: { x: 1, y: 1, z: 2.7 },
            rotationDeg: 0,
          },
        ],
        options: { runCalc: false, calcScope: "room" },
      },
      {
        ensurePhotometry: async () => ({}) as PhotometricData,
        getWatts: () => 30,
      }
    );

    expect(out.results.byRoomId[roomA]).toBeUndefined();
    expect(out.results.wallsByRoomId?.[roomA]).toBeUndefined();
    expect(out.results.byRoomId[roomB]?.summary.eave).toBe(222);
    expect(out.results.wallsByRoomId?.[roomB]).toBe(wallsB);
    expect(results.wallsByRoomId[roomB]).toBe(wallsB);
  });
});

describe("clearResultsForRooms", () => {
  it("removes only listed rooms", () => {
    const next = clearResultsForRooms(
      {
        version: 2,
        byRoomId: {
          a: workplane(1),
          b: workplane(2),
        },
      },
      ["a"]
    );
    expect(next.byRoomId.a).toBeUndefined();
    expect(next.byRoomId.b).toBeDefined();
    expect(next.wallsByRoomId).toBeUndefined();
  });

  it("clears workplane and wall results for listed rooms only", () => {
    const wallsA = stubWalls("a", 10);
    const wallsB = stubWalls("b", 20);
    const original = {
      version: 2 as const,
      byRoomId: {
        a: workplane(1),
        b: workplane(2),
      },
      wallsByRoomId: {
        a: wallsA,
        b: wallsB,
      },
    };
    const next = clearResultsForRooms(original, ["a"]);
    expect(next.byRoomId.a).toBeUndefined();
    expect(next.byRoomId.b?.summary.eave).toBe(2);
    expect(next.wallsByRoomId?.a).toBeUndefined();
    expect(next.wallsByRoomId?.b).toBe(wallsB);
    // Input is not mutated; a partial clear must not wipe another room's walls.
    expect(original.byRoomId.a).toBeDefined();
    expect(original.wallsByRoomId.a).toBe(wallsA);
    expect(original.wallsByRoomId.b).toBe(wallsB);
  });

  it("clears every listed room when the set is the whole project", () => {
    const next = clearResultsForRooms(
      {
        version: 2,
        byRoomId: { a: workplane(1), b: workplane(2) },
        wallsByRoomId: { a: stubWalls("a", 10), b: stubWalls("b", 20) },
      },
      ["a", "b"]
    );
    expect(next.byRoomId).toEqual({});
    expect(next.wallsByRoomId).toEqual({});
  });
});

describe("mergeInstanceDrafts", () => {
  it("replaceRoomInstances clears room fixtures first", () => {
    const scene = defaultSceneV2();
    const roomId = "r1";
    const withOld = {
      ...scene,
      instances: [
        {
          instanceId: "old",
          luminaireId: "lum_1",
          storeyId: scene.ui.activeStoreyId,
          roomId,
          name: "Old",
          position: { x: 1, y: 1, z: 2.7 },
          rotationDeg: 0,
        },
      ],
    };
    const { scene: merged } = mergeInstanceDrafts(
      withOld,
      [
        {
          luminaireId: "lum_1",
          storeyId: scene.ui.activeStoreyId,
          roomId,
          name: "New",
          position: { x: 2, y: 2, z: 2.7 },
          rotationDeg: 90,
        },
      ],
      { replaceRoomInstances: true }
    );
    expect(merged.instances).toHaveLength(1);
    expect(merged.instances[0]!.name).toBe("New");
  });
});
