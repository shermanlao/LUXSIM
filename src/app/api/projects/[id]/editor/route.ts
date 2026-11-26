import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import {
  officialLoadProjectEditorPayload,
  officialProjectEditorEtag,
} from "@/lib/official-project-editor-payload";
import { requireProjectAccessMeta } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

function payloadHeaders(etag: string): HeadersInit {
  return {
    ETag: etag,
    "Cache-Control": "private, no-cache",
  };
}

export async function GET(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { project } = await requireProjectAccessMeta(id);
    const etag = officialProjectEditorEtag(project.id, project.updatedAt);
    if (req.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304, headers: payloadHeaders(etag) });
    }

    const payload = await officialLoadProjectEditorPayload(project.id);
    if (!payload) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const nextEtag = officialProjectEditorEtag(payload.id, payload.updatedAt);
    return NextResponse.json(payload, { headers: payloadHeaders(nextEtag) });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
