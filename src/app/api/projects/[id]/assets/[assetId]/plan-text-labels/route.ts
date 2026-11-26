import { NextResponse } from "next/server";
import fs from "fs/promises";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { requireProjectAccess } from "@/lib/session";
import { absolutePath } from "@/lib/storage";
import {
  OfficialPlanTextError,
  officialLoadPlanTextLabels,
  officialParseMetaJson,
} from "@/lib/official-plan-text-labels";

type Params = { params: Promise<{ id: string; assetId: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id, assetId } = await params;
    await requireProjectAccess(id);
    const asset = await prisma.projectAsset.findFirst({
      where: { id: assetId, projectId: id },
    });
    if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const kind = String(asset.kind || "").toLowerCase();
    if (kind !== "dxf" && kind !== "dwg") {
      return NextResponse.json(
        {
          error:
            "Import a DXF or converted DWG plan first / 請先匯入 DXF 或已轉換的 DWG 圖則",
        },
        { status: 400 }
      );
    }

    const data = await fs.readFile(absolutePath(asset.fileKey));
    const loaded = await officialLoadPlanTextLabels({
      kind,
      data,
      metaJson: asset.metaJson,
    });

    if (!loaded.cached) {
      const meta = officialParseMetaJson(asset.metaJson);
      meta.textLabels = loaded.labels;
      await prisma.projectAsset.update({
        where: { id: asset.id },
        data: { metaJson: JSON.stringify(meta) },
      });
    }

    return NextResponse.json({ labels: loaded.labels, count: loaded.labels.length });
  } catch (e) {
    const authRes = apiErrorResponse(e);
    if (authRes.status !== 500) return authRes;
    if (e instanceof OfficialPlanTextError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Could not read plan codes" }, { status: 500 });
  }
}
