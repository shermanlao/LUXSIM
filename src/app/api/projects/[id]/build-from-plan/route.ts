import { NextResponse } from "next/server";
import {
  officialBuildFromPlanGeometry,
  officialDxfWorldEntitiesForRooms,
  type OfficialDxfRoomsUnderlay,
  type Vec2,
} from "@luxsim/project-io";
import { apiErrorResponse } from "@/lib/api-error";
import { requireProjectAccess } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

export const maxDuration = 60;

export async function POST(req: Request, { params }: Params) {
  try {
    const { id: projectId } = await params;
    await requireProjectAccess(projectId);

    const body = (await req.json().catch(() => ({}))) as {
      underlay?: OfficialDxfRoomsUnderlay | null;
      existingOutline?: Vec2[] | null;
    };

    const world = officialDxfWorldEntitiesForRooms(body.underlay ?? null);
    const result = officialBuildFromPlanGeometry(world, body.existingOutline ?? null);
    return NextResponse.json({
      outline: result.outline,
      outlineCreated: result.outlineCreated,
      outlineExisting: result.outlineExisting,
      outlineFailed: result.outlineFailed,
      layoutFound: result.layoutFound,
      rooms: result.rooms,
      status: result.status,
      analysis: result.analysis,
    });
  } catch (e) {
    const authRes = apiErrorResponse(e, "Build from plan failed");
    if (authRes.status !== 500) return authRes;
    console.error(e);
    return NextResponse.json({ error: "Build from plan failed" }, { status: 500 });
  }
}
