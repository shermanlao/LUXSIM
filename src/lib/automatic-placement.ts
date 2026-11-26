import { getEn12464Template, pointInPolygon, roomAreaM2, type RoomV2, type Vec2 } from "@luxsim/project-io";
import {
  pointOnClosedPolygonOutline,
  type ArrayParams,
  type ArrayPoint,
  type ArrayPlanResult,
} from "@/lib/arrange-array";
import {
  clampUtilance,
  DEFAULT_UTILANCE,
  estimateFixtureCountForTargetEm,
  estimatedMaintainedEmFromFixtureCount,
  totalLmRequiredForTargetEm,
} from "@/lib/arrange-by-em";

/** Official mounting plane is 0.1 m below the room height (same as RCP / schedule / plan-code placement). */
export const AUTOMATIC_PLACEMENT_MOUNT_OFFSET_M = 0.1;

/** Hm is clamped to this when the workplane is at or above the mounting plane. */
export const MIN_MOUNTING_HEIGHT_ABOVE_WORKPLANE_M = 0.01;

/** Default maximum spacing-to-height ratio S/Hm. */
export const DEFAULT_MAX_SPACING_TO_HM = 1.5;

/** Tighter default S/Hm when the EN assist template Uo is at least 0.70. */
export const TIGHT_MAX_SPACING_TO_HM = 1.25;

/** Uniformity at or above this tightens the default maximum S/Hm. */
export const TIGHT_UO_THRESHOLD = 0.7;

export const DEFAULT_TARGET_EM_MAINTAINED_LX = 500;

const EPS_M = 1e-9;
const COORD_EPS_M = 1e-8;
const MAX_FIXTURE_COUNT = 4000;

export type AutomaticPlacementRefusal =
  | "no-room"
  | "invalid-target"
  | "no-flux"
  | "invalid-max-s-over-hm"
  | "no-usable-area"
  | "cannot-place"
  | "all-occupied";

export type AutomaticPlacementInput = {
  targetEmMaintainedLx: number;
  luminousFluxLm: number;
  utilance: number;
  maintenanceFactor: number;
  wallOffset: number;
  rotationDeg: number;
  maxSpacingToHm: number;
  utilanceIsDefault?: boolean;
};

export type AutomaticPlacementEstimate = {
  fixtureCount: number;
  lumenMethodCount: number;
  rows: number;
  cols: number;
  spacingX: number;
  spacingY: number;
  maxSpacingM: number;
  maxSpacingToHm: number;
  mountingHeightAboveWorkplaneM: number;
  wallOffset: number;
  rotationDeg: number;
  areaM2: number;
  totalLmRequired: number;
  estimatedMaintainedEmLx: number;
  utilanceWarning: boolean;
  templateId: string | null;
  templateLabel: string | null;
  templateEm: number | null;
  templateUo: number | null;
  arrayParams: ArrayParams;
};

export type AutomaticPlacementSuccess = {
  ok: true;
  estimate: AutomaticPlacementEstimate;
  points: ArrayPoint[];
  plan: ArrayPlanResult;
};

export type AutomaticPlacementFailure = {
  ok: false;
  reason: Exclude<AutomaticPlacementRefusal, "all-occupied">;
};

export type AutomaticPlacementResult = AutomaticPlacementSuccess | AutomaticPlacementFailure;

export function formatAutomaticPlacementRefusal(reason: AutomaticPlacementRefusal): string {
  switch (reason) {
    case "no-room":
      return "Select a room first. / 請先選擇房間。";
    case "invalid-target":
      return "Enter a valid maintained Ēm greater than 0. / 請輸入大於 0 的目標維持照度。";
    case "no-flux":
      return "Luminous flux Φ unknown — upload IES/LDT or set lumens in Library. / 缺少光通量 — 請上載 IES/LDT。";
    case "invalid-max-s-over-hm":
      return "Enter a valid maximum S/Hm greater than 0. / 請輸入大於 0 的最大距高比。";
    case "no-usable-area":
      return "Wall offset leaves no usable area inside the room. / 離牆後房間內沒有可佈燈範圍。";
    case "cannot-place":
      return "Could not place the required fixtures inside the room. / 無法在房間內放下所需燈具。";
    case "all-occupied":
      return "Every planned position is already occupied. Existing fixtures were kept; nothing was written. / 所有規劃位置已有燈具，既有燈具已保留，沒有寫入新燈具。";
  }
}

export function officialPointInRoomPolygon(point: Vec2, polygon: Vec2[]): boolean {
  return pointInPolygon(point, polygon) || pointOnClosedPolygonOutline(point, polygon);
}

export function mountingHeightAboveWorkplaneM(room: RoomV2): number {
  const mountZ = room.heightM - AUTOMATIC_PLACEMENT_MOUNT_OFFSET_M;
  const hm = mountZ - room.workplaneHeightM;
  return Math.max(MIN_MOUNTING_HEIGHT_ABOVE_WORKPLANE_M, hm);
}

export function defaultMaxSpacingToHm(uo: number | null | undefined): number {
  return uo != null && uo >= TIGHT_UO_THRESHOLD - 1e-12 ? TIGHT_MAX_SPACING_TO_HM : DEFAULT_MAX_SPACING_TO_HM;
}

export type AutomaticPlacementDefaults = {
  targetEmMaintainedLx: number;
  maxSpacingToHm: number;
  templateId: string | null;
  templateLabel: string | null;
  templateEm: number | null;
  templateUo: number | null;
};

export function automaticPlacementDefaultsFromRoom(room: RoomV2): AutomaticPlacementDefaults {
  const template = getEn12464Template(room.calc.en12464TemplateId);
  if (template && template.em > 0) {
    return {
      targetEmMaintainedLx: template.em,
      maxSpacingToHm: defaultMaxSpacingToHm(template.uo),
      templateId: template.id,
      templateLabel: template.label,
      templateEm: template.em,
      templateUo: template.uo,
    };
  }
  return {
    targetEmMaintainedLx: DEFAULT_TARGET_EM_MAINTAINED_LX,
    maxSpacingToHm: DEFAULT_MAX_SPACING_TO_HM,
    templateId: null,
    templateLabel: null,
    templateEm: null,
    templateUo: null,
  };
}

export function minPointsAlongLength(lengthM: number, maxSpacingM: number): number {
  if (!(maxSpacingM > 0) || lengthM <= 0) return 1;
  if (lengthM <= maxSpacingM + 1e-12) return 1;
  return 1 + Math.ceil(lengthM / maxSpacingM - 1e-12);
}

type Interval = { x0: number; x1: number };

function polygonBounds(polygon: Vec2[]): { minX: number; minY: number; maxX: number; maxY: number } {
  const xs = polygon.map((p) => p.x);
  const ys = polygon.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function distToSegment(point: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < EPS_M * EPS_M) return Math.hypot(point.x - a.x, point.y - a.y);
  let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

export function distToPolygonOutline(point: Vec2, polygon: Vec2[]): number {
  if (polygon.length < 2) return Infinity;
  let best = Infinity;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    const d = distToSegment(point, a, b);
    if (d < best) best = d;
  }
  return best;
}

export function pointRespectsWallOffset(point: Vec2, polygon: Vec2[], wallOffset: number): boolean {
  if (!officialPointInRoomPolygon(point, polygon)) return false;
  if (wallOffset <= EPS_M) return true;
  return distToPolygonOutline(point, polygon) + 1e-6 >= wallOffset;
}

function mergeIntervals(items: Interval[]): Interval[] {
  if (!items.length) return [];
  const sorted = [...items].sort((a, b) => a.x0 - b.x0);
  const out: Interval[] = [{ ...sorted[0]! }];
  for (let i = 1; i < sorted.length; i += 1) {
    const cur = sorted[i]!;
    const last = out[out.length - 1]!;
    if (cur.x0 <= last.x1 + COORD_EPS_M) {
      last.x1 = Math.max(last.x1, cur.x1);
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

function subtractIntervals(base: Interval[], forbidden: Interval[]): Interval[] {
  let current = mergeIntervals(base);
  const cuts = mergeIntervals(forbidden);
  for (const cut of cuts) {
    const next: Interval[] = [];
    for (const seg of current) {
      if (cut.x1 < seg.x0 - COORD_EPS_M || cut.x0 > seg.x1 + COORD_EPS_M) {
        next.push(seg);
        continue;
      }
      if (seg.x0 < cut.x0 - COORD_EPS_M) {
        next.push({ x0: seg.x0, x1: Math.min(seg.x1, cut.x0) });
      }
      if (seg.x1 > cut.x1 + COORD_EPS_M) {
        next.push({ x0: Math.max(seg.x0, cut.x1), x1: seg.x1 });
      }
    }
    current = next;
  }
  return current.filter((s) => s.x1 - s.x0 >= COORD_EPS_M);
}

function unionInterval(into: Interval[], add: Interval | null) {
  if (add && add.x1 >= add.x0) into.push(add);
}

function intervalForDisk(cx: number, cy: number, r: number, y: number): Interval | null {
  const dy = y - cy;
  const t = r * r - dy * dy;
  if (t < 0) return null;
  const s = Math.sqrt(Math.max(0, t));
  return { x0: cx - s, x1: cx + s };
}

/** X interval where the horizontal line Y=y is within `r` of segment ab (a capsule). */
function capsuleForbiddenX(a: Vec2, b: Vec2, r: number, y: number): Interval | null {
  if (r <= 0) return null;
  const parts: Interval[] = [];
  unionInterval(parts, intervalForDisk(a.x, a.y, r, y));
  unionInterval(parts, intervalForDisk(b.x, b.y, r, y));

  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const len2 = ex * ex + ey * ey;
  if (len2 >= EPS_M * EPS_M) {
    if (Math.abs(ex) < EPS_M) {
      const t = (y - a.y) / ey;
      if (t >= -EPS_M && t <= 1 + EPS_M) {
        unionInterval(parts, { x0: a.x - r, x1: a.x + r });
      }
    } else if (Math.abs(ey) < EPS_M) {
      const dist = Math.abs(y - a.y);
      if (dist <= r + EPS_M) {
        unionInterval(parts, { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x) });
      }
    } else {
      const len = Math.sqrt(len2);
      const rhs = r * len;
      const k = (y - a.y) * ex;
      let xStripLo = (ey * a.x + k - rhs) / ey;
      let xStripHi = (ey * a.x + k + rhs) / ey;
      if (xStripLo > xStripHi) {
        const tmp = xStripLo;
        xStripLo = xStripHi;
        xStripHi = tmp;
      }
      let xTLo = (0 - (y - a.y) * ey) / ex + a.x;
      let xTHi = (len2 - (y - a.y) * ey) / ex + a.x;
      if (xTLo > xTHi) {
        const tmp = xTLo;
        xTLo = xTHi;
        xTHi = tmp;
      }
      const lo = Math.max(xStripLo, xTLo);
      const hi = Math.min(xStripHi, xTHi);
      if (hi + COORD_EPS_M >= lo) unionInterval(parts, { x0: lo, x1: hi });
    }
  }

  const merged = mergeIntervals(parts);
  if (!merged.length) return null;
  // A capsule is convex, so its intersection with a line is one interval.
  return { x0: merged[0]!.x0, x1: merged[merged.length - 1]!.x1 };
}

function collectScanXs(polygon: Vec2[], y: number): number[] {
  const xs: number[] = [];
  const n = polygon.length;
  for (let i = 0; i < n; i += 1) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % n]!;
    if (Math.abs(a.y - b.y) <= EPS_M) {
      if (Math.abs(a.y - y) <= COORD_EPS_M) {
        xs.push(a.x, b.x);
      }
      continue;
    }
    const ymin = Math.min(a.y, b.y);
    const ymax = Math.max(a.y, b.y);
    if (y + COORD_EPS_M < ymin || y - COORD_EPS_M > ymax) continue;
    const t = (y - a.y) / (b.y - a.y);
    xs.push(a.x + t * (b.x - a.x));
  }
  xs.sort((p, q) => p - q);
  const uniq: number[] = [];
  for (const x of xs) {
    if (!uniq.length || Math.abs(uniq[uniq.length - 1]! - x) > COORD_EPS_M) uniq.push(x);
  }
  return uniq;
}

export function horizontalInsideSegments(polygon: Vec2[], y: number): Interval[] {
  const xs = collectScanXs(polygon, y);
  if (xs.length < 2) {
    // A lone vertex / tangent: keep a degenerate point if it is on the outline.
    if (xs.length === 1) {
      const p = { x: xs[0]!, y };
      if (officialPointInRoomPolygon(p, polygon)) return [{ x0: xs[0]!, x1: xs[0]! }];
    }
    return [];
  }
  const raw: Interval[] = [];
  for (let i = 0; i < xs.length - 1; i += 1) {
    const x0 = xs[i]!;
    const x1 = xs[i + 1]!;
    const mid = { x: (x0 + x1) / 2, y };
    const left = { x: x0, y };
    const right = { x: x1, y };
    if (
      officialPointInRoomPolygon(mid, polygon) ||
      (officialPointInRoomPolygon(left, polygon) && officialPointInRoomPolygon(right, polygon))
    ) {
      raw.push({ x0, x1 });
    }
  }
  return mergeIntervals(raw);
}

export function usableHorizontalSegments(polygon: Vec2[], y: number, wallOffset: number): Interval[] {
  const inside = horizontalInsideSegments(polygon, y);
  if (!inside.length) return [];
  if (wallOffset <= EPS_M) return inside;
  const tight: Interval[] = [];
  const r = wallOffset;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    const cut = capsuleForbiddenX(a, b, r, y);
    if (cut) tight.push(cut);
  }
  return subtractIntervals(inside, tight).filter((s) => s.x1 >= s.x0);
}

function rotatePolygon(polygon: Vec2[], swapXY: boolean): Vec2[] {
  if (!swapXY) return polygon.map((p) => ({ x: p.x, y: p.y }));
  return polygon.map((p) => ({ x: p.y, y: p.x }));
}

function rotatePoint(point: Vec2, swapXY: boolean): Vec2 {
  return swapXY ? { x: point.y, y: point.x } : { x: point.x, y: point.y };
}

function segmentLength(seg: Interval): number {
  return Math.max(0, seg.x1 - seg.x0);
}

function totalLength(segs: Interval[]): number {
  return segs.reduce((sum, s) => sum + segmentLength(s), 0);
}

function allocateCounts(lengths: number[], n: number): number[] {
  const counts = lengths.map(() => 0);
  if (n <= 0 || !lengths.length) return counts;
  const total = lengths.reduce((s, l) => s + l, 0);
  if (total <= EPS_M) {
    counts[Math.floor((counts.length - 1) / 2)] = n;
    return counts;
  }
  const raw = lengths.map((l) => (n * l) / total);
  const floors = raw.map((v) => Math.floor(v));
  let left = n - floors.reduce((s, v) => s + v, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  const out = [...floors];
  for (const item of order) {
    if (left <= 0) break;
    out[item.i] += 1;
    left -= 1;
  }
  return out;
}

function placeOnSegment(seg: Interval, y: number, count: number, rotationDeg: number): ArrayPoint[] {
  const n = Math.max(0, Math.floor(count));
  if (n <= 0) return [];
  if (n === 1 || seg.x1 - seg.x0 <= COORD_EPS_M) {
    return [{ x: (seg.x0 + seg.x1) / 2, y, rotationDeg }];
  }
  const pts: ArrayPoint[] = [];
  for (let i = 0; i < n; i += 1) {
    const t = i / (n - 1);
    pts.push({ x: seg.x0 + t * (seg.x1 - seg.x0), y, rotationDeg });
  }
  return pts;
}

type ScanRow = { y: number; segments: Interval[]; length: number };

function usableYCatalog(polygon: Vec2[], wallOffset: number): ScanRow[] {
  const b = polygonBounds(polygon);
  const span = Math.max(0, b.maxY - b.minY);
  const step = Math.max(0.01, Math.min(0.05, span / 200 || 0.05));
  const yStart = b.minY;
  const yEnd = b.maxY;
  const rows: ScanRow[] = [];
  const seen = new Set<string>();
  const consider = (y: number) => {
    const key = y.toFixed(6);
    if (seen.has(key)) return;
    seen.add(key);
    const segments = usableHorizontalSegments(polygon, y, wallOffset);
    const length = totalLength(segments);
    if (length > 0 || segments.length > 0) {
      rows.push({ y, segments, length: Math.max(length, 0) });
    }
  };
  consider(yStart);
  for (let y = yStart + step; y < yEnd - EPS_M; y += step) consider(y);
  consider(yEnd);
  if (wallOffset > EPS_M) {
    consider(yStart + wallOffset);
    consider(yEnd - wallOffset);
  }
  rows.sort((a, b) => a.y - b.y);
  return rows.filter((row) => row.length > COORD_EPS_M || row.segments.some((s) => officialPointInRoomPolygon({ x: (s.x0 + s.x1) / 2, y: row.y }, polygon)));
}

function pickEvenRows(catalog: ScanRow[], rows: number): ScanRow[] {
  if (!catalog.length || rows <= 0) return [];
  if (rows === 1) {
    return [catalog[Math.floor((catalog.length - 1) / 2)]!];
  }
  if (catalog.length <= rows) return catalog;
  const out: ScanRow[] = [];
  for (let i = 0; i < rows; i += 1) {
    const idx = Math.round((i * (catalog.length - 1)) / (rows - 1));
    const row = catalog[idx]!;
    if (!out.length || Math.abs(out[out.length - 1]!.y - row.y) > COORD_EPS_M) {
      out.push(row);
    }
  }
  return out;
}

type PackedLayout = {
  points: ArrayPoint[];
  rows: number;
  cols: number;
  spacingX: number;
  spacingY: number;
  maxSpacingM: number;
};

function impliedSpacingAlong(seg: Interval, count: number): number {
  const len = segmentLength(seg);
  if (count <= 1) return len;
  return len / (count - 1);
}

function packOnRows(selected: ScanRow[], n: number, rotationDeg: number, swapXY: boolean, usableYSpan: number): PackedLayout | null {
  if (n <= 0 || !selected.length) return null;
  const segs: { row: ScanRow; seg: Interval }[] = [];
  for (const row of selected) {
    for (const seg of row.segments) segs.push({ row, seg });
  }
  if (!segs.length) return null;
  const counts = allocateCounts(
    segs.map(({ seg }) => Math.max(segmentLength(seg), COORD_EPS_M)),
    n
  );
  const points: ArrayPoint[] = [];
  let spacingX = 0;
  let cols = 0;
  for (let i = 0; i < segs.length; i += 1) {
    const item = segs[i]!;
    const c = counts[i] ?? 0;
    cols = Math.max(cols, c);
    spacingX = Math.max(spacingX, impliedSpacingAlong(item.seg, c));
    const raw = placeOnSegment(item.seg, item.row.y, c, rotationDeg);
    for (const p of raw) points.push({ ...rotatePoint(p, swapXY), rotationDeg });
  }
  if (points.length !== n) {
    // Largest-remainder may put 0 on some segments; if we still missed (shouldn't), fail.
    if (points.length === 0) return null;
  }
  let spacingY = 0;
  if (selected.length === 1) {
    spacingY = Math.max(0, usableYSpan);
  } else {
    for (let i = 1; i < selected.length; i += 1) {
      spacingY = Math.max(spacingY, Math.abs(selected[i]!.y - selected[i - 1]!.y));
    }
  }
  const maxSpacingM = Math.max(spacingX, spacingY);
  return {
    points,
    rows: selected.length,
    cols: Math.max(1, cols),
    spacingX,
    spacingY,
    maxSpacingM,
  };
}

function layoutScore(layout: PackedLayout, maxSpacingM: number, n: number): number {
  const capPenalty = layout.maxSpacingM > maxSpacingM + 1e-9 ? 1000 + (layout.maxSpacingM - maxSpacingM) : 0;
  const countPenalty = Math.abs(layout.points.length - n) * 50;
  const sx = Math.max(layout.spacingX, 1e-6);
  const sy = Math.max(layout.spacingY, 1e-6);
  const aspect = Math.abs(sx - sy) / Math.max(sx, sy);
  return capPenalty + countPenalty + aspect + layout.maxSpacingM * 0.01;
}

function packNWithCatalogs(
  catalogs: { swapXY: boolean; catalog: ScanRow[] }[],
  n: number,
  rotationDeg: number,
  maxSpacingM: number
): PackedLayout | null {
  let best: PackedLayout | null = null;
  let bestScore = Infinity;
  for (const { swapXY, catalog } of catalogs) {
    if (!catalog.length) continue;
    const ySpan = catalog[catalog.length - 1]!.y - catalog[0]!.y;
    const rowsMin = minPointsAlongLength(ySpan, maxSpacingM);
    const rowsGuess = Math.max(1, Math.round(Math.sqrt(n)));
    const rowOptions = new Set<number>();
    const rowLo = 1;
    const rowHi = Math.min(n, catalog.length);
    for (let r = rowLo; r <= Math.min(rowHi, n <= 64 ? rowHi : Math.min(rowHi, Math.max(rowsMin, rowsGuess) + 12)); r += 1) {
      if (n <= 64 || Math.abs(r - rowsGuess) <= 12 || r === rowsMin || r === 1 || r === rowHi) {
        rowOptions.add(r);
      }
    }
    rowOptions.add(Math.min(rowHi, Math.max(1, rowsMin)));
    rowOptions.add(Math.min(rowHi, Math.max(1, rowsGuess)));
    for (const rows of [...rowOptions].sort((a, b) => a - b)) {
      const selected = pickEvenRows(catalog, rows);
      if (!selected.length) continue;
      const packed = packOnRows(selected, n, rotationDeg, swapXY, ySpan);
      if (!packed || packed.points.length < n) continue;
      // Keep only the first n if a numerical extra appeared; packOnRows aims for n.
      if (packed.points.length > n) packed.points = packed.points.slice(0, n);
      const score = layoutScore(packed, maxSpacingM, n);
      if (score < bestScore) {
        best = packed;
        bestScore = score;
      }
    }
  }
  return best;
}

function buildScanCatalogs(polygon: Vec2[], wallOffset: number): { swapXY: boolean; catalog: ScanRow[] }[] {
  return [
    { swapXY: false, catalog: usableYCatalog(polygon, wallOffset) },
    { swapXY: true, catalog: usableYCatalog(rotatePolygon(polygon, true), wallOffset) },
  ];
}

function packN(polygon: Vec2[], n: number, wallOffset: number, rotationDeg: number, maxSpacingM: number): PackedLayout | null {
  return packNWithCatalogs(buildScanCatalogs(polygon, wallOffset), n, rotationDeg, maxSpacingM);
}

function filterOfficialPoints(room: RoomV2, points: ArrayPoint[], wallOffset: number): ArrayPoint[] {
  const out: ArrayPoint[] = [];
  for (const p of points) {
    const at = { x: p.x, y: p.y };
    if (pointRespectsWallOffset(at, room.polygon, wallOffset)) out.push(p);
  }
  return out;
}

function validateInput(room: RoomV2 | null, input: AutomaticPlacementInput): AutomaticPlacementFailure | null {
  if (!room || room.polygon.length < 3) return { ok: false, reason: "no-room" };
  if (!Number.isFinite(input.targetEmMaintainedLx) || input.targetEmMaintainedLx <= 0) {
    return { ok: false, reason: "invalid-target" };
  }
  if (!Number.isFinite(input.luminousFluxLm) || input.luminousFluxLm <= 0) {
    return { ok: false, reason: "no-flux" };
  }
  if (!Number.isFinite(input.maxSpacingToHm) || input.maxSpacingToHm <= 0) {
    return { ok: false, reason: "invalid-max-s-over-hm" };
  }
  return null;
}

export function planAutomaticPlacement(room: RoomV2, input: AutomaticPlacementInput): AutomaticPlacementResult {
  const invalid = validateInput(room, input);
  if (invalid) return invalid;

  const areaM2 = roomAreaM2(room);
  const utilance = clampUtilance(input.utilance);
  const mf = input.maintenanceFactor;
  if (!(areaM2 > 0) || !(mf > 0) || !(utilance > 0)) {
    return { ok: false, reason: "cannot-place" };
  }

  const lumenMethodCount = estimateFixtureCountForTargetEm({
    areaM2,
    targetEmMaintainedLx: input.targetEmMaintainedLx,
    luminousFluxLm: input.luminousFluxLm,
    utilance,
    maintenanceFactor: mf,
  });
  if (!lumenMethodCount) return { ok: false, reason: "cannot-place" };

  const wallOffset = Math.max(0, input.wallOffset);
  const hm = mountingHeightAboveWorkplaneM(room);
  const maxSpacingM = input.maxSpacingToHm * hm;

  const catalogs = buildScanCatalogs(room.polygon, wallOffset);
  const probe = packNWithCatalogs(catalogs, 1, input.rotationDeg, maxSpacingM);
  if (!probe || !filterOfficialPoints(room, probe.points, wallOffset).length) {
    return { ok: false, reason: "no-usable-area" };
  }

  const defaults = automaticPlacementDefaultsFromRoom(room);
  let n = lumenMethodCount;
  let chosen: PackedLayout | null = null;
  let guard = 0;
  while (n <= MAX_FIXTURE_COUNT && guard < 80) {
    guard += 1;
    const packed = packNWithCatalogs(catalogs, n, input.rotationDeg, maxSpacingM);
    if (packed) {
      const inside = filterOfficialPoints(room, packed.points, wallOffset);
      if (inside.length >= n) {
        packed.points = inside.slice(0, n);
        const okSpacing = packed.maxSpacingM <= maxSpacingM + 1e-9;
        if (okSpacing) {
          chosen = packed;
          break;
        }
        chosen = packed;
        const scale = packed.maxSpacingM / Math.max(maxSpacingM, EPS_M);
        const jumped = Math.max(n + 1, Math.ceil(n * scale * scale));
        n = Math.min(MAX_FIXTURE_COUNT, jumped);
        continue;
      }
    }
    n += 1;
  }

  if (!chosen || chosen.points.length === 0) {
    return { ok: false, reason: "cannot-place" };
  }
  if (chosen.maxSpacingM > maxSpacingM + 1e-9) {
    // Search reached the cap without satisfying S/Hm; still refuse rather than undershoot the rule.
    return { ok: false, reason: "cannot-place" };
  }

  const points = chosen.points;
  const estimatedMaintainedEmLx = estimatedMaintainedEmFromFixtureCount({
    fixtureCount: points.length,
    areaM2,
    luminousFluxLm: input.luminousFluxLm,
    utilance,
    maintenanceFactor: mf,
  });
  const arrayParams: ArrayParams = {
    mode: "rect",
    rows: chosen.rows,
    cols: chosen.cols,
    count: points.length,
    spacingX: chosen.spacingX || 0.01,
    spacingY: chosen.spacingY || 0.01,
    wallOffset,
    rotationDeg: input.rotationDeg,
    estimateByTargetEm: true,
    automaticPlacement: true,
    targetEmMaintainedLx: input.targetEmMaintainedLx,
    luminousFluxLm: input.luminousFluxLm,
    utilance,
    maintenanceFactor: mf,
    maxSpacingToHm: input.maxSpacingToHm,
    utilanceIsDefault: input.utilanceIsDefault,
  };

  const estimate: AutomaticPlacementEstimate = {
    fixtureCount: points.length,
    lumenMethodCount,
    rows: chosen.rows,
    cols: chosen.cols,
    spacingX: chosen.spacingX,
    spacingY: chosen.spacingY,
    maxSpacingM: chosen.maxSpacingM,
    maxSpacingToHm: input.maxSpacingToHm,
    mountingHeightAboveWorkplaneM: hm,
    wallOffset,
    rotationDeg: input.rotationDeg,
    areaM2,
    totalLmRequired: totalLmRequiredForTargetEm(areaM2, input.targetEmMaintainedLx, utilance, mf),
    estimatedMaintainedEmLx,
    utilanceWarning: input.utilanceIsDefault === true,
    templateId: defaults.templateId,
    templateLabel: defaults.templateLabel,
    templateEm: defaults.templateEm,
    templateUo: defaults.templateUo,
    arrayParams,
  };

  return {
    ok: true,
    estimate,
    points,
    plan: { proposed: points, inside: points, skippedOutside: 0 },
  };
}

export function previewAutomaticPlacement(room: RoomV2, input: AutomaticPlacementInput): AutomaticPlacementResult {
  return planAutomaticPlacement(room, input);
}

export function automaticPlacementInputFromParams(
  params: ArrayParams
): AutomaticPlacementInput | null {
  const em = params.targetEmMaintainedLx;
  const flux = params.luminousFluxLm;
  const eta = params.utilance ?? DEFAULT_UTILANCE;
  const mf = params.maintenanceFactor;
  const maxS = params.maxSpacingToHm;
  if (
    em == null ||
    flux == null ||
    mf == null ||
    maxS == null ||
    !Number.isFinite(em) ||
    !Number.isFinite(flux) ||
    !Number.isFinite(mf) ||
    !Number.isFinite(maxS)
  ) {
    return null;
  }
  return {
    targetEmMaintainedLx: em,
    luminousFluxLm: flux,
    utilance: eta,
    maintenanceFactor: mf,
    wallOffset: params.wallOffset,
    rotationDeg: params.rotationDeg,
    maxSpacingToHm: maxS,
    utilanceIsDefault: params.utilanceIsDefault,
  };
}

export const AUTOMATIC_PLACEMENT_HINT =
  "Plans fixture count from the lumen method, then raises it if needed so every fixture fits inside the room polygon and the spacing-to-height cap (default S/Hm 1.5, or 1.25 when the EN assist Uo is at least 0.70). Layout follows the room outline, including L-shaped rooms — it does not drop points from a bounding-box grid. This estimate is assist only and is not a substitute for Calc. / 先以流明法估算盞數，再按需要增加，使全部燈具落在房間多邊形內並符合距高比上限（預設 S/Hm 1.5；若 EN 輔助均勻度 Uo ≥ 0.70 則為 1.25）。佈燈跟著房間輪廓，包括 L 形房間，不會只用外接矩形網格後丟點。此為輔助估算，不能代替 Calc。";
