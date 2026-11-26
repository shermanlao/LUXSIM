import type { FixtureCodeMapRule, RcpDetectionProposal, RcpProposalStatus } from "@luxsim/project-io";
import { lookupFixtureCode, normalizeFixtureCode } from "@/lib/fixture-code-map";

export type RcpMapDisplay = "mapped" | "unmapped" | "ambiguous";

export type RcpConfirmSummary = {
  accepted: number;
  rejected: number;
  pending: number;
  edited: number;
  /** Accepted/edited but code map is not uniquely mapped */
  unmappedBlocked: number;
  readyForCommit: number;
};

export function normalizeProposalCode(proposal: RcpDetectionProposal, codeRaw: string): RcpDetectionProposal {
  const trimmed = codeRaw.trim();
  const nextStatus: RcpProposalStatus =
    proposal.status === "rejected"
      ? "rejected"
      : proposal.status === "accepted"
        ? "edited"
        : proposal.status === "edited"
          ? "edited"
          : "edited";
  return {
    ...proposal,
    codeRaw: trimmed,
    codeNorm: trimmed ? normalizeFixtureCode(trimmed) : undefined,
    status: nextStatus,
  };
}

export function setProposalStatus(
  proposal: RcpDetectionProposal,
  status: RcpProposalStatus
): RcpDetectionProposal {
  return { ...proposal, status };
}

export function updateProposalPointM(
  proposal: RcpDetectionProposal,
  pointM: { x: number; y: number }
): RcpDetectionProposal {
  const status: RcpProposalStatus =
    proposal.status === "rejected"
      ? "rejected"
      : proposal.status === "pending"
        ? "edited"
        : proposal.status === "accepted"
          ? "edited"
          : proposal.status;
  return { ...proposal, pointM, status };
}

export function getProposalMapDisplay(
  proposal: RcpDetectionProposal,
  rules: FixtureCodeMapRule[],
  luminaireNames: Record<string, string>
): { display: RcpMapDisplay; label: string } {
  const lookup = lookupFixtureCode(proposal.codeRaw, rules);
  if (lookup.status === "mapped" && lookup.luminaireId) {
    const name = luminaireNames[lookup.luminaireId] ?? lookup.luminaireId;
    return { display: "mapped", label: name };
  }
  if (lookup.status === "ambiguous") {
    return { display: "ambiguous", label: "Ambiguous / 多項匹配" };
  }
  return { display: "unmapped", label: "Unmapped / 未對應" };
}

export function isPositiveReviewStatus(status: RcpProposalStatus): boolean {
  return status === "accepted" || status === "edited";
}

export function proposalReadyForCommit(
  proposal: RcpDetectionProposal,
  rules: FixtureCodeMapRule[]
): { ready: boolean; blockReason?: string } {
  if (!isPositiveReviewStatus(proposal.status)) {
    return { ready: false, blockReason: "Not accepted / 未接受" };
  }
  const lookup = lookupFixtureCode(proposal.codeRaw, rules);
  if (lookup.status === "mapped" && lookup.luminaireId) {
    return { ready: true };
  }
  if (lookup.status === "ambiguous") {
    return { ready: false, blockReason: "Ambiguous code map / 代碼衝突" };
  }
  return { ready: false, blockReason: "Unmapped code / 未對應燈具" };
}

export function summarizeRcpConfirm(
  proposals: RcpDetectionProposal[],
  rules: FixtureCodeMapRule[]
): RcpConfirmSummary {
  let accepted = 0;
  let rejected = 0;
  let pending = 0;
  let edited = 0;
  let unmappedBlocked = 0;
  let readyForCommit = 0;

  for (const p of proposals) {
    if (p.status === "rejected") rejected += 1;
    else if (p.status === "pending") pending += 1;
    else if (p.status === "accepted") accepted += 1;
    else if (p.status === "edited") edited += 1;
    else if (p.status === "committed") {
      /* committed rows no longer count toward review buckets */
    }

    const ready = proposalReadyForCommit(p, rules);
    if (ready.ready) readyForCommit += 1;
    else if (isPositiveReviewStatus(p.status)) unmappedBlocked += 1;
  }

  return {
    accepted,
    rejected,
    pending,
    edited,
    unmappedBlocked,
    readyForCommit,
  };
}

/** Accepted/edited proposals that pass code map (excludes rejected). */
export function acceptedForCommitCandidates(
  proposals: RcpDetectionProposal[],
  rules: FixtureCodeMapRule[]
): RcpDetectionProposal[] {
  return proposals.filter((p) => proposalReadyForCommit(p, rules).ready);
}

export function acceptAllMappedProposals(
  proposals: RcpDetectionProposal[],
  rules: FixtureCodeMapRule[]
): RcpDetectionProposal[] {
  return proposals.map((p) => {
    if (p.status === "rejected") return p;
    const lookup = lookupFixtureCode(p.codeRaw, rules);
    if (lookup.status === "mapped" && lookup.luminaireId) {
      return setProposalStatus(p, "accepted");
    }
    return p;
  });
}

export function rejectProposals(
  proposals: RcpDetectionProposal[],
  ids: Set<string>
): RcpDetectionProposal[] {
  return proposals.map((p) => (ids.has(p.id) ? setProposalStatus(p, "rejected") : p));
}

export function acceptProposals(
  proposals: RcpDetectionProposal[],
  ids: Set<string>
): RcpDetectionProposal[] {
  return proposals.map((p) => (ids.has(p.id) ? setProposalStatus(p, "accepted") : p));
}
