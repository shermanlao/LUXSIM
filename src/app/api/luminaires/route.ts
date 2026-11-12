import { NextResponse } from "next/server";
import {
  detectFormat,
  parsePhotometricFile,
} from "@luxsim/photometry";
import { apiErrorResponse } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getUserOrgIds, requireOrgContext, requireUser } from "@/lib/session";
import { saveTextFile } from "@/lib/storage";

export async function GET() {
  try {
    const user = await requireUser();
    const orgIds = await getUserOrgIds(user.id);
    const luminaires = await prisma.luminaire.findMany({
      where: { orgId: { in: orgIds } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        orgId: true,
        sourceFormat: true,
        originalName: true,
        watts: true,
        lumens: true,
        lightxProductId: true,
        origin: true,
        libraryFamily: true,
        libraryBeamDeg: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return NextResponse.json(luminaires);
  } catch (e) {
    return apiErrorResponse(e, "Failed to list luminaires");
  }
}

export async function POST(req: Request) {
  try {
    const { orgId } = await requireOrgContext();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }
    if (file.size > 2_000_000) {
      return NextResponse.json({ error: "File too large (max 2MB)" }, { status: 400 });
    }

    const format = detectFormat(file.name);
    if (!format) {
      return NextResponse.json({ error: "Only .ies or .ldt files are supported" }, { status: 400 });
    }

    const text = await file.text();
    const { data, warnings } = parsePhotometricFile(text, format);
    const name =
      (form.get("name") as string)?.trim() ||
      data.description ||
      data.catalogNumber ||
      file.name;

    const fileKey = await saveTextFile("luminaires", file.name, text);

    const luminaire = await prisma.luminaire.create({
      data: {
        orgId,
        name,
        sourceFormat: format,
        fileKey,
        originalName: file.name,
        photometricJson: JSON.stringify(data),
        watts: data.watts,
        lumens: data.luminousFlux,
      },
    });

    return NextResponse.json({ luminaire, warnings });
  } catch (e) {
    if (e instanceof Error && e.message in { UNAUTHORIZED: 1, FORBIDDEN: 1, NO_ORG: 1, NOT_FOUND: 1 }) {
      return apiErrorResponse(e, "Upload failed");
    }
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 400 }
    );
  }
}
