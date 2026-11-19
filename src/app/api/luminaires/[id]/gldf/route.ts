import { NextResponse } from "next/server";
import { buildGldfContainer, gldfDownloadFileName } from "@luxsim/photometry";
import type { PhotometricData, SourceFormat } from "@luxsim/photometry";
import { apiErrorResponse } from "@/lib/api-error";
import { requireLuminaireAccess } from "@/lib/session";
import { readTextFile } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

function photometryFormat(data: PhotometricData | null, originalName: string | null): SourceFormat {
  if (data?.format === "ies" || data?.format === "ldt") return data.format;
  const lower = (originalName ?? "").toLowerCase();
  if (lower.endsWith(".ies")) return "ies";
  return "ldt";
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { luminaire } = await requireLuminaireAccess(id);
    let text: string;
    try {
      text = await readTextFile(luminaire.fileKey);
    } catch {
      return NextResponse.json({ error: "Photometric file is missing" }, { status: 404 });
    }
    let photometric: PhotometricData | null = null;
    try {
      photometric = JSON.parse(luminaire.photometricJson) as PhotometricData;
    } catch {
      photometric = null;
    }
    const format = photometryFormat(photometric, luminaire.originalName);
    const bytes = await buildGldfContainer({
      manufacturer: photometric?.manufacturer,
      productName: luminaire.name,
      catalogNumber: photometric?.catalogNumber,
      format,
      photometryText: text,
      photometryFileName: luminaire.originalName || luminaire.name,
    });
    const filename = gldfDownloadFileName(luminaire.originalName || luminaire.name);
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
