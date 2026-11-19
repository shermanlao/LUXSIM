import { NextResponse } from "next/server";
import { normalizeResults, normalizeScene } from "@luxsim/project-io";
import { loadPublicShareByToken } from "@/lib/load-public-share";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ token: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { token } = await params;
    const project = await loadPublicShareByToken(token);
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

    return NextResponse.json({
      id: project.id,
      name: project.name,
      scene,
      results,
      assets: project.assets.map((a) => ({
        id: a.id,
        kind: a.kind,
        fileName: a.fileName,
        metaJson: a.metaJson,
        createdAt: a.createdAt,
      })),
      luminaires: luminaires.map((l) => {
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
      }),
      readOnly: true,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
