import { findRoomAt, type FixtureCodeMapRule, type ProjectSceneV2, type RcpDetectionProposal, type ResultsV2, type RoomV2 } from "@luxsim/project-io";
import { lookupFixtureCode } from "@/lib/fixture-code-map";
import { acceptedForCommitCandidates } from "@/lib/rcp-confirm";
import {
  runClientCalcForRooms,
  type FixtureInstanceDraft,
  type WriteInstancesCalcDeps,
  writeFixtureInstances,
} from "@/lib/write-instances";

export type RcpCommitSkippedOutside = {
  proposalId: string;
  codeRaw: string;
  x: number;
  y: number;
};

export type RcpCommitPlan = {
  drafts: FixtureInstanceDraft[];
  committedProposalIds: string[];
  skippedOutside: RcpCommitSkippedOutside[];
  detectSourcedOnStorey: number;
};

export type CommitRcpOptions = {
  replaceExistingFromDetect?: boolean;
  runCalc?: boolean;
  calcScope?: "room" | "all";
};

export type CommitRcpResult = {
  scene: ProjectSceneV2;
  results: ResultsV2;
  instanceIds: string[];
  affectedRoomIds: string[];
  skippedOutside: RcpCommitSkippedOutside[];
  calcFailed: boolean;
};

export function countDetectSourcedInstances(scene: ProjectSceneV2, storeyId: string): number {
  return scene.instances.filter((i) => i.rcpProposalId && i.storeyId === storeyId).length;
}

export function removeDetectSourcedInstances(
  scene: ProjectSceneV2,
  storeyId: string
): ProjectSceneV2 {
  return {
    ...scene,
    instances: scene.instances.filter(
      (i) => !(i.rcpProposalId && i.storeyId === storeyId)
    ),
  };
}

export function markProposalsCommitted(
  proposals: RcpDetectionProposal[],
  committedIds: Set<string>
): RcpDetectionProposal[] {
  return proposals.map((p) =>
    committedIds.has(p.id) ? { ...p, status: "committed" as const } : p
  );
}

export function planRcpCommit(input: {
  proposals: RcpDetectionProposal[];
  rules: FixtureCodeMapRule[];
  rooms: RoomV2[];
  storeyId: string;
  luminaireNames: Record<string, string>;
  scene: ProjectSceneV2;
}): RcpCommitPlan {
  const candidates = acceptedForCommitCandidates(input.proposals, input.rules);
  const drafts: FixtureInstanceDraft[] = [];
  const committedProposalIds: string[] = [];
  const skippedOutside: RcpCommitSkippedOutside[] = [];

  for (const p of candidates) {
    const point = p.pointM;
    if (!point) {
      skippedOutside.push({
        proposalId: p.id,
        codeRaw: p.codeRaw,
        x: NaN,
        y: NaN,
      });
      continue;
    }
    const room = findRoomAt(input.rooms, input.storeyId, point);
    if (!room) {
      skippedOutside.push({
        proposalId: p.id,
        codeRaw: p.codeRaw,
        x: point.x,
        y: point.y,
      });
      continue;
    }
    const lookup = lookupFixtureCode(p.codeRaw, input.rules);
    if (lookup.status !== "mapped" || !lookup.luminaireId) continue;

    const mountZ = room.heightM - 0.1;
    const lumName = input.luminaireNames[lookup.luminaireId] ?? lookup.luminaireId;
    drafts.push({
      luminaireId: lookup.luminaireId,
      storeyId: input.storeyId,
      roomId: room.id,
      name: p.codeRaw.trim() || lumName,
      position: { x: point.x, y: point.y, z: mountZ },
      rotationDeg: 0,
      rcpProposalId: p.id,
    });
    committedProposalIds.push(p.id);
  }

  return {
    drafts,
    committedProposalIds,
    skippedOutside,
    detectSourcedOnStorey: countDetectSourcedInstances(input.scene, input.storeyId),
  };
}

export async function commitAcceptedRcpProposals(
  input: {
    scene: ProjectSceneV2;
    results: ResultsV2;
    proposals: RcpDetectionProposal[];
    rules: FixtureCodeMapRule[];
    luminaireNames: Record<string, string>;
    options: CommitRcpOptions;
  },
  deps: WriteInstancesCalcDeps
): Promise<CommitRcpResult> {
  const storeyId = input.scene.ui.activeStoreyId;
  const plan = planRcpCommit({
    proposals: input.proposals,
    rules: input.rules,
    rooms: input.scene.rooms,
    storeyId,
    luminaireNames: input.luminaireNames,
    scene: input.scene,
  });

  if (!plan.drafts.length) {
    return {
      scene: input.scene,
      results: input.results,
      instanceIds: [],
      affectedRoomIds: [],
      skippedOutside: plan.skippedOutside,
      calcFailed: false,
    };
  }

  let scene = input.scene;
  if (input.options.replaceExistingFromDetect) {
    scene = removeDetectSourcedInstances(scene, storeyId);
  }

  const committedSet = new Set(plan.committedProposalIds);
  scene = {
    ...scene,
    rcpProposals: markProposalsCommitted(input.proposals, committedSet),
  };

  const out = await writeFixtureInstances(
    {
      scene,
      results: input.results,
      drafts: plan.drafts,
      options: {
        replaceRoomInstances: false,
        runCalc: false,
        calcScope: input.options.calcScope ?? "room",
      },
    },
    deps
  );

  let results = out.results;
  let calcFailed = false;
  if (input.options.runCalc) {
    try {
      const roomIdsToCalc =
        (input.options.calcScope ?? "room") === "all"
          ? out.scene.rooms.map((r) => r.id)
          : out.affectedRoomIds;
      results = await runClientCalcForRooms(out.scene, results, roomIdsToCalc, deps);
    } catch {
      calcFailed = true;
    }
  }

  return {
    scene: out.scene,
    results,
    instanceIds: out.instanceIds,
    affectedRoomIds: out.affectedRoomIds,
    skippedOutside: plan.skippedOutside,
    calcFailed,
  };
}
