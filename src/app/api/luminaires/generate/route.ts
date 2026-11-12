import { NextResponse } from "next/server";
import { generateLibraryCone, isPhotometricFamily, parseLdt } from "@luxsim/photometry";
import { apiErrorResponse } from "@/lib/api-error";
import { LUMINAIRE_ORIGIN_LIBRARY_CONE } from "@/lib/luminaire-origin";
import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/lib/session";
import { saveTextFile } from "@/lib/storage";

type GenerateBody = {
  family?: unknown;
  beamDegrees?: unknown;
  name?: unknown;
  catalogNumber?: unknown;
  lumens?: unknown;
  watts?: unknown;
  cctK?: unknown;
  cri?: unknown;
  size?: unknown;
};

function optionalNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function optionalString(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s || undefined;
}

export async function POST(req: Request) {
  try {
    const { orgId } = await requireOrgContext();
    const body = (await req.json()) as GenerateBody;

    const familyRaw = optionalString(body.family) ?? "";
    if (!isPhotometricFamily(familyRaw)) {
      return NextResponse.json(
        { error: "Shape must be circular cone or linear / LED strip" },
        { status: 400 }
      );
    }

    const lumens = optionalNumber(body.lumens);
    if (lumens == null || lumens <= 0) {
      return NextResponse.json(
        { error: "Lumen output is required to generate an LDT file" },
        { status: 400 }
      );
    }

    const beamDegrees = optionalNumber(body.beamDegrees);
    if (beamDegrees == null) {
      return NextResponse.json({ error: "Pick a library beam" }, { status: 400 });
    }

    const watts = optionalNumber(body.watts);
    const cctK = optionalNumber(body.cctK);
    const cri = optionalNumber(body.cri);
    if (watts != null && watts < 0) {
      return NextResponse.json({ error: "Wattage cannot be negative" }, { status: 400 });
    }
    if (cctK != null && cctK < 0) {
      return NextResponse.json({ error: "CCT cannot be negative" }, { status: 400 });
    }
    if (cri != null && cri < 0) {
      return NextResponse.json({ error: "CRI cannot be negative" }, { status: 400 });
    }

    const name = optionalString(body.name);
    const catalogNumber = optionalString(body.catalogNumber);
    const size = optionalString(body.size);

    const generated = generateLibraryCone({
      family: familyRaw,
      beamDegrees,
      name,
      catalogNumber,
      lumens,
      watts,
      cctK,
      cri,
      size,
    });

    const { data, warnings } = parseLdt(generated.text);
    const displayName =
      name || data.description || `Library cone ${generated.beamDegrees}°`;

    const fileKey = await saveTextFile("luminaires", generated.downloadName, generated.text);

    const luminaire = await prisma.luminaire.create({
      data: {
        orgId,
        name: displayName,
        sourceFormat: "ldt",
        fileKey,
        originalName: generated.downloadName,
        photometricJson: JSON.stringify(data),
        watts: data.watts,
        lumens: data.luminousFlux,
        origin: LUMINAIRE_ORIGIN_LIBRARY_CONE,
        libraryFamily: generated.family,
        libraryBeamDeg: generated.beamDegrees,
      },
    });

    return NextResponse.json({
      luminaire,
      warnings,
      photometric: data,
      downloadName: generated.downloadName,
    });
  } catch (e) {
    if (e instanceof Error && e.message in { UNAUTHORIZED: 1, FORBIDDEN: 1, NO_ORG: 1, NOT_FOUND: 1 }) {
      return apiErrorResponse(e, "Generate failed");
    }
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Generate failed" },
      { status: 400 }
    );
  }
}
