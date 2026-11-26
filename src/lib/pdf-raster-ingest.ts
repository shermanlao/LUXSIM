import { prisma } from "@/lib/prisma";
import { saveBinaryFile } from "@/lib/storage";
import {
  PdfEncryptedError,
  PdfInvalidError,
  rasterizePdfPage,
  type PdfRasterResult,
} from "@/lib/pdf-raster";

export async function createPdfRasterAsset(input: {
  projectId: string;
  pdfAssetId: string;
  pdfFileName: string;
  pdfBuffer: Buffer;
  pageIndex?: number;
}): Promise<{
  rasterAsset: { id: string; kind: string; fileName: string; metaJson: string };
  raster: PdfRasterResult;
}> {
  const pageIndex = input.pageIndex ?? 0;
  const raster = await rasterizePdfPage(input.pdfBuffer, pageIndex);

  const base = input.pdfFileName.replace(/\.pdf$/i, "") || "plan";
  const rasterFileName = `${base}.page${pageIndex}.png`;
  const fileKey = await saveBinaryFile("assets", rasterFileName, raster.png);

  const rasterAsset = await prisma.projectAsset.create({
    data: {
      projectId: input.projectId,
      kind: "image",
      fileKey,
      fileName: rasterFileName,
      metaJson: JSON.stringify({
        sourcePdfAssetId: input.pdfAssetId,
        pageIndex: raster.pageIndex,
        rasterDpi: raster.rasterDpi,
        widthPx: raster.widthPx,
        heightPx: raster.heightPx,
      }),
    },
  });

  return { rasterAsset, raster };
}

export { PdfEncryptedError, PdfInvalidError };
