import { NextResponse } from "next/server";
import fs from "fs/promises";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { requireProjectAccess } from "@/lib/session";
import { absolutePath } from "@/lib/storage";
import {
  OfficialCadLayerBackfillError,
  officialBackfillStoredCadLayerMeta,
} from "@/lib/official-cad-layer-backfill";

type Params = { params: Promise<{ id: string; assetId: string }> };

export async function POST(_req: Request, { params }: Params) {
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
            "Plan layers can only be updated for a DXF or DWG plan. / 只有 DXF 或 DWG 圖則可以更新圖層",
        },
        { status: 400 }
      );
    }

    let data: Buffer;
    try {
      data = await fs.readFile(absolutePath(asset.fileKey));
    } catch {
      return NextResponse.json(
        {
          error:
            "Could not update plan layers from the stored file. / 無法從已儲存的圖則檔更新圖層",
        },
        { status: 400 }
      );
    }

    const loaded = await officialBackfillStoredCadLayerMeta({
      kind,
      data,
      metaJson: asset.metaJson,
    });

    if (!loaded.changed) {
      return NextResponse.json({ asset });
    }

    const metaJson = JSON.stringify(loaded.meta);
    const updated = await prisma.projectAsset.update({
      where: { id: asset.id },
      data: { metaJson },
    });
    return NextResponse.json({
      asset: {
        ...updated,
        metaJson,
      },
    });
  } catch (e) {
    const authRes = apiErrorResponse(e);
    if (authRes.status !== 500) return authRes;
    if (e instanceof OfficialCadLayerBackfillError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json(
      {
        error:
          "Could not update plan layers from the stored file. / 無法從已儲存的圖則檔更新圖層",
      },
      { status: 500 }
    );
  }
}
