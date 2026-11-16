import { luminaireBody, sampleIntensityCd, type PhotometricData } from "@luxsim/photometry";

/** Conservative half-angle (full beam 60°) when photometry is missing or unmeasurable. */
export const DEFAULT_BEAM_HALF_ANGLE_DEG = 30;
export const DEFAULT_BEAM_FULL_ANGLE_DEG = 60;

/** Planes closer than this still get a short visible cone. */
export const MIN_LIGHT_CONE_LENGTH_M = 0.08;

const HALF_PEAK = 0.5;
const GAMMA_STEP_DEG = 0.25;
const ELLIPTIC_ANGLE_TOL_DEG = 2;

export type OfficialBeamHalfAngles = {
  /** Half-angle from the optical axis in the C0 plane, degrees. */
  c0Deg: number;
  /** Half-angle from the optical axis in the C90 plane, degrees. */
  c90Deg: number;
  source: "photometry" | "default";
  elliptic: boolean;
};

export type OfficialLightConeGeom = {
  /** Fixture-local metres: Y is up, aperture on −Y, X is C0, Z is C90. */
  apexLocal: [number, number, number];
  axisLocal: [number, number, number];
  lengthM: number;
  halfAngleC0Deg: number;
  halfAngleC90Deg: number;
  endRadiusC0M: number;
  endRadiusC90M: number;
  source: "photometry" | "default";
  elliptic: boolean;
};

function halfPeakGammaDeg(photo: PhotometricData, phiDeg: number): number | null {
  let peakI = 0;
  let peakG = 0;
  for (let g = 0; g <= 90; g += 1) {
    const intensity = sampleIntensityCd(photo, g, phiDeg);
    if (intensity > peakI) {
      peakI = intensity;
      peakG = g;
    }
  }
  if (peakI <= 1e-9) return null;
  const threshold = HALF_PEAK * peakI;
  let prevG = peakG;
  let prevI = sampleIntensityCd(photo, peakG, phiDeg);
  for (let g = peakG + GAMMA_STEP_DEG; g <= 90 + 1e-9; g += GAMMA_STEP_DEG) {
    const intensity = sampleIntensityCd(photo, g, phiDeg);
    if (intensity <= threshold) {
      const span = prevI - intensity;
      const t = span <= 1e-12 ? 0 : (prevI - threshold) / span;
      return prevG + t * (g - prevG);
    }
    prevG = g;
    prevI = intensity;
  }
  return 90;
}

export function officialBeamHalfAnglesDeg(
  photo?: PhotometricData | null
): OfficialBeamHalfAngles {
  if (!photo?.verticalAngles?.length || !photo.intensities?.length) {
    return {
      c0Deg: DEFAULT_BEAM_HALF_ANGLE_DEG,
      c90Deg: DEFAULT_BEAM_HALF_ANGLE_DEG,
      source: "default",
      elliptic: false,
    };
  }
  const c0 = halfPeakGammaDeg(photo, 0);
  const c90 = halfPeakGammaDeg(photo, 90);
  if (c0 == null && c90 == null) {
    return {
      c0Deg: DEFAULT_BEAM_HALF_ANGLE_DEG,
      c90Deg: DEFAULT_BEAM_HALF_ANGLE_DEG,
      source: "default",
      elliptic: false,
    };
  }
  const c0Deg = c0 ?? c90 ?? DEFAULT_BEAM_HALF_ANGLE_DEG;
  const c90Deg = c90 ?? c0 ?? DEFAULT_BEAM_HALF_ANGLE_DEG;
  const elliptic = Math.abs(c0Deg - c90Deg) >= ELLIPTIC_ANGLE_TOL_DEG;
  return { c0Deg, c90Deg, source: "photometry", elliptic };
}

export function officialApertureLocalY(photo?: PhotometricData | null): number {
  return -luminaireBody(photo).heightM / 2;
}

export function officialConeTargetHeightM(room?: { workplaneHeightM: number } | null): number {
  return room ? room.workplaneHeightM : 0;
}

export function officialConeLengthM(apertureZ: number, targetZ: number): number {
  return Math.max(MIN_LIGHT_CONE_LENGTH_M, apertureZ - targetZ);
}

export function officialLightConeGeom(input: {
  photo?: PhotometricData | null;
  fixtureZ: number;
  room?: { workplaneHeightM: number } | null;
}): OfficialLightConeGeom {
  const angles = officialBeamHalfAnglesDeg(input.photo);
  const apexY = officialApertureLocalY(input.photo);
  const apertureZ = input.fixtureZ + apexY;
  const lengthM = officialConeLengthM(apertureZ, officialConeTargetHeightM(input.room));
  const halfC0 = (angles.c0Deg * Math.PI) / 180;
  const halfC90 = (angles.c90Deg * Math.PI) / 180;
  return {
    apexLocal: [0, apexY, 0],
    axisLocal: [0, -1, 0],
    lengthM,
    halfAngleC0Deg: angles.c0Deg,
    halfAngleC90Deg: angles.c90Deg,
    endRadiusC0M: lengthM * Math.tan(halfC0),
    endRadiusC90M: lengthM * Math.tan(halfC90),
    source: angles.source,
    elliptic: angles.elliptic,
  };
}
