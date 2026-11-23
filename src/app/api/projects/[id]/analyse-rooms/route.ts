import { NextResponse } from "next/server";
import type { OfficialRoomAnalysisSummary, Vec2 } from "@luxsim/project-io";
import { analyseRoomsWithConfiguredAi } from "@/lib/analyse-rooms-ai";
import { apiErrorResponse } from "@/lib/api-error";
import { requireProjectAccess } from "@/lib/session";
import { getRoomAnalysisAiRuntimeConfig } from "@/lib/site-settings";

type Params = { params: Promise<{ id: string }> };

export const maxDuration = 60;

export async function POST(req: Request, { params }: Params) {
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
    return NextResponse.json({
      configured: result.configured,
      failed: result.failed,
      rooms: result.rooms,
    });
  } catch (e) {
    const authRes = apiErrorResponse(e, "Room analysis failed");
    if (authRes.status !== 500) return authRes;
    console.error(e);
    return NextResponse.json({ error: "Room analysis failed" }, { status: 500 });
  }
}
