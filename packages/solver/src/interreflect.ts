import type { RoomSpec } from "./types";

/**
 * Very lightweight box-room interreflection:
 * use average reflectance and a few luminous exits based on direct workplane mean.
 * Not a full radiosity mesh — suitable for design-assist only.
 */
export function interreflectedWorkplaneBoost(
  room: RoomSpec,
  eDirectMean: number,
  bounces: number
): number {
  const rhoF = clamp01(room.reflectance.floor);
  const rhoC = clamp01(room.reflectance.ceiling);
  const rhoW = clamp01(room.reflectance.walls);

  // Area-weighted average reflectance
  const Afloor = room.width * room.depth;
  const Aceil = Afloor;
  const Aw = 2 * (room.width + room.depth) * room.height;
  const Atot = Afloor + Aceil + Aw;
  const rho =
    (Afloor * rhoF + Aceil * rhoC + Aw * rhoW) / Math.max(Atot, 1e-6);

  // Fraction of flux that reaches workplane via diffuse bounce (crude)
  const formToWorkplane = 0.35 + 0.15 * rhoC + 0.1 * rhoW;
  let indirect = 0;
  let bounceEnergy = eDirectMean * rho * formToWorkplane;
  const n = Math.max(1, Math.min(5, Math.round(bounces)));
  for (let i = 0; i < n; i += 1) {
    indirect += bounceEnergy;
    bounceEnergy *= rho * 0.55;
  }
  return indirect;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
