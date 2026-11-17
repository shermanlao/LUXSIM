import { notFound } from "next/navigation";
import { normalizeResults, normalizeScene } from "@luxsim/project-io";
import { loadPublicShareByToken } from "@/lib/load-public-share";
import { prisma } from "@/lib/prisma";
import { ViewOnlyProject } from "@/components/editor/ViewOnlyProject";

type Props = { params: Promise<{ token: string }> };

export default async function ViewProjectPage({ params }: Props) {
  const { token } = await params;
  const project = await loadPublicShareByToken(token);
  if (!project) notFound();

  const rawScene = JSON.parse(project.sceneJson);
  const scene = normalizeScene(rawScene);
  const results = normalizeResults(
    project.resultsJson ? JSON.parse(project.resultsJson) : null,
    scene
  );
  const usedIds = [
    ...new Set([...scene.fixtureLibraryIds, ...scene.instances.map((i) => i.luminaireId)]),
  ];
  const luminaires = usedIds.length
    ? await prisma.luminaire.findMany({
        where: { orgId: project.orgId, id: { in: usedIds } },
        select: {
          id: true,
          name: true,
          sourceFormat: true,
          originalName: true,
          watts: true,
          lumens: true,
          origin: true,
          libraryFamily: true,
          libraryBeamDeg: true,
          photometricJson: true,
        },
      })
    : [];

  return (
    <ViewOnlyProject
      token={token}
      projectId={project.id}
      name={project.name}
      scene={scene}
      results={results}
      assets={project.assets.map((a) => ({
        id: a.id,
        kind: a.kind,
        fileName: a.fileName,
        metaJson: a.metaJson,
      }))}
      luminaires={luminaires.map((l) => {
        let photometric = null;
        try {
          photometric = l.photometricJson ? JSON.parse(l.photometricJson) : null;
        } catch {
          photometric = null;
        }
        return {
          id: l.id,
          name: l.name,
          sourceFormat: l.sourceFormat,
          originalName: l.originalName,
          watts: l.watts,
          lumens: l.lumens,
          origin: l.origin,
          libraryFamily: l.libraryFamily,
          libraryBeamDeg: l.libraryBeamDeg,
          photometric,
        };
      })}
    />
  );
}
