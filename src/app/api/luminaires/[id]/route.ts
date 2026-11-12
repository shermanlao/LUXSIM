import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { requireLuminaireAccess } from "@/lib/session";
import { readTextFile } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { luminaire } = await requireLuminaireAccess(id);
    const photometric = JSON.parse(luminaire.photometricJson);
    let sourceText: string | null = null;
    try {
      sourceText = await readTextFile(luminaire.fileKey);
    } catch {
      sourceText = null;
    }
    return NextResponse.json({ ...luminaire, photometric, sourceText });
  } catch (e) {
    return apiErrorResponse(e);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { luminaire: existing } = await requireLuminaireAccess(id);
    await prisma.luminaire.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
