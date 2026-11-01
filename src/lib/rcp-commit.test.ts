import { describe, expect, it, vi } from "vitest";
import type { FixtureCodeMapRule, ProjectSceneV2, RcpDetectionProposal, RoomV2 } from "@luxsim/project-io";
import type { PhotometricData } from "@luxsim/photometry";
import { createCodeMapRule } from "@/lib/fixture-code-map";
import { acceptedForCommitCandidates, setProposalStatus } from "@/lib/rcp-confirm";
import { commitAcceptedRcpProposals, planRcpCommit } from "./rcp-commit";

function baseProposal(overrides: Partial<RcpDetectionProposal> = {}): RcpDetectionProposal {
  return {
    id: "p1",
    codeRaw: "DL-01",
    codeNorm: "DL01",
    confidence: 0.9,
    status: "pending",
    pointM: { x: 2, y: 3 },
    ...overrides,
  };
}

function roomRect(id: string, x0: number, y0: number, w: number, h: number): RoomV2 {
  return {
    id,
    storeyId: "s1",
    name: id,
    polygon: [
      { x: x0, y: y0 },
      { x: x0 + w, y: y0 },
      { x: x0 + w, y: y0 + h },
      { x: x0, y: y0 + h },
    ],
    heightM: 3,
    workplaneHeightM: 0.75,
    reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
    calc: { gridSpacing: 0.5, interreflection: true, bounces: 1, computeUgr: false },
  };
}

function emptyScene(rooms: RoomV2[]): ProjectSceneV2 {
  return {
    version: 2,
    storeys: [{ id: "s1", name: "GF", elevationM: 0, heightM: 3 }],
    rooms,
    underlays: [],
    fixtureLibraryIds: [],
    instances: [],
    ui: { activeStoreyId: "s1", activeRoomId: rooms[0]?.id ?? null, tool: "select" },
  };
}

describe("planRcpCommit", () => {
  const rules: FixtureCodeMapRule[] = [
    createCodeMapRule({ codeRaw: "DL-01", luminaireId: "lum_a", match: "exact" }),
  ];
  const rooms = [roomRect("r1", 0, 0, 10, 10)];

  it("creates 10 instances from 10 accepted mapped proposals", () => {
    const proposals = Array.from({ length: 10 }, (_, i) =>
      setProposalStatus(
        baseProposal({
          id: `p${i}`,
          pointM: { x: 1 + i * 0.5, y: 2 + i * 0.3 },
        }),
        "accepted"
      )
    );
    const plan = planRcpCommit({
      proposals,
      rules,
      rooms,
      storeyId: "s1",
      luminaireNames: { lum_a: "Downlight A" },
      scene: emptyScene(rooms),
    });
    expect(plan.drafts).toHaveLength(10);
    expect(plan.committedProposalIds).toHaveLength(10);
    expect(plan.skippedOutside).toHaveLength(0);
  });

  it("writes zero drafts for unmapped accepted proposals", () => {
    const proposals = [
      setProposalStatus(baseProposal({ codeRaw: "UNKNOWN" }), "accepted"),
    ];
    expect(acceptedForCommitCandidates(proposals, rules)).toHaveLength(0);
    const plan = planRcpCommit({
      proposals,
      rules,
      rooms,
      storeyId: "s1",
      luminaireNames: {},
      scene: emptyScene(rooms),
    });
    expect(plan.drafts).toHaveLength(0);
  });

  it("uses pointM coordinates and room mount height", () => {
    const proposals = [
      setProposalStatus(
        baseProposal({ id: "x", pointM: { x: 4.5, y: 6.25 } }),
        "accepted"
      ),
    ];
    const plan = planRcpCommit({
      proposals,
      rules,
      rooms,
      storeyId: "s1",
      luminaireNames: { lum_a: "Downlight A" },
      scene: emptyScene(rooms),
    });
    expect(plan.drafts).toHaveLength(1);
    const d = plan.drafts[0]!;
    expect(d.position.x).toBe(4.5);
    expect(d.position.y).toBe(6.25);
    expect(d.position.z).toBe(rooms[0]!.heightM - 0.1);
    expect(d.rcpProposalId).toBe("x");
  });

  it("excludes rejected proposals", () => {
    const proposals = [
      setProposalStatus(baseProposal({ id: "ok" }), "accepted"),
      setProposalStatus(baseProposal({ id: "no" }), "rejected"),
    ];
    const plan = planRcpCommit({
      proposals,
      rules,
      rooms,
      storeyId: "s1",
      luminaireNames: { lum_a: "Downlight A" },
      scene: emptyScene(rooms),
    });
    expect(plan.drafts).toHaveLength(1);
    expect(plan.drafts[0]!.rcpProposalId).toBe("ok");
  });

  it("skips points outside all rooms", () => {
    const proposals = [
      setProposalStatus(
        baseProposal({ id: "out", pointM: { x: 99, y: 99 } }),
        "accepted"
      ),
    ];
    const plan = planRcpCommit({
      proposals,
      rules,
      rooms,
      storeyId: "s1",
      luminaireNames: { lum_a: "Downlight A" },
      scene: emptyScene(rooms),
    });
    expect(plan.drafts).toHaveLength(0);
    expect(plan.skippedOutside).toHaveLength(1);
    expect(plan.skippedOutside[0]!.proposalId).toBe("out");
  });
});

describe("commitAcceptedRcpProposals runCalc", () => {
  const rules: FixtureCodeMapRule[] = [
    createCodeMapRule({ codeRaw: "DL-01", luminaireId: "lum_a", match: "exact" }),
  ];
  const rooms = [roomRect("r1", 0, 0, 10, 10)];

  it("populates results for affected room when runCalc true", async () => {
    const proposals = [
      setProposalStatus(baseProposal({ id: "p1", pointM: { x: 2, y: 2 } }), "accepted"),
    ];
    const scene: ProjectSceneV2 = {
      ...emptyScene(rooms),
      fixtureCodeMap: rules,
      fixtureLibraryIds: ["lum_a"],
      rcpProposals: proposals,
    };

    const runSolver = vi.fn(async () => ({
      version: 1 as const,
      summary: { eave: 220, emin: 180, emax: 260, uo: 0.82, ugr: 16, lpd: 1.2 },
      grid: {
        originX: 0,
        originY: 0,
        spacing: 0.5,
        nx: 1,
        ny: 1,
        z: 0.75,
        lux: [220],
      },
    }));

    const out = await commitAcceptedRcpProposals(
      {
        scene,
        results: { version: 2, byRoomId: {} },
        proposals,
        rules,
        luminaireNames: { lum_a: "Downlight A" },
        options: { runCalc: true, calcScope: "room" },
      },
      {
        ensurePhotometry: async () => ({}) as PhotometricData,
        getWatts: () => 25,
        runSolver,
      }
    );

    expect(out.instanceIds).toHaveLength(1);
    expect(out.scene.instances).toHaveLength(1);
    expect(out.results.byRoomId.r1?.summary.eave).toBe(220);
    expect(out.calcFailed).toBe(false);
    expect(out.scene.ui.activeRoomId).toBe("r1");
    expect(out.scene.rcpProposals?.[0]?.status).toBe("committed");
  });

  it("keeps instances when solver throws and flags calcFailed", async () => {
    const proposals = [
      setProposalStatus(baseProposal({ id: "p1", pointM: { x: 3, y: 3 } }), "accepted"),
    ];
    const scene: ProjectSceneV2 = {
      ...emptyScene(rooms),
      fixtureCodeMap: rules,
      fixtureLibraryIds: ["lum_a"],
      rcpProposals: proposals,
    };

    const out = await commitAcceptedRcpProposals(
      {
        scene,
        results: { version: 2, byRoomId: {} },
        proposals,
        rules,
        luminaireNames: { lum_a: "Downlight A" },
        options: { runCalc: true },
      },
      {
        ensurePhotometry: async () => ({}) as PhotometricData,
        getWatts: () => 25,
        runSolver: vi.fn(async () => {
          throw new Error("solver boom");
        }),
      }
    );

    expect(out.scene.instances).toHaveLength(1);
    expect(out.calcFailed).toBe(true);
    expect(out.results.byRoomId.r1).toBeUndefined();
  });
});
