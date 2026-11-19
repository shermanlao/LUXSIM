import type { ProjectSceneV2, ResultsV2 } from "@luxsim/project-io";

export type ProjectPatchBody = {
  name?: string;
  scene?: ProjectSceneV2;
  results?: ResultsV2;
};

export type ProjectSnapshot = {
  name: string;
  sceneJson: string;
  resultsJson: string;
};

/** UI that should not start an autosave by itself (still included when a real save runs). */
export function persistableScene(scene: ProjectSceneV2): ProjectSceneV2 {
  return {
    ...scene,
    ui: {
      ...scene.ui,
      activeStoreyId: "",
      activeRoomId: null,
      viewMode: "top",
      tool: "select",
      workflowMode: undefined,
      camera3d: null,
      display3d: undefined,
    },
  };
}

export function snapshotProject(
  name: string,
  scene: ProjectSceneV2,
  results: ResultsV2
): ProjectSnapshot {
  return {
    name,
    sceneJson: JSON.stringify(persistableScene(scene)),
    resultsJson: JSON.stringify(results),
  };
}

/** Only include keys that differ from the last successful save. Ephemeral UI is ignored. */
export function projectPatchDiff(
  current: ProjectSnapshot,
  last: ProjectSnapshot,
  scene: ProjectSceneV2,
  results: ResultsV2
): ProjectPatchBody | null {
  const body: ProjectPatchBody = {};
  if (current.name !== last.name) body.name = current.name;
  if (current.sceneJson !== last.sceneJson) body.scene = scene;
  if (current.resultsJson !== last.resultsJson) body.results = results;
  return Object.keys(body).length ? body : null;
}

export async function patchProjectMinimal(
  projectId: string,
  body: ProjectPatchBody
): Promise<{ ok: boolean; updatedAt?: string }> {
  const res = await fetch(`/api/projects/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false };
  const data = (await res.json().catch(() => null)) as { updatedAt?: string } | null;
  return { ok: true, updatedAt: data?.updatedAt };
}
