import type { PhotometricData } from "../../photometry/src/types";
import type { CalcResults } from "../../solver/src/types";
import { roomAreaM2, roomBounds } from "./geometry";
import type { FixtureInstance, ProjectSceneV2, RoomV2 } from "./types";

export const REPORT_MAINTENANCE_FACTOR = 1.0;
export const REPORT_CALC_TYPE = "Perpendicular illuminance";
export const DESIGN_ASSIST_DISCLAIMER =
  "Design-assist only. Not tender-certified. Verify critical projects in DIALux or equivalent.";

export function formatLux(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value >= 100 ? `${Math.round(value)} lx` : `${value.toFixed(1)} lx`;
}

export function formatAreaM2(value: number): string {
  return `${value.toFixed(2)} m²`;
}

export function formatWatts(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)} W`;
}

export function formatLpd(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)} W/m²`;
}

export function formatLpdPer100Lx(lpd: number | null, eave: number): string {
  if (lpd == null || eave < 1e-6) return "—";
  return `${(lpd / (eave / 100)).toFixed(2)} W/m²/100 lx`;
}

export function formatReflectancePct(r: number): string {
  return `${(r * 100).toFixed(1)}%`;
}

/** Display flux without inventing values for absolute photometry IES files. */
export function formatLuminousFlux(photo: PhotometricData): string {
  if (photo.luminousFlux != null && photo.luminousFlux > 0) {
    return `${Math.round(photo.luminousFlux)} lm`;
  }
  return "Absolute photometry (flux n/a)";
}

export function efficacyLmPerW(
  flux: number | null | undefined,
  watts: number | null | undefined
): number | null {
  if (flux == null || watts == null || flux <= 0 || watts <= 0) return null;
  return flux / watts;
}

export function formatEfficacy(flux: number | null, watts: number | null): string {
  const e = efficacyLmPerW(flux, watts);
  return e != null ? `${e.toFixed(1)} lm/W` : "—";
}

export function wattsForLuminaire(
  luminaireId: string,
  photometry: Record<string, PhotometricData>,
  wattsById?: Record<string, number | null | undefined>
): number | null {
  const w = wattsById?.[luminaireId] ?? photometry[luminaireId]?.watts;
  return w != null && Number.isFinite(w) && w > 0 ? w : null;
}

export function fluxForLuminaire(
  luminaireId: string,
  photometry: Record<string, PhotometricData>
): number | null {
  const f = photometry[luminaireId]?.luminousFlux;
  return f != null && Number.isFinite(f) && f > 0 ? f : null;
}

export interface LuminaireAggregateRow {
  luminaireId: string;
  count: number;
  manufacturer: string;
  catalogNumber: string;
  articleName: string;
  watts: number | null;
  flux: number | null;
  efficacy: number | null;
}

export function aggregateProjectLuminaires(
  scene: ProjectSceneV2,
  photometry: Record<string, PhotometricData>,
  wattsById?: Record<string, number | null | undefined>
): LuminaireAggregateRow[] {
  const counts = new Map<string, number>();
  for (const inst of scene.instances) {
    counts.set(inst.luminaireId, (counts.get(inst.luminaireId) ?? 0) + 1);
  }
  const rows: LuminaireAggregateRow[] = [];
  for (const [luminaireId, count] of counts) {
    const photo = photometry[luminaireId];
    const watts = wattsForLuminaire(luminaireId, photometry, wattsById);
    const flux = photo ? fluxForLuminaire(luminaireId, photometry) : null;
    rows.push({
      luminaireId,
      count,
      manufacturer: photo?.manufacturer || "—",
      catalogNumber: photo?.catalogNumber || "—",
      articleName: photo?.description || luminaireId,
      watts,
      flux,
      efficacy: efficacyLmPerW(flux, watts),
    });
  }
  rows.sort((a, b) => a.articleName.localeCompare(b.articleName));
  return rows;
}

export function projectTotals(
  rows: LuminaireAggregateRow[]
): { totalFlux: number | null; totalWatts: number; efficacy: number | null } {
  let totalWatts = 0;
  let totalFlux = 0;
  let fluxKnown = true;
  for (const row of rows) {
    if (row.watts) totalWatts += row.watts * row.count;
    if (row.flux) totalFlux += row.flux * row.count;
    else fluxKnown = false;
  }
  return {
    totalFlux: fluxKnown && totalFlux > 0 ? totalFlux : fluxKnown ? totalFlux : null,
    totalWatts,
    efficacy:
      fluxKnown && totalWatts > 0 && totalFlux > 0 ? totalFlux / totalWatts : null,
  };
}

export interface RoomLuminaireRow {
  luminaireId: string;
  count: number;
  manufacturer: string;
  catalogNumber: string;
  articleName: string;
  watts: number | null;
  flux: number | null;
  efficacy: number | null;
}

export function luminairesInRoom(
  roomId: string,
  scene: ProjectSceneV2,
  photometry: Record<string, PhotometricData>,
  wattsById?: Record<string, number | null | undefined>
): RoomLuminaireRow[] {
  const counts = new Map<string, number>();
  for (const inst of scene.instances) {
    if (inst.roomId !== roomId) continue;
    counts.set(inst.luminaireId, (counts.get(inst.luminaireId) ?? 0) + 1);
  }
  const rows: RoomLuminaireRow[] = [];
  for (const [luminaireId, count] of counts) {
    const photo = photometry[luminaireId];
    const watts = wattsForLuminaire(luminaireId, photometry, wattsById);
    const flux = photo ? fluxForLuminaire(luminaireId, photometry) : null;
    rows.push({
      luminaireId,
      count,
      manufacturer: photo?.manufacturer || "—",
      catalogNumber: photo?.catalogNumber || "—",
      articleName: photo?.description || luminaireId,
      watts,
      flux,
      efficacy: efficacyLmPerW(flux, watts),
    });
  }
  return rows;
}

export function roomInstalledWatts(
  roomId: string,
  scene: ProjectSceneV2,
  photometry: Record<string, PhotometricData>,
  wattsById?: Record<string, number | null | undefined>
): number {
  let total = 0;
  for (const row of luminairesInRoom(roomId, scene, photometry, wattsById)) {
    if (row.watts) total += row.watts * row.count;
  }
  return total;
}

export function roomPolygonArea(room: RoomV2): number {
  return roomAreaM2(room);
}

export function roomLpdFromPolygon(
  room: RoomV2,
  scene: ProjectSceneV2,
  photometry: Record<string, PhotometricData>,
  wattsById?: Record<string, number | null | undefined>
): number | null {
  const area = roomPolygonArea(room);
  const w = roomInstalledWatts(room.id, scene, photometry, wattsById);
  if (area <= 0 || w <= 0) return null;
  return w / area;
}

export function uniformitiesFromResults(res: CalcResults): { uo: number; g2: number } {
  const { eave, emin, emax } = res.summary;
  const uo = res.summary.uo;
  const g2 = emax > 1e-6 ? emin / emax : 0;
  void eave;
  return { uo, g2 };
}

export function wallZoneM(room: RoomV2): number {
  return Math.max(0, room.calc.gridSpacing / 2);
}

export function typicalMountingHeightM(
  roomId: string,
  scene: ProjectSceneV2
): number | null {
  const zs = scene.instances
    .filter((i) => i.roomId === roomId)
    .map((i) => i.position.z);
  if (!zs.length) return null;
  return zs.reduce((a, b) => a + b, 0) / zs.length;
}

export function roomContextLabel(
  projectName: string,
  scene: ProjectSceneV2,
  room: RoomV2
): string {
  const storey = scene.storeys.find((s) => s.id === room.storeyId);
  const building = projectName;
  const storeyName = storey?.name ?? "Storey";
  return `${building} · ${storeyName} · ${room.name}`;
}

export function workplaneHeightM(room: RoomV2): number {
  return room.workplaneHeightM;
}

/** Area + LPD aligned with true room polygon (not solver AABB). */
export function enrichSummaryWithPolygonArea(
  room: RoomV2,
  res: CalcResults,
  scene: ProjectSceneV2,
  photometry: Record<string, PhotometricData>,
  wattsById?: Record<string, number | null | undefined>
): CalcResults["summary"] {
  const areaM2 = roomPolygonArea(room);
  const totalWatts =
    res.summary.totalWatts > 0
      ? res.summary.totalWatts
      : roomInstalledWatts(room.id, scene, photometry, wattsById);
  const lpd = totalWatts > 0 && areaM2 > 0 ? totalWatts / areaM2 : null;
  return { ...res.summary, areaM2, totalWatts, lpd };
}

export function gridWorldOrigin(room: RoomV2, res: CalcResults): { ox: number; oy: number } {
  const b = roomBounds(room);
  return { ox: b.minX + res.grid.originX, oy: b.minY + res.grid.originY };
}
