import type { ProjectSceneV2, ResultsV2 } from "@luxsim/project-io";

export type OfficialEditorAssetRow = {
  id: string;
  kind: string;
  fileName: string;
  metaJson: string;
  createdAt: string;
};

export type OfficialProjectRevision = {
  id: string;
  name: string;
  updatedAt: string;
};

export type OfficialProjectEditorPayload = OfficialProjectRevision & {
  scene: ProjectSceneV2;
  results: ResultsV2;
  assets: OfficialEditorAssetRow[];
};

export function officialIsoTimestamp(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : String(value);
}

export function officialProjectRevisionMatches(
  cachedUpdatedAt: string,
  serverUpdatedAt: string
): boolean {
  if (cachedUpdatedAt === serverUpdatedAt) return true;
  return officialIsoTimestamp(cachedUpdatedAt) === officialIsoTimestamp(serverUpdatedAt);
}

export function officialProjectEditorEtag(
  projectId: string,
  updatedAt: Date | string
): string {
  return `W/"luxsim-editor-${projectId}-${officialIsoTimestamp(updatedAt)}"`;
}

export function officialRevisionFromMeta(project: {
  id: string;
  name: string;
  updatedAt: Date | string;
}): OfficialProjectRevision {
  return {
    id: project.id,
    name: project.name,
    updatedAt: officialIsoTimestamp(project.updatedAt),
  };
}
