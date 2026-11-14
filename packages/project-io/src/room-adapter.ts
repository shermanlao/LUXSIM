import type { CalcOptions, CalcResults, LuminaireInstance, RoomSpec } from "../../solver/src/types";
import { computeUgr } from "../../solver/src/ugr";
import type { PhotometricData } from "../../photometry/src/types";
import type { FixtureInstance, RoomV2 } from "./types";
import { pointInPolygon, roomAreaM2, roomBounds } from "./geometry";
import { ugrObserverPositionsInRoom } from "./ugr-observers";

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
    room: roomSpecFromV2(room),
    luminaires,
    grid: { spacing: room.calc.gridSpacing },
    interreflection: room.calc.interreflection,
    bounces: room.calc.bounces,
    computeUgr: room.calc.computeUgr,
  };
}

export function roomSpecFromV2(room: RoomV2): RoomSpec {
  const b = roomBounds(room);
  return {
    width: b.width,
    depth: b.depth,
    height: room.heightM,
    reflectance: room.reflectance,
    workplaneHeight: room.workplaneHeightM,
  };
}

/**
 * Zero lux samples whose world position falls outside the room polygon,
 * recompute Ēm / Uo / LPD from interior samples, and — when luminaires are
 * provided and UGR was requested — refresh the simplified CIE 117 assist so
 * observers sit inside the polygon and Lb uses the same clipped Ēm shown
 * on the results strip. Still assist only, not certified UGR.
 */
export function clipResultsToPolygon(
  room: RoomV2,
  results: CalcResults,
  luminaires?: LuminaireInstance[]
): CalcResults {
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
  const areaM2 = roomAreaM2(room);
  const totalWatts = results.summary.totalWatts;
  const lpd = totalWatts > 0 && areaM2 > 0 ? totalWatts / areaM2 : null;
  const next: CalcResults = {
    ...results,
    grid: { ...grid, lux },
    summary: {
      ...results.summary,
      eave,
      emin: Number.isFinite(emin) ? emin : 0,
      emax: Number.isFinite(emax) ? emax : 0,
      uo: eave > 1e-6 ? emin / eave : 0,
      areaM2,
      lpd,
    },
  };
  const ugrWasRequested =
    Boolean(room.calc.computeUgr) || Boolean(results.ugrObservers?.length);
  const photometryUsable =
    luminaires !== undefined &&
    luminaires.every((lum) => Array.isArray(lum.photometry?.intensities));
  if (ugrWasRequested && photometryUsable) {
    const ugrResult = computeUgr(
      roomSpecFromV2(room),
      luminaires,
      eave,
      ugrObserverPositionsInRoom(room)
    );
    next.summary.ugr = ugrResult.ugr;
    next.ugrObservers = ugrResult.observers;
  }
  return next;
}
