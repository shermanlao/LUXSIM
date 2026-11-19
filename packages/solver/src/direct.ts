import { sampleIntensityCd } from "../../photometry/src/interpolate";
import type { PhotometricData } from "../../photometry/src/types";
import { degToRad, length, normalize, radToDeg, rotateZ, sub, type Vec3 } from "./geometry";
import type { LuminaireInstance } from "./types";

/**
 * Illuminance (lux) at a point with upward normal (workplane) from one luminaire.
 * Uses inverse-square law + IES intensity at (theta, phi).
 */
export function directIlluminance(
  point: Vec3,
  normal: Vec3,
  lum: LuminaireInstance
): number {
  const toPoint = sub(point, lum.position);
  const dist = length(toPoint);
  if (dist < 0.05) return 0;

  const dirFromLum = normalize(toPoint); // luminaire → point
  // Incidence cosine uses direction from surface toward the source
  const toLight = { x: -dirFromLum.x, y: -dirFromLum.y, z: -dirFromLum.z };
  const cosInc = Math.max(
    0,
    normal.x * toLight.x + normal.y * toLight.y + normal.z * toLight.z
  );
  if (cosInc <= 0) return 0;

  // Photometric angles in luminaire frame (nadir = -Z world)
  const local = rotateZ(dirFromLum, -lum.rotationDeg);
  const theta = radToDeg(Math.acos(Math.min(1, Math.max(-1, -local.z))));
  const phi = radToDeg(Math.atan2(local.y, local.x));
  const I = sampleIntensityCd(lum.photometry, theta, phi); // cd

  return (I * cosInc) / (dist * dist);
}

export function totalDirectIlluminance(
  point: Vec3,
  normal: Vec3,
  luminaires: LuminaireInstance[]
): number {
  let e = 0;
  for (const lum of luminaires) {
    e += directIlluminance(point, normal, lum);
  }
  return e;
}

/** Approximate emitted luminous flux from intensity table (lm) */
export { estimateFlux } from "../../photometry/src/flux";
