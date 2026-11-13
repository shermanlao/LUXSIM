import { describe, expect, it } from "vitest";
import type { CalcResults } from "../../solver/src/types";
import { rectPolygon } from "./geometry";
import { aggregateStoreyResults } from "./storey-results";
import type { ResultsV2, RoomV2 } from "./types";

function room(id: string, name: string, width: number, depth: number, mf?: number): RoomV2 {
  return {
    id,
    storeyId: "s1",
    name,
    polygon: rectPolygon(0, 0, width, depth),
    heightM: 2.8,
    workplaneHeightM: 0.75,
    reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
    calc: {
      gridSpacing: 0.5,
      interreflection: true,
      bounces: 2,
      computeUgr: true,
      ...(mf != null ? { maintenanceFactor: mf } : {}),
    },
  };
}

function calc(
  partial: Partial<CalcResults["summary"]> & Pick<CalcResults["summary"], "eave" | "emin" | "emax" | "areaM2" | "totalWatts">
): CalcResults {
  const uo = partial.uo ?? (partial.eave > 1e-6 ? partial.emin / partial.eave : 0);
  const lpd =
    partial.lpd !== undefined
      ? partial.lpd
      : partial.totalWatts > 0 && partial.areaM2 > 0
        ? partial.totalWatts / partial.areaM2
        : null;
  return {
    version: 1,
    grid: { originX: 0, originY: 0, spacing: 0.5, nx: 1, ny: 1, z: 0.75, lux: [partial.eave] },
    summary: {
      eave: partial.eave,
      emin: partial.emin,
      emax: partial.emax,
      uo,
      ugr: partial.ugr ?? null,
      lpd,
      totalWatts: partial.totalWatts,
      areaM2: partial.areaM2,
    },
    meta: {
      interreflection: true,
      bounces: 2,
      calculatedAt: "2026-11-13T00:00:00.000Z",
      disclaimer: "test",
    },
  };
}

const office = room("r-office", "Open Office", 10, 8);
const meeting = room("r-meet", "Meeting", 5, 4);
const otherFloor = { ...room("r-other", "Other", 6, 6), storeyId: "s2" };

describe("aggregateStoreyResults", () => {
  it("returns null when the storey has no calculated rooms", () => {
    const results: ResultsV2 = { version: 2, byRoomId: {} };
    expect(aggregateStoreyResults([office, meeting], results, "s1")).toBeNull();
  });

  it("ignores rooms on another storey", () => {
    const results: ResultsV2 = {
      version: 2,
      byRoomId: { "r-other": calc({ eave: 900, emin: 800, emax: 1000, areaM2: 36, totalWatts: 100, ugr: 22 }) },
    };
    expect(aggregateStoreyResults([office, otherFloor], results, "s1")).toBeNull();
  });

  it("area-weights Ēm, takes the lowest Emin, and computes Uo and LPD", () => {
    // 80 m² at 500 lx and 20 m² at 300 lx → Ēm = (500*80 + 300*20) / 100 = 460
    const results: ResultsV2 = {
      version: 2,
      byRoomId: {
        "r-office": calc({ eave: 500, emin: 400, emax: 600, areaM2: 80, totalWatts: 400, ugr: 16, lpd: 5 }),
        "r-meet": calc({ eave: 300, emin: 180, emax: 420, areaM2: 20, totalWatts: 80, ugr: 19, lpd: 4 }),
      },
    };
    const agg = aggregateStoreyResults([office, meeting, otherFloor], results, "s1")!;
    expect(agg.results.summary.areaM2).toBeCloseTo(100);
    expect(agg.results.summary.eave).toBeCloseTo(460);
    expect(agg.results.summary.emin).toBeCloseTo(180);
    expect(agg.results.summary.emax).toBeCloseTo(600);
    expect(agg.results.summary.uo).toBeCloseTo(180 / 460);
    expect(agg.results.summary.totalWatts).toBeCloseTo(480);
    expect(agg.results.summary.lpd).toBeCloseTo(4.8);
    expect(agg.results.summary.ugr).toBeCloseTo(19);
  });

  it("uses an illuminance-weighted maintenance factor across rooms", () => {
    const dark = room("r-office", "Open Office", 10, 8, 0.8);
    const bright = room("r-meet", "Meeting", 5, 4, 0.6);
    const results: ResultsV2 = {
      version: 2,
      byRoomId: {
        "r-office": calc({ eave: 500, emin: 400, emax: 600, areaM2: 80, totalWatts: 400 }),
        "r-meet": calc({ eave: 300, emin: 180, emax: 420, areaM2: 20, totalWatts: 80 }),
      },
    };
    const agg = aggregateStoreyResults([dark, bright], results, "s1")!;
    // maintained Ēm = (500*0.8*80 + 300*0.6*20) / 100 = 356
    // Ēm = 460 → MF = 356 / 460
    expect(agg.maintenanceFactor).toBeCloseTo(356 / 460);
    expect(agg.results.summary.eave * agg.maintenanceFactor).toBeCloseTo(356);
  });

  it("aggregates only the rooms that already have results", () => {
    const results: ResultsV2 = {
      version: 2,
      byRoomId: {
        "r-office": calc({ eave: 500, emin: 400, emax: 600, areaM2: 80, totalWatts: 400, ugr: 16 }),
      },
    };
    const agg = aggregateStoreyResults([office, meeting], results, "s1")!;
    expect(agg.results.summary.areaM2).toBeCloseTo(80);
    expect(agg.results.summary.eave).toBeCloseTo(500);
    expect(agg.results.summary.ugr).toBeCloseTo(16);
  });
});
