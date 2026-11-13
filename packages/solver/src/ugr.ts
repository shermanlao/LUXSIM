import { sampleIntensityCd } from "../../photometry/src/interpolate";
import type { PhotometricData } from "../../photometry/src/types";
import { length, normalize, radToDeg, rotateZ, sub, type Vec3 } from "./geometry";
import type { LuminaireInstance, RoomSpec } from "./types";

/**
 * Simplified CIE 117:1995 unified glare rating (assist only — not certified UGR).
 *
 * Practice notes (abbreviated):
 * - Observer eye height 1.2 m (seated), view direction toward task / room centre.
 * - Background luminance Lb from indirect room illuminance (here: workplane E × k / π).
 * - Standard uses 19 positions; we use 6 grid points for a fast browser estimate.
 * - Does not model luminaire size tables, window glare, or precise solid angles.
 */
export function computeUgr(
  room: RoomSpec,
  luminaires: LuminaireInstance[],
  backgroundLux: number
): { ugr: number; observers: { x: number; y: number; z: number; ugr: number }[] } {
  const eyeZ = 1.2;
  const observers: { x: number; y: number; z: number; ugr: number }[] = [];
  const positions: Vec3[] = [
    { x: room.width * 0.25, y: room.depth * 0.15, z: eyeZ },
    { x: room.width * 0.5, y: room.depth * 0.15, z: eyeZ },
    { x: room.width * 0.75, y: room.depth * 0.15, z: eyeZ },
    { x: room.width * 0.25, y: room.depth * 0.85, z: eyeZ },
    { x: room.width * 0.5, y: room.depth * 0.85, z: eyeZ },
    { x: room.width * 0.75, y: room.depth * 0.85, z: eyeZ },
  ];

  // Lb (cd/m²) from average workplane illuminance and typical wall reflectance proxy.
  const rhoBg = 0.35;
  const Lb = Math.max((backgroundLux * rhoBg) / Math.PI, 3);

  for (const eye of positions) {
    const view: Vec3 = normalize({
      x: room.width * 0.5 - eye.x,
      y: room.depth * 0.5 - eye.y,
      z: 0,
    });
    let sum = 0;
    for (const lum of luminaires) {
      const toLum = sub(lum.position, eye);
      const r = length(toLum);
      if (r < 0.2) continue;
      const dir = normalize(toLum);
      const cosGamma = dir.x * view.x + dir.y * view.y + dir.z * view.z;
      if (cosGamma <= 0.05) continue;
      const gammaDeg = radToDeg(Math.acos(Math.min(1, Math.max(-1, cosGamma))));
      if (gammaDeg > 60) continue;

      const fromLum = normalize(sub(eye, lum.position));
      const local = rotateZ(fromLum, -lum.rotationDeg);
      const theta = radToDeg(Math.acos(Math.min(1, Math.max(-1, -local.z))));
      const phi = radToDeg(Math.atan2(local.y, local.x));
      const I = sampleIntensityCd(lum.photometry, theta, phi);
      const area = projectedAreaM2(lum.photometry);
      const L = I / Math.max(area, 1e-4);
      const p = Math.max(cosGamma, 0.05);
      sum += (L * L * Math.max(area, 0.01)) / (p * p * r * r);
    }
    const ugr = 8 * Math.log10((0.25 / Lb) * Math.max(sum, 1e-12));
    observers.push({ x: eye.x, y: eye.y, z: eye.z, ugr });
  }

  const maxUgr = observers.reduce((m, o) => Math.max(m, o.ugr), -Infinity);
  return { ugr: Number.isFinite(maxUgr) ? maxUgr : 0, observers };
}

/** Rough luminous area from flux / peak intensity when not explicit. */
function projectedAreaM2(photo: PhotometricData): number {
  let peak = 0;
  for (const row of photo.intensities) {
    for (const cd of row) peak = Math.max(peak, cd);
  }
  if (photo.luminousFlux && peak > 0) {
    return Math.max(0.005, photo.luminousFlux / (peak * Math.PI));
  }
  return 0.03;
}
