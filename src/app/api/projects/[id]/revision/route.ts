import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import {
  officialProjectEditorEtag,
  officialRevisionFromMeta,
} from "@/lib/official-project-editor-payload";
import { requireProjectAccessMeta } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

function revisionHeaders(etag: string): HeadersInit {
  return {
    ETag: etag,
    "Cache-Control": "private, no-cache",
  };
}

export async function GET(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { project } = await requireProjectAccessMeta(id);
    const revision = officialRevisionFromMeta(project);
    const etag = officialProjectEditorEtag(project.id, project.updatedAt);
    if (req.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304, headers: revisionHeaders(etag) });
    }
    return NextResponse.json(revision, { headers: revisionHeaders(etag) });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
