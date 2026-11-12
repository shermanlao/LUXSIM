import { describe, expect, it } from "vitest";
import { rectPolygon } from "./geometry";
import {
  defaultDisplay3d,
  fitOverviewCamera,
  fitRoomCamera,
  isLegacyNortheastOrbit,
  projectLuxRange,
  resolveEditorCamera,
  storeyCenter,
} from "./scene-3d";
import type { ProjectSceneV2, ResultsV2, RoomV2 } from "./types";
import type { CalcResults } from "../../solver/src/types";

function stubResults(partial: { emin: number; emax: number; eave?: number }): CalcResults {
  const eave = partial.eave ?? (partial.emin + partial.emax) / 2;
  return {
    version: 1,
    grid: { nx: 1, ny: 1, spacing: 0.5, originX: 0, originY: 0, z: 0.75, lux: [eave] },
    summary: { eave, emin: partial.emin, emax: partial.emax, uo: 0.7, areaM2: 10, totalWatts: 0, lpd: null, ugr: null },
    meta: { interreflection: false, bounces: 0, calculatedAt: "2026-01-01T00:00:00Z", disclaimer: "" },
  };
}

function office(): RoomV2 {
  return {
    id: "r1",
    storeyId: "s1",
    name: "Office",
    polygon: rectPolygon(0, 0, 6, 5),
    heightM: 2.8,
    workplaneHeightM: 0.75,
    reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
    calc: { gridSpacing: 0.5, interreflection: false, bounces: 0, computeUgr: false },
  };
}

describe("scene-3d camera and range helpers", () => {
  it("defaults to false colour when results exist and no stored preference", () => {
    const results: ResultsV2 = {
      version: 2,
      byRoomId: {
        r1: stubResults({ emin: 80, emax: 200, eave: 100 }),
      },
    };
    expect(defaultDisplay3d(results, undefined)).toBe("falsecolor");
    expect(defaultDisplay3d(results, "greyscale")).toBe("greyscale");
    expect(defaultDisplay3d({ version: 2, byRoomId: {} }, undefined)).toBe("greyscale");
  });

  it("computes a project-wide lux range from every room", () => {
    const results: ResultsV2 = {
      version: 2,
      byRoomId: {
        a: stubResults({ emin: 56, emax: 120, eave: 80 }),
        b: stubResults({ emin: 200, emax: 500, eave: 400 }),
      },
    };
    expect(projectLuxRange(results)).toEqual({ emin: 56, emax: 500 });
  });

  it("places the overview camera on the low-Y side so high-Y is toward the top of the frame", () => {
    const scene: ProjectSceneV2 = {
      version: 2,
      storeys: [{ id: "s1", name: "L9M", elevationM: 0, heightM: 2.8 }],
      rooms: [office()],
      underlays: [],
      fixtureLibraryIds: [],
      instances: [],
      ui: { activeStoreyId: "s1", activeRoomId: "r1", viewMode: "persp3d", tool: "select" },
    };
    const cam = fitOverviewCamera(scene);
    const targetY = cam.target[2];
    const camY = cam.position[2];
    expect(camY).toBeLessThan(targetY);
    expect(cam.position[1]).toBeGreaterThan(cam.target[1]);
    expect(cam.up).toEqual([0, 0, 1]);
  });

  it("frames a single room tightly relative to the project overview", () => {
    const room = office();
    const roomCam = fitRoomCamera(room, 0);
    const scene: ProjectSceneV2 = {
      version: 2,
      storeys: [{ id: "s1", name: "L9M", elevationM: 0, heightM: 2.8 }],
      rooms: [
        room,
        {
          ...room,
          id: "r2",
          name: "Hall",
          polygon: rectPolygon(20, 0, 8, 12),
        },
      ],
      underlays: [],
      fixtureLibraryIds: [],
      instances: [],
      ui: { activeStoreyId: "s1", activeRoomId: "r1", viewMode: "persp3d", tool: "select" },
    };
    const overview = fitOverviewCamera(scene);
    const roomDist = Math.hypot(
      roomCam.position[0] - roomCam.target[0],
      roomCam.position[1] - roomCam.target[1],
      roomCam.position[2] - roomCam.target[2]
    );
    const overDist = Math.hypot(
      overview.position[0] - overview.target[0],
      overview.position[1] - overview.target[1],
      overview.position[2] - overview.target[2]
    );
    expect(roomDist).toBeLessThan(overDist);
  });
});

describe("editor 3D camera orientation", () => {
  function sceneWithOffice(): ProjectSceneV2 {
    return {
      version: 2,
      storeys: [{ id: "s1", name: "L9M", elevationM: 0, heightM: 2.8 }],
      rooms: [office()],
      underlays: [],
      fixtureLibraryIds: [],
      instances: [],
      ui: { activeStoreyId: "s1", activeRoomId: "r1", viewMode: "persp3d", tool: "select" },
    };
  }

  it("replaces the legacy north-east default with a south-facing plan-aligned view", () => {
    const scene = sceneWithOffice();
    const center = storeyCenter(scene);
    const legacy = {
      position: [center.x + 8, center.z + 6, center.y + 8] as [number, number, number],
      target: [center.x, center.z, center.y] as [number, number, number],
    };
    expect(isLegacyNortheastOrbit(legacy, center)).toBe(true);
    const resolved = resolveEditorCamera(legacy, scene);
    expect(resolved.position[2]).toBeLessThan(resolved.target[2]);
    expect(isLegacyNortheastOrbit(resolved, center)).toBe(false);
  });

  it("keeps a camera the user has actually orbited", () => {
    const scene = sceneWithOffice();
    const stored = {
      position: [1, 12, -20] as [number, number, number],
      target: [3, 1, 2] as [number, number, number],
    };
    expect(resolveEditorCamera(stored, scene)).toEqual(stored);
  });
});
