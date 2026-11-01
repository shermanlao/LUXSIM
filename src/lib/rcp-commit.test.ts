import { describe, expect, it } from "vitest";
import type { FixtureCodeMapRule, ProjectSceneV2, RcpDetectionProposal, RoomV2 } from "@luxsim/project-io";
import { createCodeMapRule } from "@/lib/fixture-code-map";
import { acceptedForCommitCandidates, setProposalStatus } from "@/lib/rcp-confirm";
import { planRcpCommit } from "./rcp-commit";

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
