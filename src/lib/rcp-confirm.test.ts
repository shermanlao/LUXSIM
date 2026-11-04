import { describe, expect, it } from "vitest";
import type { FixtureCodeMapRule, RcpDetectionProposal } from "@luxsim/project-io";
import { createCodeMapRule } from "@/lib/fixture-code-map";
import {
  acceptAllMappedProposals,
  acceptedForCommitCandidates,
  normalizeProposalCode,
  proposalReadyForCommit,
  setProposalStatus,
  summarizeRcpConfirm,
} from "./rcp-confirm";

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

describe("normalizeProposalCode", () => {
  it("updates codeNorm via normalizeFixtureCode", () => {
    const next = normalizeProposalCode(baseProposal(), "dl 02");
    expect(next.codeNorm).toBe("DL02");
    expect(next.status).toBe("edited");
  });
});

describe("reject and accepted sets", () => {
  it("excludes rejected from commit candidates", () => {
    const rules: FixtureCodeMapRule[] = [
      createCodeMapRule({ codeRaw: "DL-01", luminaireId: "lum_a", match: "exact" }),
    ];
    const proposals = [
      baseProposal({ id: "a", status: "accepted" }),
      baseProposal({ id: "b", status: "rejected" }),
    ];
    expect(acceptedForCommitCandidates(proposals, rules)).toHaveLength(1);
    expect(acceptedForCommitCandidates(proposals, rules)[0]!.id).toBe("a");
  });
});

describe("proposalReadyForCommit", () => {
  it("blocks accepted but unmapped", () => {
    const p = setProposalStatus(baseProposal({ codeRaw: "UNKNOWN" }), "accepted");
    const r = proposalReadyForCommit(p, []);
    expect(r.ready).toBe(false);
    expect(r.blockReason).toMatch(/Unmapped/i);
  });

  it("blocks accepted but ambiguous", () => {
    const rules = [
      createCodeMapRule({ codeRaw: "DL-01", luminaireId: "lum_a", match: "exact" }),
      createCodeMapRule({ codeRaw: "DL-01", luminaireId: "lum_b", match: "exact" }),
    ];
    const p = setProposalStatus(baseProposal(), "accepted");
    const r = proposalReadyForCommit(p, rules);
    expect(r.ready).toBe(false);
  });

  it("counts ready only when accepted and mapped", () => {
    const rules = [
      createCodeMapRule({ codeRaw: "DL-01", luminaireId: "lum_a", match: "exact" }),
    ];
    const proposals = [
      setProposalStatus(baseProposal(), "accepted"),
      setProposalStatus(baseProposal({ id: "p2", codeRaw: "X" }), "accepted"),
    ];
    const summary = summarizeRcpConfirm(proposals, rules);
    expect(summary.readyForCommit).toBe(1);
    expect(summary.unmappedBlocked).toBe(1);
  });
});

describe("acceptAllMappedProposals", () => {
  it("accepts only mapped rows", () => {
    const rules = [
      createCodeMapRule({ codeRaw: "DL-01", luminaireId: "lum_a", match: "exact" }),
    ];
    const out = acceptAllMappedProposals(
      [baseProposal(), baseProposal({ id: "p2", codeRaw: "ZZ-9" })],
      rules
    );
    expect(out.find((p) => p.id === "p1")!.status).toBe("accepted");
    expect(out.find((p) => p.id === "p2")!.status).toBe("pending");
  });
});
