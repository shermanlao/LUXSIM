import { describe, expect, it, vi } from "vitest";
import { defaultSceneV2, rectPolygon } from "@luxsim/project-io";
import type { PhotometricData } from "@luxsim/photometry";
import {
  clearResultsForRooms,
  mergeInstanceDrafts,
  writeFixtureInstances,
} from "./write-instances";

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
});

describe("clearResultsForRooms", () => {
  it("removes only listed rooms", () => {
    const next = clearResultsForRooms(
      {
        version: 2,
        byRoomId: {
          a: {
            version: 1,
            summary: { eave: 1, emin: 1, emax: 1, uo: 1, ugr: 1, lpd: 1 },
            grid: { originX: 0, originY: 0, spacing: 1, nx: 1, ny: 1, z: 0.75, lux: [1] },
          },
          b: {
            version: 1,
            summary: { eave: 2, emin: 2, emax: 2, uo: 1, ugr: 1, lpd: 1 },
            grid: { originX: 0, originY: 0, spacing: 1, nx: 1, ny: 1, z: 0.75, lux: [2] },
          },
        },
      },
      ["a"]
    );
    expect(next.byRoomId.a).toBeUndefined();
    expect(next.byRoomId.b).toBeDefined();
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
