export type { PhotometricData, ParseResult, SourceFormat, LuminaireBody } from "./types";
export { parseIes } from "./parse-ies";
export { parseLdt, expandIntensityPlanes } from "./parse-ldt";
export { sampleIntensityCd, polarPreview, polarPlane, polarToXY } from "./interpolate";
export type { PolarPoint } from "./interpolate";
export {
  estimateFlux,
  resolvedFlux,
  luminaireBody,
  formatDimensions,
  formatCct,
} from "./flux";

export {
  parseEulumdat,
  writeEulumdat,
  emptyDirectRatios,
  storedIntensityPlaneCount,
  formatLdtNumber,
  isValidEulumdatText,
} from "./eulumdat";
export type { EulumdatDocument, EulumdatLampSet } from "./eulumdat";

export {
  CIRCULAR_BEAM_DEGREES,
  LINEAR_BEAM_DEGREES,
  PHOTOMETRIC_FAMILIES,
  isPhotometricFamily,
  libraryBeamsForFamily,
  isLibraryBeamDegrees,
  defaultLibraryBeam,
  parseFirstNumber,
  parseBeamAngle,
  nearestBeamInKeys,
  nearestCircularBeam,
  nearestLinearBeam,
  nearestLibraryBeam,
  recommendLibraryBeam,
  recommendPhotometricFamily,
} from "./beam-keys";
export type {
  CircularBeamDegrees,
  LinearBeamDegrees,
  PhotometricFamily,
  ParsedBeamAngle,
  BeamRecommendKind,
  BeamRecommendation,
  FamilyRecommendInput,
} from "./beam-keys";

export { parseFixtureSizeMm, formatFixtureSizeMm } from "./fixture-size";
export type { FixtureSizeMm } from "./fixture-size";

export {
  LINEAR_SAMPLE_SIZE_MM,
  buildCircularConeDocument,
  buildLinearConeDocument,
  buildLibraryConeDocument,
  synthesizeCircularLdt,
  synthesizeLinearLdt,
  integrateAxialFlux,
} from "./synthesize-cone";

export {
  previewLibraryConeStamp,
  stampLibraryConeDocument,
  stampEulumdatText,
  libraryConeDownloadName,
} from "./stamp-ldt";
export type { LibraryConeStamp, LibraryConeStampPreview } from "./stamp-ldt";

export { generateLibraryCone } from "./generate-ldt";
export type { GenerateLibraryConeInput, GenerateLibraryConeResult } from "./generate-ldt";

import { parseIes } from "./parse-ies";
import { parseLdt } from "./parse-ldt";
import type { ParseResult, SourceFormat } from "./types";

export function parsePhotometricFile(
  text: string,
  format: SourceFormat
): ParseResult {
  if (format === "ies") return parseIes(text);
  return parseLdt(text);
}

export function detectFormat(filename: string): SourceFormat | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".ies")) return "ies";
  if (lower.endsWith(".ldt")) return "ldt";
  return null;
}
