import type { PhotometricData } from "../../photometry/src/types";

export interface RoomSpec {
  width: number; // X (m)
  depth: number; // Y (m)
  height: number; // Z (m)
  reflectance: {
    floor: number;
    ceiling: number;
    walls: number;
  };
  workplaneHeight: number; // m
}

export interface LuminaireInstance {
  id: string;
  name: string;
  /** Position in room coords (m); z = mounting height from floor */
  position: { x: number; y: number; z: number };
  /** Rotation around vertical axis (degrees) */
  rotationDeg: number;
  photometry: PhotometricData;
  watts?: number | null;
}

export interface GridSettings {
  spacing: number; // m
}

export interface CalcOptions {
  room: RoomSpec;
  luminaires: LuminaireInstance[];
  grid: GridSettings;
  /** Include simple interreflection */
  interreflection: boolean;
  /** Bounce count for gather (1–3 typical) */
  bounces: number;
  /** Compute basic UGR */
  computeUgr: boolean;
}

export interface CalcResults {
  version: 1;
  grid: {
    originX: number;
    originY: number;
    spacing: number;
    nx: number;
    ny: number;
    z: number;
    /** Row-major lux values length nx*ny */
    lux: number[];
  };
  summary: {
    eave: number;
    emin: number;
    emax: number;
    uo: number;
    ugr: number | null;
    lpd: number | null;
    totalWatts: number;
    areaM2: number;
  };
  ugrObservers?: { x: number; y: number; z: number; ugr: number }[];
  meta: {
    interreflection: boolean;
    bounces: number;
    calculatedAt: string;
    disclaimer: string;
  };
}
