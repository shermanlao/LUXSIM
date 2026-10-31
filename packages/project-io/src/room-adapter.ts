import type { CalcOptions, CalcResults, LuminaireInstance } from "../../solver/src/types";
import type { PhotometricData } from "../../photometry/src/types";
import type { FixtureInstance, RoomV2 } from "./types";
import { pointInPolygon, roomBounds } from "./geometry";

/**
 * Build solver options for one room.
 * Uses AABB of polygon as RoomSpec; grid points outside polygon are zeroed after calc.
 */
export function roomToCalcOptions(
  room: RoomV2,
  instances: FixtureInstance[],
  photometryById: Record<string, PhotometricData>,
  wattsById: Record<string, number | null | undefined>
): CalcOptions {
  const b = roomBounds(room);
  const luminaires: LuminaireInstance[] = [];

  for (const inst of instances) {
    if (inst.roomId !== room.id) continue;
    const photo = photometryById[inst.luminaireId];
    if (!photo) continue;
    // Local coords relative to room AABB origin
    luminaires.push({
      id: inst.instanceId,
      name: inst.name,
      position: {
        x: inst.position.x - b.minX,
        y: inst.position.y - b.minY,
        z: inst.position.z,
      },
      rotationDeg: inst.rotationDeg,
      photometry: photo,
      watts: wattsById[inst.luminaireId] ?? photo.watts,
    });
  }

  return {
    room: {
      width: b.width,
      depth: b.depth,
      height: room.heightM,
      reflectance: room.reflectance,
      workplaneHeight: room.workplaneHeightM,
    },
    luminaires,
    grid: { spacing: room.calc.gridSpacing },
    interreflection: room.calc.interreflection,
    bounces: room.calc.bounces,
    computeUgr: room.calc.computeUgr,
  };
}

/** Zero lux samples whose world position falls outside the room polygon. */
export function clipResultsToPolygon(room: RoomV2, results: CalcResults): CalcResults {
  const b = roomBounds(room);
  const { grid } = results;
  const lux = grid.lux.slice();
  for (let j = 0; j < grid.ny; j += 1) {
    for (let i = 0; i < grid.nx; i += 1) {
      const lx = b.minX + grid.originX + i * grid.spacing;
      const ly = b.minY + grid.originY + j * grid.spacing;
      if (!pointInPolygon({ x: lx, y: ly }, room.polygon)) {
        lux[j * grid.nx + i] = 0;
      }
    }
  }
  let sum = 0;
  let emin = Infinity;
  let emax = -Infinity;
  let n = 0;
  for (const e of lux) {
    if (e <= 0) continue;
    sum += e;
    n += 1;
    emin = Math.min(emin, e);
    emax = Math.max(emax, e);
  }
  const eave = n > 0 ? sum / n : 0;
  return {
    ...results,
    grid: { ...grid, lux },
    summary: {
      ...results.summary,
      eave,
      emin: Number.isFinite(emin) ? emin : 0,
      emax: Number.isFinite(emax) ? emax : 0,
      uo: eave > 1e-6 ? emin / eave : 0,
    },
  };
}
