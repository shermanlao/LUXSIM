import { NextResponse } from "next/server";
import {
  officialArchitecturalLayersHidden,
  officialBuildFromPlanGeometry,
  officialBuildRoomAnalysisSummary,
  officialLeftoverAreaInsideContourM2,
  officialShouldAnalyseLeftoverSpace,
  type OfficialDxfRoomsUnderlay,
  type Vec2,
} from "@luxsim/project-io";
import { apiErrorResponse } from "@/lib/api-error";
import { officialLoadPlanEntitiesForBuildFromPlan } from "@/lib/official-plan-full-source";
import { requireProjectAccess } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

export const maxDuration = 60;

export async function POST(req: Request, { params }: Params) {
  const started = Date.now();
  try {
    const { id: projectId } = await params;
    await requireProjectAccess(projectId);

    const body = (await req.json().catch(() => ({}))) as {
      assetId?: string | null;
      underlay?: OfficialDxfRoomsUnderlay | null;
      existingOutline?: Vec2[] | null;
      replaceExistingOutline?: boolean;
      hiddenLayers?: string[] | null;
    };

    const hiddenLayers = body.hiddenLayers ?? null;
    const source = await officialLoadPlanEntitiesForBuildFromPlan({
      projectId,
      assetId: body.assetId ?? null,
      underlay: body.underlay ?? null,
    });
    const replace = body.replaceExistingOutline === true;
    const result = officialBuildFromPlanGeometry(
      source.worldEntities,
      replace ? null : (body.existingOutline ?? null)
    );
    const analysis = officialBuildRoomAnalysisSummary(
      source.worldEntities,
      result.outline,
      result.analysis.candidateRings,
      {
        textLabels: source.textLabels,
        acceptedRooms: result.rooms,
        sourceUsed: source.sourceUsed,
        cropToContour: true,
      }
    );
    const leftoverAreaM2 = officialLeftoverAreaInsideContourM2(
      result.outline,
      result.rooms
    );
    const shouldAnalyseLeftover = officialShouldAnalyseLeftoverSpace(
      result.outline,
      result.rooms
    );
    const architecturalLayersHidden = officialArchitecturalLayersHidden(hiddenLayers);

    console.info("Build from plan", {
      sourceUsed: source.sourceUsed,
      entityCount: source.worldEntities.length,
      lineworkCount: analysis.linework.length,
      candidateRingCount: analysis.candidateRings.length,
      textLabelCount: analysis.textLabels?.length ?? 0,
      layoutFound: result.layoutFound,
      parsedRoomCount: result.rooms.length,
      leftoverAreaM2: Math.round(leftoverAreaM2 * 100) / 100,
      leftoverAreaSought: shouldAnalyseLeftover,
      contourVertexCount: result.outline?.length ?? 0,
      architecturalLayersHidden,
      duration_ms: Date.now() - started,
    });

    return NextResponse.json({
      outline: result.outline,
      outlineCreated: result.outlineCreated,
      outlineExisting: result.outlineExisting,
      outlineFailed: result.outlineFailed,
      layoutFound: result.layoutFound,
      rooms: result.rooms,
      status: result.status,
      analysis,
      sourceUsed: source.sourceUsed,
      shouldAnalyseLeftover,
      architecturalLayersHidden,
    });
  } catch (e) {
    const authRes = apiErrorResponse(e, "Build from plan failed");
    if (authRes.status !== 500) return authRes;
    console.error(e);
    return NextResponse.json({ error: "Build from plan failed" }, { status: 500 });
  }
}
