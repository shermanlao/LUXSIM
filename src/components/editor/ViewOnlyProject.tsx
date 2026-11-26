"use client";

import type { PhotometricData } from "@luxsim/photometry";
import type { ProjectSceneV2, ResultsV2 } from "@luxsim/project-io";
import { BuildingEditor } from "@/components/editor/BuildingEditor";
import { CadEditorRoot } from "@/components/editor/CadEditorRoot";
import { ProjectEditorLoadGate } from "@/components/ProjectEditorLoadGate";

type LumRow = {
  id: string;
  name: string;
  sourceFormat?: string;
  originalName?: string;
  watts: number | null;
  lumens: number | null;
  origin?: string | null;
  libraryFamily?: string | null;
  libraryBeamDeg?: number | null;
  photometric?: PhotometricData | null;
};

type AssetRow = {
  id: string;
  kind: string;
  fileName: string;
  metaJson: string;
};

export function ViewOnlyProject(props: {
  token: string;
  projectId: string;
  name: string;
  scene: ProjectSceneV2;
  results: ResultsV2;
  assets: AssetRow[];
  luminaires: LumRow[];
}) {
  const photometry: Record<string, PhotometricData> = {};
  for (const lum of props.luminaires) {
    if (lum.photometric) photometry[lum.id] = lum.photometric;
  }
  return (
    <CadEditorRoot>
      <ProjectEditorLoadGate>
        <BuildingEditor
          projectId={props.projectId}
          initialName={props.name}
          initialScene={props.scene}
          initialResults={props.results}
          initialAssets={props.assets}
          initialLibrary={props.luminaires}
          initialPhotometry={photometry}
          readOnly
          shareBasePath={`/api/share/${props.token}`}
        />
      </ProjectEditorLoadGate>
    </CadEditorRoot>
  );
}
