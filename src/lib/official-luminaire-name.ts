/**
 * Official display name for an uploaded luminaire.
 * A typed name wins; otherwise use the photometry description, then catalog
 * number, then the original file name. Do not substitute the file stem.
 */
export function officialLuminaireDisplayName(input: {
  userName?: string | null;
  description?: string | null;
  catalogNumber?: string | null;
  fileName: string;
}): string {
  return (
    input.userName?.trim() ||
    input.description ||
    input.catalogNumber ||
    input.fileName
  );
}
