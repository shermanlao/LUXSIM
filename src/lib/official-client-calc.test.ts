import { describe, expect, it, vi } from "vitest";
import { defaultSceneV2, rectPolygon } from "@luxsim/project-io";
import type { PhotometricData } from "@luxsim/photometry";
import type { ProjectSceneV2, ResultsV2, RoomV2 } from "@luxsim/project-io";
import { runOfficialClientCalc } from "./official-client-calc";
import { runPostPlaceCalcForRooms } from "./post-place-calc";

function room(id: string, name: string, storeyId: string): RoomV2 {
  return {
    id,
    storeyId,
    name,
    polygon: rectPolygon(0, 0, 4, 4),
    heightM: 2.8,
    workplaneHeightM: 0.75,
    reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
    calc: { gridSpacing: 0.5, interreflection: false, bounces: 0, computeUgr: false },
  };
}

function fixture(
  id: string,
  roomId: string,
  storeyId: string,
  luminaireId: string
): ProjectSceneV2["instances"][number] {
  return {
    instanceId: id,
    luminaireId,
    storeyId,
    roomId,
    name: `F-${id}`,
    position: { x: 1, y: 1, z: 2.7 },
    rotationDeg: 0,
  };
}

function sceneWith(
  rooms: RoomV2[],
  instances: ProjectSceneV2["instances"],
  activeRoomId: string | null
): ProjectSceneV2 {
  const base = defaultSceneV2();
  const storeyId = base.ui.activeStoreyId;
  return {
    ...base,
    rooms: rooms.map((r) => ({ ...r, storeyId })),
    instances: instances.map((i) => ({ ...i, storeyId })),
    ui: { ...base.ui, activeRoomId },
  };
}

function fakeResult(eave: number): ResultsV2["byRoomId"][string] {
  return {
    version: 1,
    summary: { eave, emin: eave * 0.8, emax: eave * 1.2, uo: 0.8, ugr: 17, lpd: 1.5 },
    grid: {
      originX: 0,
      originY: 0,
      spacing: 0.5,
      nx: 1,
      ny: 1,
      z: 0.75,
      lux: [eave],
    },
  };
}

function solverForEave(eave: number) {
  return vi.fn(async () => ({
    version: 1 as const,
    summary: { eave, emin: eave * 0.8, emax: eave * 1.2, uo: 0.8, ugr: 17, lpd: 1.5 },
    grid: {
      originX: 0,
      originY: 0,
      spacing: 0.5,
      nx: 1,
      ny: 1,
      z: 0.75,
      lux: [eave],
    },
  }));
}

const photo = {} as PhotometricData;

describe("runOfficialClientCalc — Calc all missing photometry", () => {
  it("skips a room missing photometry, writes the others, and still explains empty rooms", async () => {
    const storey = defaultSceneV2().ui.activeStoreyId;
    const priorMissing: ResultsV2 = {
      version: 2,
      byRoomId: { r_missing: fakeResult(42) },
    };
    const instances = [
      fixture("i_ok", "r_ok", storey, "lum_ok"),
      fixture("i_missing", "r_missing", storey, "lum_missing"),
    ];
    const scene = sceneWith(
      [
        room("r_empty", "Empty", storey),
        room("r_ok", "Lit", storey),
        room("r_missing", "Broken", storey),
      ],
      instances,
      "r_empty"
    );
    const snapshot = structuredClone(scene.instances);

    const runSolver = solverForEave(150);
    const ensurePhotometry = vi.fn(async (id: string) => (id === "lum_ok" ? photo : null));

    const out = await runOfficialClientCalc(scene, priorMissing, true, {
      ensurePhotometry,
      getWatts: () => 30,
      runSolver,
    });

    expect(out.ok).toBe(true);
    expect(out.calculatedRoomIds).toEqual(["r_ok"]);
    expect(out.results.byRoomId.r_ok?.summary.eave).toBe(150);
    // Must not invent a result for the skipped room, nor wipe its previous value.
    expect(out.results.byRoomId.r_missing?.summary.eave).toBe(42);
    expect(out.results.byRoomId.r_empty).toBeUndefined();
    expect(out.skippedEmpty.map((s) => s.name)).toEqual(["Empty"]);
    expect(out.skippedMissing.map((s) => s.name)).toEqual(["Broken"]);
    expect(out.status).toContain("Calculation complete (client-side)");
    expect(out.status).toContain("skipped Empty (no fixtures)");
    expect(out.status).toContain("Broken (missing photometry)");
    expect(out.status).not.toMatch(/no rooms have fixtures/i);
    expect(runSolver).toHaveBeenCalledTimes(1);
    expect(scene.instances).toEqual(snapshot);
  });

  it("does not abort the whole plan or leave calculable rooms unwritten", async () => {
    const storey = defaultSceneV2().ui.activeStoreyId;
    const scene = sceneWith(
      [room("r1", "Office", storey), room("r2", "Store", storey)],
      [
        fixture("i1", "r1", storey, "lum_ok"),
        fixture("i2", "r2", storey, "lum_missing"),
      ],
      "r1"
    );
    const empty: ResultsV2 = { version: 2, byRoomId: {} };
    const runSolver = solverForEave(180);

    const out = await runOfficialClientCalc(scene, empty, true, {
      ensurePhotometry: async (id) => (id === "lum_ok" ? photo : null),
      getWatts: () => 18,
      runSolver,
    });

    expect(out.ok).toBe(true);
    expect(out.results.byRoomId.r1?.summary.eave).toBe(180);
    expect(out.results.byRoomId.r2).toBeUndefined();
    expect(out.skippedMissing.map((s) => s.id)).toEqual(["r2"]);
  });

  it("skips a room if any of its luminaires lacks photometry, without calculating the rest of that room", async () => {
    const storey = defaultSceneV2().ui.activeStoreyId;
    const scene = sceneWith(
      [room("r_mix", "Mixed", storey), room("r_ok", "Lit", storey)],
      [
        fixture("i_a", "r_mix", storey, "lum_ok"),
        fixture("i_b", "r_mix", storey, "lum_missing"),
        fixture("i_c", "r_ok", storey, "lum_ok"),
      ],
      "r_ok"
    );
    const runSolver = solverForEave(200);

    const out = await runOfficialClientCalc(
      scene,
      { version: 2, byRoomId: {} },
      true,
      {
        ensurePhotometry: async (id) => (id === "lum_ok" ? photo : null),
        getWatts: () => 30,
        runSolver,
      }
    );

    expect(out.ok).toBe(true);
    expect(out.calculatedRoomIds).toEqual(["r_ok"]);
    expect(out.results.byRoomId.r_ok?.summary.eave).toBe(200);
    expect(out.results.byRoomId.r_mix).toBeUndefined();
    expect(out.skippedMissing[0]?.missingLuminaireIds).toEqual(["lum_missing"]);
    expect(runSolver).toHaveBeenCalledTimes(1);
  });

  it("fails Calc all clearly when every room with fixtures lacks photometry, and writes no rooms", async () => {
    const storey = defaultSceneV2().ui.activeStoreyId;
    const scene = sceneWith(
      [room("r_empty", "Empty", storey), room("r_missing", "Broken", storey)],
      [fixture("i1", "r_missing", storey, "lum_missing")],
      "r_missing"
    );
    const runSolver = solverForEave(999);

    const out = await runOfficialClientCalc(
      scene,
      { version: 2, byRoomId: {} },
      true,
      {
        ensurePhotometry: async () => null,
        getWatts: () => 30,
        runSolver,
      },
      { luminaireNames: { lum_missing: "Downlight A" } }
    );

    expect(out.ok).toBe(false);
    expect(out.calculatedRoomIds).toEqual([]);
    expect(out.results.byRoomId).toEqual({});
    expect(out.status).toMatch(/Missing photometry — upload IES\/LDT: Downlight A/);
    expect(out.status).not.toMatch(/Calculation complete/);
    expect(runSolver).not.toHaveBeenCalled();
  });
});

describe("runOfficialClientCalc — Calc room and empty-room behaviour", () => {
  it("fails a direct Calc room request clearly when that room lacks photometry", async () => {
    const storey = defaultSceneV2().ui.activeStoreyId;
    const scene = sceneWith(
      [room("r_missing", "Office", storey), room("r_ok", "Lit", storey)],
      [
        fixture("i1", "r_missing", storey, "lum_missing"),
        fixture("i2", "r_ok", storey, "lum_ok"),
      ],
      "r_missing"
    );
    const prior: ResultsV2 = { version: 2, byRoomId: { r_ok: fakeResult(77) } };
    const snapshot = structuredClone(scene.instances);
    const runSolver = solverForEave(150);

    const out = await runOfficialClientCalc(scene, prior, false, {
      ensurePhotometry: async (id) => (id === "lum_ok" ? photo : null),
      getWatts: () => 30,
      runSolver,
    });

    expect(out.ok).toBe(false);
    expect(out.status).toMatch(/Missing photometry/);
    expect(out.status).not.toMatch(/Calculation complete/);
    expect(out.status).not.toMatch(/skipped/);
    expect(out.results.byRoomId.r_missing).toBeUndefined();
    expect(out.results.byRoomId.r_ok?.summary.eave).toBe(77);
    expect(out.calculatedRoomIds).toEqual([]);
    expect(runSolver).not.toHaveBeenCalled();
    expect(scene.instances).toEqual(snapshot);
  });

  it("still skips empty rooms in Calc all and explains them when every remaining room is calculable", async () => {
    const storey = defaultSceneV2().ui.activeStoreyId;
    const scene = sceneWith(
      [room("r1", "Empty", storey), room("r2", "Lit", storey)],
      [fixture("i1", "r2", storey, "lum_ok")],
      "r1"
    );
    const runSolver = solverForEave(120);

    const out = await runOfficialClientCalc(
      scene,
      { version: 2, byRoomId: {} },
      true,
      {
        ensurePhotometry: async () => photo,
        getWatts: () => 30,
        runSolver,
      }
    );

    expect(out.ok).toBe(true);
    expect(out.results.byRoomId.r2?.summary.eave).toBe(120);
    expect(out.results.byRoomId.r1).toBeUndefined();
    expect(out.status).toBe(
      "Calculation complete (client-side) / 客戶端計算完成 · skipped Empty (no fixtures)"
    );
  });

  it("still errors when Calc all has only empty rooms", async () => {
    const storey = defaultSceneV2().ui.activeStoreyId;
    const scene = sceneWith(
      [room("r1", "A", storey), room("r2", "B", storey)],
      [],
      "r1"
    );
    const out = await runOfficialClientCalc(
      scene,
      { version: 2, byRoomId: {} },
      true,
      {
        ensurePhotometry: async () => photo,
        getWatts: () => 30,
        runSolver: solverForEave(1),
      }
    );
    expect(out.ok).toBe(false);
    expect(out.started).toBe(false);
    expect(out.status).toBe("No rooms have fixtures to calculate");
    expect(out.results.byRoomId).toEqual({});
  });
});

describe("runPostPlaceCalcForRooms default path is unchanged", () => {
  it("still fails the whole batch and writes no rooms when any requested room lacks photometry", async () => {
    const storey = defaultSceneV2().ui.activeStoreyId;
    const scene = sceneWith(
      [room("r_ok", "Lit", storey), room("r_missing", "Broken", storey)],
      [
        fixture("i1", "r_ok", storey, "lum_ok"),
        fixture("i2", "r_missing", storey, "lum_missing"),
      ],
      "r_ok"
    );
    const runSolver = solverForEave(150);

    const out = await runPostPlaceCalcForRooms(
      scene,
      { version: 2, byRoomId: {} },
      ["r_ok", "r_missing"],
      {
        ensurePhotometry: async (id) => (id === "lum_ok" ? photo : null),
        getWatts: () => 30,
        runSolver,
      }
    );

    expect(out.calcFailed).toBe(true);
    expect(out.results.byRoomId.r_ok).toBeUndefined();
    expect(out.results.byRoomId.r_missing).toBeUndefined();
    expect(runSolver).not.toHaveBeenCalled();
  });
});
