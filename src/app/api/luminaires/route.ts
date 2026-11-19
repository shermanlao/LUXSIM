import { NextResponse } from "next/server";
import {
  detectFormat,
  detectUploadFormat,
  parseGldfContainer,
  parsePhotometricFile,
  GLDF_MAX_CONTAINER_BYTES,
} from "@luxsim/photometry";
import { apiErrorResponse } from "@/lib/api-error";
import { officialLuminaireDisplayName } from "@/lib/official-luminaire-name";
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
    const uploadFormat = detectUploadFormat(file.name);
    if (!uploadFormat) {
      return NextResponse.json({ error: "Only .ies, .ldt, or .gldf files are supported" }, { status: 400 });
    }

    const maxBytes = uploadFormat === "gldf" ? GLDF_MAX_CONTAINER_BYTES : 2_000_000;
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: uploadFormat === "gldf" ? "File too large (max 10MB)" : "File too large (max 2MB)" },
        { status: 400 },
      );
    }

    if (uploadFormat === "gldf") {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const parsed = await parseGldfContainer(bytes);
      const userName = form.get("name") as string | null;
      const luminaires = [];
      const warnings = [...parsed.warnings];
      for (const entry of parsed.entries) {
        const name = officialLuminaireDisplayName({
          userName,
          description: entry.displayName || entry.data.description,
          catalogNumber: entry.catalogNumber || entry.data.catalogNumber,
          fileName: file.name,
        });
        const storedName = entry.photometryFileName || file.name;
        const fileKey = await saveTextFile("luminaires", storedName, entry.text);
        const luminaire = await prisma.luminaire.create({
          data: {
            orgId,
            name,
            sourceFormat: "gldf",
            fileKey,
            originalName: file.name,
            photometricJson: JSON.stringify(entry.data),
            watts: entry.data.watts,
            lumens: entry.data.luminousFlux,
          },
        });
        luminaires.push(luminaire);
        warnings.push(...entry.warnings);
      }
      return NextResponse.json({ luminaire: luminaires[0], luminaires, warnings });
    }

    const format = detectFormat(file.name);
    if (!format) {
      return NextResponse.json({ error: "Only .ies, .ldt, or .gldf files are supported" }, { status: 400 });
    }

    const text = await file.text();
    const { data, warnings } = parsePhotometricFile(text, format);
    const name = officialLuminaireDisplayName({
      userName: form.get("name") as string | null,
      description: data.description,
      catalogNumber: data.catalogNumber,
      fileName: file.name,
    });

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
