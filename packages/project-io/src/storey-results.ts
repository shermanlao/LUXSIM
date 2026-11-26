import type { CalcResults } from "../../solver/src/types";
import { roomAreaM2 } from "./geometry";
import { resolveMaintenanceFactor } from "./maintenance-factor";
import type { ResultsV2, RoomV2 } from "./types";

export type StoreyResultsAggregate = {
  results: CalcResults;
  maintenanceFactor: number;
};

/**
 * Floor-level totals for the editor results strip when a storey (not a room)
 * is selected. Ēm is area-weighted, Emin is the lowest room Emin, Uo is
 * Emin/Ēm, LPD is total watts over total area, and UGR is the highest
 * room UGR (assist only — UGR is not physically additive).
 */
export function aggregateStoreyResults(
  rooms: RoomV2[],
  results: ResultsV2,
  storeyId: string
): StoreyResultsAggregate | null {
  const parts: { summary: CalcResults["summary"]; meta: CalcResults["meta"]; area: number; mf: number }[] = [];

  for (const room of rooms) {
    if (room.storeyId !== storeyId) continue;
    const res = results.byRoomId[room.id];
    if (!res) continue;
    const area = res.summary.areaM2 > 0 ? res.summary.areaM2 : roomAreaM2(room);
    if (!(area > 0)) continue;
    const mf = resolveMaintenanceFactor({
      maintenanceFactor: room.calc.maintenanceFactor,
      mfBreakdown: room.calc.mfBreakdown,
    }).mf;
    parts.push({ summary: res.summary, meta: res.meta, area, mf });
  }

  if (!parts.length) return null;

  const areaM2 = parts.reduce((sum, p) => sum + p.area, 0);
  const eaveSum = parts.reduce((sum, p) => sum + p.summary.eave * p.area, 0);
  const eave = eaveSum / areaM2;
  const emin = Math.min(...parts.map((p) => p.summary.emin));
  const emax = Math.max(...parts.map((p) => p.summary.emax));
  const uo = eave > 1e-6 ? emin / eave : 0;
  const totalWatts = parts.reduce((sum, p) => sum + p.summary.totalWatts, 0);
  const lpd = totalWatts > 0 && areaM2 > 0 ? totalWatts / areaM2 : null;
  const ugrs = parts
    .map((p) => p.summary.ugr)
    .filter((u): u is number => u != null && Number.isFinite(u));
  const ugr = ugrs.length ? Math.max(...ugrs) : null;

  const maintainedSum = parts.reduce((sum, p) => sum + p.summary.eave * p.mf * p.area, 0);
  const maintenanceFactor =
    eaveSum > 1e-6 ? maintainedSum / eaveSum : parts.reduce((sum, p) => sum + p.mf * p.area, 0) / areaM2;

  const latestAt = parts
    .map((p) => p.meta.calculatedAt)
    .filter(Boolean)
    .sort()
    .at(-1) ?? new Date().toISOString();

  return {
    maintenanceFactor,
    results: {
      version: 1,
      grid: { originX: 0, originY: 0, spacing: 0, nx: 0, ny: 0, z: 0, lux: [] },
      summary: { eave, emin, emax, uo, ugr, lpd, totalWatts, areaM2 },
      meta: {
        interreflection: parts.every((p) => p.meta.interreflection),
        bounces: Math.max(...parts.map((p) => p.meta.bounces)),
        calculatedAt: latestAt,
        disclaimer: parts[0]!.meta.disclaimer,
      },
    },
  };
}
