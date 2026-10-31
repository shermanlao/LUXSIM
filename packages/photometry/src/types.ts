export type SourceFormat = "ies" | "ldt";

/** Candela intensity table in vertical × horizontal angles */
export interface PhotometricData {
  format: SourceFormat;
  manufacturer: string;
  catalogNumber: string;
  description: string;
  /** Total luminous flux (lm), if known */
  luminousFlux: number | null;
  /** Input watts, if known */
  watts: number | null;
  /** Lamp count used in photometric test */
  lampCount: number;
  /** Candela multiplier / ballast factor applied to intensities */
  ballastFactor: number;
  /** Vertical angles in degrees (typically 0–180) */
  verticalAngles: number[];
  /** Horizontal angles in degrees (typically 0–360) */
  horizontalAngles: number[];
  /**
   * intensities[hIndex][vIndex] in candela
   */
  intensities: number[][];
  /** Symmetry hint for interpolation */
  symmetry: "none" | "axial" | "quad" | "bilateral";
}

export interface ParseResult {
  data: PhotometricData;
  warnings: string[];
}
