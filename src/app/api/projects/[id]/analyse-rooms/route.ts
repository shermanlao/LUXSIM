import { NextResponse } from "next/server";
import type { OfficialRoomAnalysisSummary, Vec2 } from "@luxsim/project-io";
import { analyseRoomsWithConfiguredAi } from "@/lib/analyse-rooms-ai";
import { apiErrorResponse } from "@/lib/api-error";
import { requireProjectAccess } from "@/lib/session";
import { getRoomAnalysisAiRuntimeConfig } from "@/lib/site-settings";

type Params = { params: Promise<{ id: string }> };

export const maxDuration = 180;

function logRoomAnalysis(entry: Record<string, unknown>) {
  console.info("Room-analysis AI", entry);
}

export async function POST(req: Request, { params }: Params) {
  const started = Date.now();
  try {
    const { id: projectId } = await params;
    await requireProjectAccess(projectId);

    const body = (await req.json().catch(() => ({}))) as {
      analysis?: OfficialRoomAnalysisSummary;
      outline?: Vec2[] | null;
    };

    const analysis = body.analysis;
    if (!analysis || typeof analysis !== "object") {
      return NextResponse.json({ error: "Room analysis summary is required" }, { status: 400 });
    }

    const config = await getRoomAnalysisAiRuntimeConfig();
    if (!config.configured) {
      logRoomAnalysis({
        configured: false,
        failed: false,
        failReason: null,
        parsedRoomCount: 0,
        filteredRoomCount: 0,
        lineworkCount: analysis.linework?.length ?? 0,
        candidateRingCount: analysis.candidateRings?.length ?? 0,
        imageWidth: null,
        imageHeight: null,
        sourceUsed: analysis.sourceUsed ?? "unknown",
        duration_ms: Date.now() - started,
      });
      return NextResponse.json({
        configured: false,
        failed: false,
        rooms: [],
      });
    }

    const result = await analyseRoomsWithConfiguredAi(
      config,
      analysis,
      body.outline ?? analysis.contour ?? null
    );
    logRoomAnalysis({
      configured: result.configured,
      failed: result.failed,
      failReason: result.failReason ?? null,
      provider: result.provider ?? config.provider,
      model: result.model ?? config.model,
      duration_ms: result.durationMs ?? Date.now() - started,
      imageWidth: result.imageWidth ?? null,
      imageHeight: result.imageHeight ?? null,
      lineworkCount: result.lineworkCount ?? analysis.linework?.length ?? 0,
      candidateRingCount: result.candidateRingCount ?? analysis.candidateRings?.length ?? 0,
      parsedRoomCount: result.parsedRoomCount ?? 0,
      filteredRoomCount: result.filteredRoomCount ?? result.rooms.length,
      sourceUsed: result.sourceUsed ?? analysis.sourceUsed ?? "unknown",
    });
    return NextResponse.json({
      configured: result.configured,
      failed: result.failed,
      failReason: result.failReason,
      rooms: result.rooms,
    });
  } catch (e) {
    const authRes = apiErrorResponse(e, "Room analysis failed");
    if (authRes.status !== 500) return authRes;
    console.error(e);
    return NextResponse.json({ error: "Room analysis failed" }, { status: 500 });
  }
}
