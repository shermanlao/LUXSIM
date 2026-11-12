export const LUMINAIRE_ORIGIN_UPLOAD = "upload";
export const LUMINAIRE_ORIGIN_LIBRARY_CONE = "library_cone";

export type LuminaireOriginFields = {
  origin?: string | null;
  libraryFamily?: string | null;
  libraryBeamDeg?: number | null;
};

export function isLibraryCone(row: LuminaireOriginFields | null | undefined): boolean {
  return row?.origin === LUMINAIRE_ORIGIN_LIBRARY_CONE;
}

/** Short badge such as `Library cone · 160°` or `Library cone · Linear 120°`. */
export function libraryConeLabel(row: LuminaireOriginFields | null | undefined): string | null {
  if (!isLibraryCone(row)) return null;
  const beam = row?.libraryBeamDeg;
  if (beam == null || !Number.isFinite(beam)) return "Library cone";
  if (row?.libraryFamily === "linear") return `Library cone · Linear ${beam}°`;
  return `Library cone · ${beam}°`;
}

export function luminaireListLabel(
  name: string,
  row: LuminaireOriginFields | null | undefined
): string {
  const cone = libraryConeLabel(row);
  return cone ? `${name} (${cone})` : name;
}
