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
export function estimateFlux(photo: PhotometricData): number {
  if (photo.luminousFlux && photo.luminousFlux > 0) return photo.luminousFlux;
  const { verticalAngles, horizontalAngles, intensities } = photo;
  if (verticalAngles.length < 2 || horizontalAngles.length < 1) return 0;

  let flux = 0;
  for (let h = 0; h < horizontalAngles.length; h += 1) {
    const h0 = horizontalAngles[h]!;
    const h1 = horizontalAngles[(h + 1) % horizontalAngles.length]!;
    let dPhi = degToRad(h1 - h0);
    if (dPhi <= 0) dPhi = degToRad(360 / horizontalAngles.length);
    for (let v = 0; v < verticalAngles.length - 1; v += 1) {
      const t0 = degToRad(verticalAngles[v]!);
      const t1 = degToRad(verticalAngles[v + 1]!);
      const I = 0.25 * (
        (intensities[h]?.[v] ?? 0) +
        (intensities[h]?.[v + 1] ?? 0) +
        (intensities[(h + 1) % intensities.length]?.[v] ?? 0) +
        (intensities[(h + 1) % intensities.length]?.[v + 1] ?? 0)
      );
      const ring = Math.abs(Math.cos(t0) - Math.cos(t1));
      flux += I * dPhi * ring;
    }
  }
  return Math.max(0, flux);
}
