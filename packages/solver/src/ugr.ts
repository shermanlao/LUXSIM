import { sampleIntensityCd } from "../../photometry/src/interpolate";
import { length, normalize, radToDeg, rotateZ, sub, type Vec3 } from "./geometry";
import type { LuminaireInstance, RoomSpec } from "./types";

/**
 * Simplified CIE 117-style UGR at observer positions looking along +Y.
 * Design-assist only — not a certified glare rating.
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

  const Lb = Math.max(backgroundLux * 0.2, 1);

  for (const eye of positions) {
    // Facing toward room center
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
      if (cosGamma <= 0.05) continue; // behind / extreme periphery
      const gammaDeg = radToDeg(Math.acos(Math.min(1, Math.max(-1, cosGamma))));
      if (gammaDeg > 60) continue;

      // Luminous intensity toward observer
      const fromLum = normalize(sub(eye, lum.position));
      const local = rotateZ(fromLum, -lum.rotationDeg);
      const theta = radToDeg(Math.acos(Math.min(1, Math.max(-1, -local.z))));
      const phi = radToDeg(Math.atan2(local.y, local.x));
      const I = sampleIntensityCd(lum.photometry, theta, phi);
      // Apparent luminance proxy: L ≈ I / (projected area). Use 0.03 m² default.
      const area = 0.03;
      const L = I / Math.max(area, 1e-4);
      const p = Math.max(cosGamma, 0.05); // Guth position index proxy
      sum += (L * L * Math.max(area, 0.01)) / (p * p * r * r);
    }
    const ugr = 8 * Math.log10((0.25 / Lb) * Math.max(sum, 1e-12));
    observers.push({ x: eye.x, y: eye.y, z: eye.z, ugr });
  }

  const maxUgr = observers.reduce((m, o) => Math.max(m, o.ugr), -Infinity);
  return { ugr: maxUgr, observers };
}
