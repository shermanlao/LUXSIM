import { describe, expect, it, vi } from "vitest";
import type { PhotometricData } from "@luxsim/photometry";
import { rectPolygon } from "@luxsim/project-io";
import type { FixtureCodeMapRule, RoomV2 } from "@luxsim/project-io";
import { createCodeMapRule } from "@/lib/fixture-code-map";
import {
  commitScheduleImport,
  enrichScheduleRows,
  parseScheduleCsv,
  scheduleCommitBlockedReason,
  setScheduleRowStatus,
} from "./schedule-csv";

function room10(): RoomV2 {
  return {
    id: "r1",
    storeyId: "s1",
    name: "Hall",
    polygon: rectPolygon(0, 0, 10, 10),
    heightM: 3,
    workplaneHeightM: 0.75,
    reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
    calc: { gridSpacing: 0.5, maintenanceFactor: 0.8, en12464TemplateId: "" },
  };
}

const rules: FixtureCodeMapRule[] = [
  createCodeMapRule({ codeRaw: "DL-01", luminaireId: "lum_a", match: "exact" }),
];

function sampleCsv10(): string {
  const lines = ["code,x,y"];
  for (let i = 0; i < 10; i += 1) {
    lines.push(`DL-01,${1 + i * 0.8},${1 + (i % 3) * 1.2}`);
  }
  return lines.join("\n");
}

describe("parseScheduleCsv", () => {
  it("parses 10 data rows with header", () => {
    const { rows, errors } = parseScheduleCsv(sampleCsv10());
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(10);
    expect(rows[0]!.codeRaw).toBe("DL-01");
    expect(rows[0]!.x).toBe(1);
  });
});

describe("commitScheduleImport", () => {
  it("writes 10 instances when all mapped and inside room", async () => {
    const { rows: parsed } = parseScheduleCsv(sampleCsv10());
    const importRows = enrichScheduleRows(parsed, rules, [room10()], "s1");
    expect(importRows.every((r) => r.reviewStatus === "accepted")).toBe(true);

    const scene = {
      version: 2 as const,
      storeys: [{ id: "s1", name: "GF", elevationM: 0, heightM: 3 }],
      rooms: [room10()],
      underlays: [],
      fixtureLibraryIds: ["lum_a"],
      instances: [],
      ui: { activeStoreyId: "s1", activeRoomId: "r1", tool: "select" as const },
    };

    const out = await commitScheduleImport(
      {
        scene,
        results: { version: 2, byRoomId: {} },
        rows: importRows,
        luminaireNames: { lum_a: "Downlight" },
        runCalc: false,
      },
      {
        ensurePhotometry: async () => ({}) as PhotometricData,
        getWatts: () => 20,
      }
    );

    expect(out.blockedReason).toBeUndefined();
    expect(out.instanceIds).toHaveLength(10);
    expect(out.scene.instances).toHaveLength(10);
    expect(out.scene.instances[0]!.position.x).toBeCloseTo(1, 3);
  });

  it("blocks commit when accepted row is unmapped", async () => {
    const { rows: parsed } = parseScheduleCsv("code,x,y\nUNKNOWN,2,2\n");
    const importRows = enrichScheduleRows(parsed, rules, [room10()], "s1");
    const accepted = setScheduleRowStatus(importRows[0]!, "accepted");
    expect(scheduleCommitBlockedReason([accepted])).toBeTruthy();

    const scene = {
      version: 2 as const,
      storeys: [{ id: "s1", name: "GF", elevationM: 0, heightM: 3 }],
      rooms: [room10()],
      underlays: [],
      fixtureLibraryIds: [],
      instances: [],
      ui: { activeStoreyId: "s1", activeRoomId: null, tool: "select" as const },
    };

    const out = await commitScheduleImport(
      {
        scene,
        results: { version: 2, byRoomId: {} },
        rows: [accepted],
        luminaireNames: {},
      },
      {
        ensurePhotometry: async () => ({}) as PhotometricData,
        getWatts: () => 20,
      }
    );

    expect(out.instanceIds).toHaveLength(0);
    expect(out.blockedReason).toMatch(/unmapped/i);
  });

  it("runCalc populates results without dropping instances on solver throw", async () => {
    const { rows: parsed } = parseScheduleCsv("code,x,y\nDL-01,2,2\n");
    const importRows = enrichScheduleRows(parsed, rules, [room10()], "s1");
    const scene = {
      version: 2 as const,
      storeys: [{ id: "s1", name: "GF", elevationM: 0, heightM: 3 }],
      rooms: [room10()],
      underlays: [],
      fixtureLibraryIds: ["lum_a"],
      instances: [],
      ui: { activeStoreyId: "s1", activeRoomId: "r1", tool: "select" as const },
    };

    const out = await commitScheduleImport(
      {
        scene,
        results: { version: 2, byRoomId: {} },
        rows: importRows,
        luminaireNames: { lum_a: "Downlight" },
        runCalc: true,
      },
      {
        ensurePhotometry: async () => ({}) as PhotometricData,
        getWatts: () => 20,
        runSolver: vi.fn(async () => {
          throw new Error("fail");
        }),
      }
    );

    expect(out.scene.instances).toHaveLength(1);
    expect(out.calcFailed).toBe(true);
  });
});
