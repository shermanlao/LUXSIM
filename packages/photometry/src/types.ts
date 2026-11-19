export type SourceFormat = "ies" | "ldt";

/** Candela intensity table in vertical × horizontal angles */
export interface PhotometricData {
  format: SourceFormat;
  manufacturer: string;
  catalogNumber: string;
  description: string;
  /** Total luminous flux (lm), if known from the file header */
  luminousFlux: number | null;
  /** Input watts, if known */
  watts: number | null;
  /** Lamp count used in photometric test */
  lampCount: number;
  /** Candela multiplier / ballast factor applied to intensities */
  ballastFactor: number;
  /** Vertical angles in degrees (Type C: 0–180 nadir to zenith; Type B: often −90–90) */
  verticalAngles: number[];
  /** Horizontal angles in degrees (typically 0–360, or −90–90 for Type B) */
  horizontalAngles: number[];
  /**
   * intensities[hIndex][vIndex] in candela
   */
  intensities: number[][];
  /** Symmetry hint for interpolation */
  symmetry: "none" | "axial" | "quad" | "bilateral";
  /** IES photometric type: 1 = C, 2 = B, 3 = A */
  photometryType?: number;
  /** Signed luminous-opening width in metres (negative = circular on that axis) */
  openingWidthM?: number;
  /** Signed luminous-opening length in metres (negative = circular on that axis) */
  openingLengthM?: number;
  /** Signed luminous-opening height in metres */
  openingHeightM?: number;
  /** Colour temperature from IES keywords, if present */
  cctK?: number | null;
  /** Colour rendering index from IES keywords, if present */
  cri?: number | null;
  /** Catalog lumen figure parsed from keywords (e.g. "[LAMP] … 800lm") */
  catalogFluxLm?: number | null;
}

export interface ParseResult {
  data: PhotometricData;
  warnings: string[];
}

export interface LuminaireBody {
  shape: "circle" | "rectangle";
  isCircular: boolean;
  /** Plan width (C0–C180), metres */
  widthM: number;
  /** Plan length (C90–C270), metres */
  lengthM: number;
  /** Housing / opening height, metres (may be a small display default if the file has 0) */
  heightM: number;
  /** Height as recorded in the file, metres (0 if flat / omitted) */
  fileHeightM: number;
  diameterM: number | null;
  housing: "black" | "white";
}
