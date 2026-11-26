import { describe, expect, it, vi } from "vitest";
import type { PhotometricData } from "@luxsim/photometry";
import { rectPolygon, type FixtureCodeMapRule, type OfficialDxfTextLabel, type RoomV2 } from "@luxsim/project-io";
import { createCodeMapRule } from "@/lib/fixture-code-map";
import {
  PLAN_CODE_REFUSE_NO_LABELS,
  PLAN_CODE_REFUSE_NO_VISIBLE,
  acceptAllMappedPlanCodeRows,
  commitPlanCodePlacements,
  countPlanCodeSourcedInstances,
  enrichPlanCodeLabels,
  planCodeCommitBlockedReason,
  planCodeImportCanCommit,
  planPlanCodeCommit,
  removePlanCodeSourcedInstances,
  scanPlanCodeLabels,
  setPlanCodeRowStatus,
  summarizePlanCodeImport,
} from "./plan-code-place";

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

const emptyScene = {
  version: 2 as const,
  storeys: [{ id: "s1", name: "GF", elevationM: 0, heightM: 3 }],
  rooms: [room10()],
  underlays: [],
  fixtureLibraryIds: ["lum_a"],
  instances: [],
  ui: { activeStoreyId: "s1", activeRoomId: "r1", tool: "select" as const, viewMode: "top" as const },
};

function label(
  text: string,
  x: number,
  y: number,
  extra?: Partial<OfficialDxfTextLabel>
): OfficialDxfTextLabel {
  return { text, x, y, rotationDeg: 0, kind: "TEXT", ...extra };
}

describe("scanPlanCodeLabels", () => {
  it("refuses when the plan has no TEXT/MTEXT", () => {
    const out = scanPlanCodeLabels({
      labels: [],
      rules,
      rooms: [room10()],
      storeyId: "s1",
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe(PLAN_CODE_REFUSE_NO_LABELS);
  });

  it("refuses when remaining visible codes are hidden", () => {
    const out = scanPlanCodeLabels({
      labels: [label("DL-01", 1, 1, { layer: "EL-LIGHTING" })],
      hiddenLayers: ["EL-LIGHTING"],
      rules,
      rooms: [room10()],
      storeyId: "s1",
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe(PLAN_CODE_REFUSE_NO_VISIBLE);
  });

  it("maps millimetre drawing units into scene metres and assigns the containing room", () => {
    const out = scanPlanCodeLabels({
      labels: [label("DL-01", 2000, 3000, { layer: "EL-LIGHTING", rotationDeg: 45 })],
      underlay: { metersPerUnit: 0.001, offsetX: 0, offsetY: 0 },
      rules,
      rooms: [room10()],
      storeyId: "s1",
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]).toMatchObject({
      codeRaw: "DL-01",
      x: 2,
      y: 3,
      rotationDeg: 45,
      mapStatus: "mapped",
      luminaireId: "lum_a",
      roomId: "r1",
      outsideRoom: false,
      reviewStatus: "accepted",
    });
  });

  it("marks points outside any room on the active storey", () => {
    const out = scanPlanCodeLabels({
      labels: [label("DL-01", 50, 50)],
      rules,
      rooms: [room10()],
      storeyId: "s1",
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.rows[0]).toMatchObject({
      outsideRoom: true,
      roomId: null,
      reviewStatus: "pending",
    });
    expect(out.outsideSkipped).toBe(1);
  });
});

describe("plan code commit gates", () => {
  const deps = {
    ensurePhotometry: async () => ({}) as PhotometricData,
    getWatts: () => 20,
  };

  it("places a mapped code inside a room and applies TEXT rotation and mounting height", async () => {
    const rows = enrichPlanCodeLabels(
      [label("DL-01", 2, 3, { rotationDeg: 90 })],
      rules,
      [room10()],
      "s1"
    );
    expect(rows[0]!.reviewStatus).toBe("accepted");
    const out = await commitPlanCodePlacements(
      {
        scene: emptyScene,
        results: { version: 2, byRoomId: {} },
        rows,
        luminaireNames: { lum_a: "Downlight" },
      },
      deps
    );
    expect(out.blockedReason).toBeUndefined();
    expect(out.instanceIds).toHaveLength(1);
    expect(out.scene.instances[0]).toMatchObject({
      luminaireId: "lum_a",
      roomId: "r1",
      storeyId: "s1",
      name: "DL-01",
      rotationDeg: 90,
      planCodeId: rows[0]!.id,
      position: { x: 2, y: 3, z: 2.9 },
    });
  });

  it("blocks commit when an accepted row is unmapped and writes nothing", async () => {
    const rows = enrichPlanCodeLabels([label("UNKNOWN", 2, 2)], rules, [room10()], "s1");
    const accepted = setPlanCodeRowStatus(rows[0]!, "accepted");
    expect(accepted.mapStatus).toBe("unmapped");
    expect(planCodeCommitBlockedReason([accepted])).toMatch(/unmapped/i);

    const out = await commitPlanCodePlacements(
      {
        scene: emptyScene,
        results: { version: 2, byRoomId: {} },
        rows: [accepted],
        luminaireNames: {},
      },
      deps
    );
    expect(out.instanceIds).toHaveLength(0);
    expect(out.scene.instances).toHaveLength(0);
    expect(out.blockedReason).toMatch(/unmapped/i);
  });

  it("blocks the whole commit when any accepted row is ambiguous, even if another row is ready", async () => {
    const mixedRules: FixtureCodeMapRule[] = [
      createCodeMapRule({ codeRaw: "DL-01", luminaireId: "lum_a", match: "exact" }),
      createCodeMapRule({ codeRaw: "AMB", luminaireId: "lum_a", match: "exact" }),
      createCodeMapRule({ codeRaw: "AMB", luminaireId: "lum_b", match: "exact" }),
    ];
    const rows = enrichPlanCodeLabels(
      [label("DL-01", 2, 2), label("AMB", 3, 3)],
      mixedRules,
      [room10()],
      "s1"
    );
    const accepted = rows.map((r) => setPlanCodeRowStatus(r, "accepted"));
    expect(accepted[0]!.mapStatus).toBe("mapped");
    expect(accepted[1]!.mapStatus).toBe("ambiguous");
    expect(planCodeCommitBlockedReason(accepted)).toMatch(/ambiguous|unmapped/i);
    expect(planCodeImportCanCommit(summarizePlanCodeImport(accepted), false, planCodeCommitBlockedReason(accepted))).toBe(
      false
    );

    const out = await commitPlanCodePlacements(
      {
        scene: emptyScene,
        results: { version: 2, byRoomId: {} },
        rows: accepted,
        luminaireNames: { lum_a: "A" },
      },
      deps
    );
    expect(out.instanceIds).toHaveLength(0);
    expect(out.scene.instances).toHaveLength(0);
    expect(out.blockedReason).toBeTruthy();
  });

  it("skips accepted points outside a room and does not invent a room or place in empty space", async () => {
    const inside = enrichPlanCodeLabels([label("DL-01", 2, 2)], rules, [room10()], "s1");
    const outside = setPlanCodeRowStatus(
      enrichPlanCodeLabels([label("DL-01", 50, 50)], rules, [room10()], "s1")[0]!,
      "accepted"
    );
    const rows = [...inside, outside];
    expect(planCodeCommitBlockedReason(rows)).toBeNull();
    const plan = planPlanCodeCommit(rows, emptyScene, { lum_a: "Downlight" });
    expect(plan.drafts).toHaveLength(1);
    expect(plan.skippedOutside).toHaveLength(1);
    expect(plan.skippedOutside[0]!.codeRaw).toBe("DL-01");

    const out = await commitPlanCodePlacements(
      {
        scene: emptyScene,
        results: { version: 2, byRoomId: {} },
        rows,
        luminaireNames: { lum_a: "Downlight" },
      },
      deps
    );
    expect(out.instanceIds).toHaveLength(1);
    expect(out.skippedOutside).toHaveLength(1);
    expect(out.scene.instances[0]!.position).toMatchObject({ x: 2, y: 2 });
  });

  it("writes nothing when there are no accepted mapped rows inside a room", async () => {
    const rows = enrichPlanCodeLabels([label("DL-01", 50, 50)], rules, [room10()], "s1");
    const out = await commitPlanCodePlacements(
      {
        scene: emptyScene,
        results: { version: 2, byRoomId: {} },
        rows,
        luminaireNames: { lum_a: "Downlight" },
      },
      deps
    );
    expect(out.instanceIds).toHaveLength(0);
    expect(out.scene.instances).toHaveLength(0);
    expect(out.blockedReason).toBeUndefined();
  });

  it("does not delete hand-placed fixtures when replace is off, and only replaces prior plan-code placements when on", async () => {
    const hand = {
      instanceId: "inst_hand",
      luminaireId: "lum_a",
      storeyId: "s1",
      roomId: "r1",
      name: "Hand",
      position: { x: 1, y: 1, z: 2.9 },
      rotationDeg: 0,
    };
    const prior = {
      instanceId: "inst_prior",
      luminaireId: "lum_a",
      storeyId: "s1",
      roomId: "r1",
      name: "Old",
      position: { x: 4, y: 4, z: 2.9 },
      rotationDeg: 0,
      planCodeId: "plancode_old",
    };
    const scene = { ...emptyScene, instances: [hand, prior] };
    expect(countPlanCodeSourcedInstances(scene, "s1")).toBe(1);
    expect(removePlanCodeSourcedInstances(scene, "s1").instances.map((i) => i.instanceId)).toEqual([
      "inst_hand",
    ]);

    const rows = enrichPlanCodeLabels([label("DL-01", 2, 2)], rules, [room10()], "s1");

    const kept = await commitPlanCodePlacements(
      {
        scene,
        results: { version: 2, byRoomId: {} },
        rows,
        luminaireNames: { lum_a: "Downlight" },
        options: { replaceExistingFromPlanCodes: false },
      },
      deps
    );
    expect(kept.scene.instances.map((i) => i.instanceId).sort()).toEqual(
      expect.arrayContaining(["inst_hand", "inst_prior"])
    );
    expect(kept.scene.instances).toHaveLength(3);

    const replaced = await commitPlanCodePlacements(
      {
        scene,
        results: { version: 2, byRoomId: {} },
        rows,
        luminaireNames: { lum_a: "Downlight" },
        options: { replaceExistingFromPlanCodes: true },
      },
      deps
    );
    expect(replaced.scene.instances.map((i) => i.instanceId)).toContain("inst_hand");
    expect(replaced.scene.instances.map((i) => i.instanceId)).not.toContain("inst_prior");
    expect(replaced.scene.instances).toHaveLength(2);
    expect(replaced.scene.instances.some((i) => i.planCodeId === rows[0]!.id)).toBe(true);
  });

  it("keeps placed fixtures when post-place calc throws", async () => {
    const rows = enrichPlanCodeLabels([label("DL-01", 2, 2)], rules, [room10()], "s1");
    const out = await commitPlanCodePlacements(
      {
        scene: emptyScene,
        results: { version: 2, byRoomId: {} },
        rows,
        luminaireNames: { lum_a: "Downlight" },
        options: { runCalc: true },
      },
      {
        ...deps,
        runSolver: vi.fn(async () => {
          throw new Error("fail");
        }),
      }
    );
    expect(out.scene.instances).toHaveLength(1);
    expect(out.calcFailed).toBe(true);
  });

  it("accept-all mapped only accepts inside-room mapped rows", () => {
    const rows = enrichPlanCodeLabels(
      [label("DL-01", 2, 2), label("DL-01", 50, 50), label("ZZ", 3, 3)],
      rules,
      [room10()],
      "s1"
    );
    const next = acceptAllMappedPlanCodeRows(
      rows.map((r) => setPlanCodeRowStatus(r, "pending"))
    );
    expect(next[0]!.reviewStatus).toBe("accepted");
    expect(next[1]!.reviewStatus).toBe("pending");
    expect(next[2]!.reviewStatus).toBe("pending");
    const summary = summarizePlanCodeImport(next);
    expect(summary.readyForCommit).toBe(1);
    expect(summary.outsideSkipped).toBe(1);
  });
});
