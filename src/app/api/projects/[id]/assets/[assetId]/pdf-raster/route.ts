import { NextResponse } from "next/server";
import fs from "fs/promises";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { requireProjectAccess } from "@/lib/session";
import { absolutePath } from "@/lib/storage";
import {
  createPdfRasterAsset,
  PdfEncryptedError,
  PdfInvalidError,
} from "@/lib/pdf-raster-ingest";

type Params = { params: Promise<{ id: string; assetId: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const { id: projectId, assetId } = await params;
    const { project } = await requireProjectAccess(projectId);

    const asset = await prisma.projectAsset.findFirst({
      where: { id: assetId, projectId },
    });
    if (!asset || asset.kind !== "pdf") {
      return NextResponse.json({ error: "PDF asset required" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as { pageIndex?: number };
    const pageIndex = Number.isFinite(body.pageIndex) ? Math.floor(body.pageIndex!) : 0;

    const pdfBuffer = await fs.readFile(absolutePath(asset.fileKey));
    const { rasterAsset, raster } = await createPdfRasterAsset({
      projectId,
      pdfAssetId: asset.id,
      pdfFileName: asset.fileName,
      pdfBuffer,
      pageIndex,
    });

    const prevMeta = JSON.parse(asset.metaJson || "{}") as Record<string, unknown>;
    await prisma.projectAsset.update({
      where: { id: asset.id },
      data: {
        metaJson: JSON.stringify({
          ...prevMeta,
          pageCount: raster.pageCount,
          lastPageIndex: raster.pageIndex,
          lastRasterAssetId: rasterAsset.id,
          rasterDpi: raster.rasterDpi,
          widthPx: raster.widthPx,
          heightPx: raster.heightPx,
        }),
      },
    });

    return NextResponse.json({
      rasterAsset,
      raster: {
        widthPx: raster.widthPx,
        heightPx: raster.heightPx,
        rasterDpi: raster.rasterDpi,
        pageCount: raster.pageCount,
        pageIndex: raster.pageIndex,
      },
      warnings: raster.warnings,
    });
  } catch (e) {
    const authRes = apiErrorResponse(e);
    if (authRes.status !== 500) return authRes;
    if (e instanceof PdfEncryptedError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    if (e instanceof PdfInvalidError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "PDF raster failed" }, { status: 500 });
  }
}
