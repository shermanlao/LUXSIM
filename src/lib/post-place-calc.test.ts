import { describe, expect, it, vi } from "vitest";
import { defaultSceneV2, rectPolygon } from "@luxsim/project-io";
import type { PhotometricData } from "@luxsim/photometry";
import {
  focusActiveRoomAfterPlacement,
  runPostPlaceCalcForRooms,
} from "./post-place-calc";

describe("runPostPlaceCalcForRooms", () => {
  it("flags missing photometry without throwing", async () => {
    const scene = defaultSceneV2();
    const roomId = "r1";
    const withInst = {
      ...scene,
      rooms: [
        {
          id: roomId,
          storeyId: scene.ui.activeStoreyId,
          name: "R",
          polygon: rectPolygon(0, 0, 4, 4),
          heightM: 2.8,
          workplaneHeightM: 0.75,
          reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
          calc: { gridSpacing: 0.5, interreflection: false, bounces: 0, computeUgr: false },
        },
      ],
      instances: [
        {
          instanceId: "i1",
          luminaireId: "lum_missing",
          storeyId: scene.ui.activeStoreyId,
          roomId,
          name: "A",
          position: { x: 2, y: 2, z: 2.7 },
          rotationDeg: 0,
        },
      ],
    };

    const out = await runPostPlaceCalcForRooms(
      withInst,
      { version: 2, byRoomId: {} },
      [roomId],
      {
        ensurePhotometry: async () => null,
        getWatts: () => 30,
      }
    );

    expect(out.calcFailed).toBe(true);
    expect(out.missingLuminaireIds).toEqual(["lum_missing"]);
    expect(out.results.byRoomId[roomId]).toBeUndefined();
  });

  it("writes results when solver succeeds", async () => {
    const scene = defaultSceneV2();
    const roomId = "r_calc";
    const withInst = {
      ...scene,
      rooms: [
        {
          id: roomId,
          storeyId: scene.ui.activeStoreyId,
          name: "R",
          polygon: rectPolygon(0, 0, 4, 4),
          heightM: 2.8,
          workplaneHeightM: 0.75,
          reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
          calc: { gridSpacing: 0.5, interreflection: false, bounces: 0, computeUgr: false },
        },
      ],
      instances: [
        {
          instanceId: "i1",
          luminaireId: "lum_1",
          storeyId: scene.ui.activeStoreyId,
          roomId,
          name: "A",
          position: { x: 2, y: 2, z: 2.7 },
          rotationDeg: 0,
        },
      ],
    };

    const runSolver = vi.fn(async () => ({
      version: 1 as const,
      summary: { eave: 150, emin: 120, emax: 180, uo: 0.8, ugr: 17, lpd: 1.5 },
      grid: {
        originX: 0,
        originY: 0,
        spacing: 0.5,
        nx: 1,
        ny: 1,
        z: 0.75,
        lux: [150],
      },
    }));

    const out = await runPostPlaceCalcForRooms(
      withInst,
      { version: 2, byRoomId: {} },
      [roomId],
      {
        ensurePhotometry: async () => ({}) as PhotometricData,
        getWatts: () => 30,
        runSolver,
      }
    );

    expect(out.calcFailed).toBe(false);
    expect(out.results.byRoomId[roomId]?.summary.eave).toBe(150);
  });
});

describe("focusActiveRoomAfterPlacement", () => {
  it("selects first affected room when active room unchanged", () => {
    const scene = defaultSceneV2();
    const next = focusActiveRoomAfterPlacement(
      { ...scene, ui: { ...scene.ui, activeRoomId: null } },
      ["room_b", "room_a"]
    );
    expect(next.ui.activeRoomId).toBe("room_b");
  });
});
