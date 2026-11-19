import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { requireLuminaireAccess } from "@/lib/session";
import { readTextFile } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

function dispositionFilename(name: string): string {
  const base = name.replace(/[\r\n"]+/g, "").trim() || "luminaire.ldt";
  const filename = base.toLowerCase().endsWith(".ldt") ? base : `${base}.ldt`;
  return `attachment; filename="${filename}"`;
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
    return new NextResponse(text, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": dispositionFilename(luminaire.originalName || `${luminaire.name}.ldt`),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
