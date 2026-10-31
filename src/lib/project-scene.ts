import {
  normalizeResults,
  normalizeScene,
  type ProjectSceneV2,
  type ResultsV2,
} from "@luxsim/project-io";

export function parseProjectScene(sceneJson: string): ProjectSceneV2 {
  try {
    return normalizeScene(JSON.parse(sceneJson));
  } catch {
    return normalizeScene(null);
  }
}

export function parseProjectResults(
  resultsJson: string | null | undefined,
  scene: ProjectSceneV2
): ResultsV2 {
  if (!resultsJson) return { version: 2, byRoomId: {} };
  try {
    return normalizeResults(JSON.parse(resultsJson), scene);
  } catch {
    return { version: 2, byRoomId: {} };
  }
}
