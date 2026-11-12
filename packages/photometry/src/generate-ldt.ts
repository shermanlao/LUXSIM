import {
  isLibraryBeamDegrees,
  isPhotometricFamily,
  type PhotometricFamily,
} from "./beam-keys";
import { writeEulumdat } from "./eulumdat";
import { buildLibraryConeDocument } from "./synthesize-cone";
import {
  libraryConeDownloadName,
  stampLibraryConeDocument,
  type LibraryConeStamp,
} from "./stamp-ldt";

export type GenerateLibraryConeInput = LibraryConeStamp & {
  family: PhotometricFamily;
  beamDegrees: number;
};

export type GenerateLibraryConeResult = {
  text: string;
  family: PhotometricFamily;
  beamDegrees: number;
  downloadName: string;
};

export function generateLibraryCone(input: GenerateLibraryConeInput): GenerateLibraryConeResult {
  if (!isPhotometricFamily(input.family)) {
    throw new Error("Shape must be circular cone or linear / LED strip");
  }
  if (!Number.isFinite(input.beamDegrees) || !isLibraryBeamDegrees(input.family, input.beamDegrees)) {
    throw new Error("Pick a library beam from the available keys");
  }
  if (!Number.isFinite(input.lumens) || input.lumens <= 0) {
    throw new Error("Lumen output is required to generate an LDT file");
  }

  const template = buildLibraryConeDocument(input.family, input.beamDegrees);
  const stamped = stampLibraryConeDocument(template, input, input.family);
  return {
    text: writeEulumdat(stamped),
    family: input.family,
    beamDegrees: input.beamDegrees,
    downloadName: libraryConeDownloadName(input),
  };
}
