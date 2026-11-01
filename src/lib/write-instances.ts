import type { PhotometricData } from "@luxsim/photometry";
import {
  clipResultsToPolygon,
  roomToCalcOptions,
  type FixtureInstance,
  type ProjectSceneV2,
  type ResultsV2,
  type RoomV2,
} from "@luxsim/project-io";
import type { CalcResults } from "@luxsim/solver";
import { runSolverClient } from "@/lib/run-solver";

export type FixtureInstanceDraft = {
  instanceId?: string;
  luminaireId: string;
  storeyId: string;
  roomId: string;
  name: string;
  position: { x: number; y: number; z: number };
  rotationDeg: number;
};

export type WriteInstancesOptions = {
  replaceRoomInstances?: boolean;
  runCalc?: boolean;
  calcScope: "room" | "all";
};

export type WriteInstancesCalcDeps = {
  ensurePhotometry: (luminaireId: string) => Promise<PhotometricData | null>;
  getWatts: (luminaireId: string) => number | null | undefined;
  runSolver?: typeof runSolverClient;
};

export function newInstanceId(prefix = "inst"): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

export function clearResultsForRooms(
  results: ResultsV2,
  roomIds: string[]
): ResultsV2 {
  if (!roomIds.length) return results;
  const nextByRoom = { ...results.byRoomId };
  for (const id of roomIds) {
    delete nextByRoom[id];
  }
  return { version: 2, byRoomId: nextByRoom };
}

export function mergeInstanceDrafts(
  scene: ProjectSceneV2,
  drafts: FixtureInstanceDraft[],
  options: Pick<WriteInstancesOptions, "replaceRoomInstances">
): { scene: ProjectSceneV2; instanceIds: string[]; affectedRoomIds: string[] } {
  const affectedRoomIds = [...new Set(drafts.map((d) => d.roomId))];
  let instances = scene.instances;

  if (options.replaceRoomInstances) {
    const replaceSet = new Set(affectedRoomIds);
    instances = instances.filter((i) => !i.roomId || !replaceSet.has(i.roomId));
  }

  const instanceIds: string[] = [];
  const added: FixtureInstance[] = drafts.map((d) => {
    const instanceId = d.instanceId ?? newInstanceId();
    instanceIds.push(instanceId);
    return {
      instanceId,
      luminaireId: d.luminaireId,
      storeyId: d.storeyId,
      roomId: d.roomId,
      name: d.name,
      position: d.position,
      rotationDeg: d.rotationDeg,
    };
  });

  const activeRoomId = drafts.length ? drafts[drafts.length - 1]!.roomId : scene.ui.activeRoomId;

  return {
    scene: {
      ...scene,
      instances: [...instances, ...added],
      ui: { ...scene.ui, activeRoomId },
    },
    instanceIds,
    affectedRoomIds,
  };
}

export async function runClientCalcForRooms(
  scene: ProjectSceneV2,
  results: ResultsV2,
  roomIds: string[],
  deps: WriteInstancesCalcDeps
): Promise<ResultsV2> {
  const runSolver = deps.runSolver ?? runSolverClient;
  const targetRooms =
    roomIds.length > 0
      ? scene.rooms.filter((r) => roomIds.includes(r.id))
      : scene.rooms;

  const nextByRoom = { ...results.byRoomId };

  for (const room of targetRooms) {
    const inst = scene.instances.filter((i) => i.roomId === room.id);
    if (!inst.length) continue;

    const photometry: Record<string, PhotometricData> = {};
    const watts: Record<string, number | null | undefined> = {};
    for (const i of inst) {
      const p = await deps.ensurePhotometry(i.luminaireId);
      if (p) photometry[i.luminaireId] = p;
      watts[i.luminaireId] = deps.getWatts(i.luminaireId);
    }
    const opts = roomToCalcOptions(room, inst, photometry, watts);
    let calc: CalcResults = await runSolver(opts);
    calc = clipResultsToPolygon(room, calc);
    nextByRoom[room.id] = calc;
  }

  return { version: 2, byRoomId: nextByRoom };
}

/** Shared batch write used by drag-drop, arrays, and future placement tools. */
export async function writeFixtureInstances(
  input: {
    scene: ProjectSceneV2;
    results: ResultsV2;
    drafts: FixtureInstanceDraft[];
    options: WriteInstancesOptions;
  },
  deps: WriteInstancesCalcDeps
): Promise<{
  scene: ProjectSceneV2;
  results: ResultsV2;
  instanceIds: string[];
  affectedRoomIds: string[];
}> {
  if (!input.drafts.length) {
    return {
      scene: input.scene,
      results: input.results,
      instanceIds: [],
      affectedRoomIds: [],
    };
  }

  const { scene, instanceIds, affectedRoomIds } = mergeInstanceDrafts(
    input.scene,
    input.drafts,
    { replaceRoomInstances: input.options.replaceRoomInstances ?? false }
  );

  let results = clearResultsForRooms(input.results, affectedRoomIds);

  if (input.options.runCalc) {
    const roomIdsToCalc =
      input.options.calcScope === "all"
        ? scene.rooms.map((r: RoomV2) => r.id)
        : affectedRoomIds;
    results = await runClientCalcForRooms(scene, results, roomIdsToCalc, deps);
  }

  return { scene, results, instanceIds, affectedRoomIds };
}
