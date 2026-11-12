/** DIALux-style isolux / false-color map (content standard, not a visual clone). */

import type { CalcResults } from "../../solver/src/types";
import type { FixtureInstance, RoomV2, Vec2 } from "./types";
import { pointInPolygon, roomBounds } from "./geometry";

/** Project-wide illuminance colour stops, sampled from official DIALux evo reports. */
export const DIALUX_LUX_STOPS: { lux: number; r: number; g: number; b: number }[] = [
  { lux: 0, r: 18, g: 90, b: 18 },
  { lux: 56, r: 115, g: 221, b: 1 },
  { lux: 80, r: 82, g: 223, b: 119 },
  { lux: 115, r: 223, g: 255, b: 84 },
  { lux: 166, r: 255, g: 255, b: 1 },
  { lux: 240, r: 255, g: 221, b: 139 },
  { lux: 346, r: 255, g: 180, b: 27 },
  { lux: 500, r: 255, g: 137, b: 1 },
  { lux: 1170, r: 224, g: 28, b: 28 },
  { lux: 2500, r: 130, g: 0, b: 0 },
];

const LABELED_STOPS = DIALUX_LUX_STOPS.filter((s) => s.lux > 0);

export function luxToRgb(lux: number, _max?: number): [number, number, number] {
  const v = Math.max(0, lux);
  const stops = DIALUX_LUX_STOPS;
  if (v <= stops[0]!.lux) {
    return [stops[0]!.r / 255, stops[0]!.g / 255, stops[0]!.b / 255];
  }
  const last = stops[stops.length - 1]!;
  if (v >= last.lux) {
    return [last.r / 255, last.g / 255, last.b / 255];
  }
  let i = 0;
  while (i < stops.length - 1 && stops[i + 1]!.lux < v) i += 1;
  const a = stops[i]!;
  const b = stops[i + 1]!;
  const la = Math.log(Math.max(a.lux, 0.1));
  const lb = Math.log(b.lux);
  const t = (Math.log(Math.max(v, 0.1)) - la) / (lb - la);
  return [
    (a.r + (b.r - a.r) * t) / 255,
    (a.g + (b.g - a.g) * t) / 255,
    (a.b + (b.b - a.b) * t) / 255,
  ];
}

export function rgbCss([r, g, b]: [number, number, number]): string {
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}

export function legendStopsForRange(emin: number, emax: number): { lux: number; color: string }[] {
  const lo = Math.max(0, Math.min(emin, emax));
  const hi = Math.max(emin, emax, lo + 1);
  let start = 0;
  for (let i = 0; i < LABELED_STOPS.length; i += 1) {
    if (LABELED_STOPS[i]!.lux <= lo) start = i;
  }
  let end = start;
  for (let i = 0; i < LABELED_STOPS.length; i += 1) {
    if (LABELED_STOPS[i]!.lux < hi) end = i;
  }
  end = Math.min(LABELED_STOPS.length - 1, Math.max(end + 1, start + 1));
  if (lo < LABELED_STOPS[0]!.lux) start = 0;
  const slice = LABELED_STOPS.slice(start, end + 1);
  return (slice.length >= 2 ? slice : LABELED_STOPS.slice(0, 3)).map((s) => ({
    lux: s.lux,
    color: rgbCss([s.r / 255, s.g / 255, s.b / 255]),
  }));
}

export function isoluxLevels(emin: number, emax: number): number[] {
  const lo = Math.max(0, Math.min(emin, emax));
  const hi = Math.max(emin, emax, lo + 1);
  const span = hi - lo;
  const nice = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
  const step = nice.find((s) => span / s <= 12) ?? 1000;
  const start = Math.ceil((lo + step * 0.05) / step) * step;
  const levels: number[] = [];
  for (let v = start; v < hi - step * 0.05; v += step) {
    levels.push(v);
  }
  return levels;
}

export type IsoluxMode = "falsecolor" | "isolines";

export interface IsoluxPoint {
  x: number;
  y: number;
}

export interface IsoluxModel {
  width: number;
  height: number;
  field: Uint8ClampedArray;
  contours: { level: number; polylines: IsoluxPoint[][] }[];
  contourLabels: { x: number; y: number; text: string }[];
  valueLabels: { x: number; y: number; text: string }[];
  roomOutline: IsoluxPoint[];
  workplaneOutline: IsoluxPoint[];
  fixtures: IsoluxPoint[];
  legendStops: { lux: number; color: string }[];
  fontPx: number;
}

function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-18) {
    const dx = p.x - a.x;
    const dy = p.y - a.y;
    return Math.hypot(dx, dy);
  }
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}

function distToEdges(p: Vec2, polygon: Vec2[]): number {
  let min = Infinity;
  for (let i = 0; i < polygon.length; i += 1) {
    const d = distToSegment(p, polygon[i]!, polygon[(i + 1) % polygon.length]!);
    if (d < min) min = d;
  }
  return min;
}

function inWorkplane(p: Vec2, polygon: Vec2[], wallZoneM: number): boolean {
  if (!pointInPolygon(p, polygon)) return false;
  if (wallZoneM <= 1e-6) return true;
  return distToEdges(p, polygon) >= wallZoneM - 1e-6;
}

function signedArea(polygon: Vec2[]): number {
  let sum = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function insetPolygon(polygon: Vec2[], dist: number): Vec2[] {
  if (polygon.length < 3 || dist <= 1e-6) return polygon.map((p) => ({ ...p }));
  const ccw = signedArea(polygon) > 0;
  const n = polygon.length;
  const lines: { a: Vec2; b: Vec2 }[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % n]!;
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const len = Math.hypot(ex, ey) || 1;
    // Inward normal: interior is to the left when walking a CCW ring.
    const nx = ccw ? -ey / len : ey / len;
    const ny = ccw ? ex / len : -ex / len;
    lines.push({
      a: { x: a.x + nx * dist, y: a.y + ny * dist },
      b: { x: b.x + nx * dist, y: b.y + ny * dist },
    });
  }
  const out: Vec2[] = [];
  for (let i = 0; i < n; i += 1) {
    const l1 = lines[(i - 1 + n) % n]!;
    const l2 = lines[i]!;
    const den =
      (l1.a.x - l1.b.x) * (l2.a.y - l2.b.y) - (l1.a.y - l1.b.y) * (l2.a.x - l2.b.x);
    if (Math.abs(den) < 1e-12) {
      out.push({ ...l2.a });
      continue;
    }
    const a1 = l1.a.x * l1.b.y - l1.a.y * l1.b.x;
    const a2 = l2.a.x * l2.b.y - l2.a.y * l2.b.x;
    const x = (a1 * (l2.a.x - l2.b.x) - (l1.a.x - l1.b.x) * a2) / den;
    const y = (a1 * (l2.a.y - l2.b.y) - (l1.a.y - l1.b.y) * a2) / den;
    out.push({ x, y });
  }
  return out.length >= 3 ? out : polygon.map((p) => ({ ...p }));
}

function gridValue(grid: CalcResults["grid"], i: number, j: number): number | null {
  if (i < 0 || j < 0 || i >= grid.nx || j >= grid.ny) return null;
  return grid.lux[j * grid.nx + i] ?? null;
}

function sampleLux(
  grid: CalcResults["grid"],
  b: { minX: number; minY: number },
  x: number,
  y: number
): number {
  const fx = (x - (b.minX + grid.originX)) / Math.max(grid.spacing, 1e-6);
  const fy = (y - (b.minY + grid.originY)) / Math.max(grid.spacing, 1e-6);
  const i0 = Math.floor(fx);
  const j0 = Math.floor(fy);
  const tx = fx - i0;
  const ty = fy - j0;
  const corners = [
    gridValue(grid, i0, j0),
    gridValue(grid, i0 + 1, j0),
    gridValue(grid, i0, j0 + 1),
    gridValue(grid, i0 + 1, j0 + 1),
  ];
  const present = corners.filter((v): v is number => v != null && v > 0);
  if (present.length === 0) {
    const nearest = gridValue(
      grid,
      Math.max(0, Math.min(grid.nx - 1, Math.round(fx))),
      Math.max(0, Math.min(grid.ny - 1, Math.round(fy)))
    );
    return nearest && nearest > 0 ? nearest : 0;
  }
  const v00 = corners[0] != null && corners[0] > 0 ? corners[0] : present[0]!;
  const v10 = corners[1] != null && corners[1] > 0 ? corners[1] : v00;
  const v01 = corners[2] != null && corners[2] > 0 ? corners[2] : v00;
  const v11 = corners[3] != null && corners[3] > 0 ? corners[3] : v10;
  const a = v00 * (1 - tx) + v10 * tx;
  const c = v01 * (1 - tx) + v11 * tx;
  return a * (1 - ty) + c * ty;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

type CellCorner = { x: number; y: number; v: number };

function marchingSquares(
  values: Float64Array,
  nx: number,
  ny: number,
  originX: number,
  originY: number,
  dx: number,
  dy: number,
  level: number
): IsoluxPoint[][] {
  const segments: { a: IsoluxPoint; b: IsoluxPoint }[] = [];
  const interp = (p: CellCorner, q: CellCorner): IsoluxPoint => {
    const den = q.v - p.v;
    const t = Math.abs(den) < 1e-9 ? 0.5 : (level - p.v) / den;
    const tt = Math.max(0, Math.min(1, t));
    return { x: lerp(p.x, q.x, tt), y: lerp(p.y, q.y, tt) };
  };
  for (let j = 0; j < ny - 1; j += 1) {
    for (let i = 0; i < nx - 1; i += 1) {
      const sw: CellCorner = { x: originX + i * dx, y: originY + j * dy, v: values[j * nx + i]! };
      const se: CellCorner = { x: originX + (i + 1) * dx, y: originY + j * dy, v: values[j * nx + i + 1]! };
      const nw: CellCorner = { x: originX + i * dx, y: originY + (j + 1) * dy, v: values[(j + 1) * nx + i]! };
      const ne: CellCorner = {
        x: originX + (i + 1) * dx,
        y: originY + (j + 1) * dy,
        v: values[(j + 1) * nx + i + 1]!,
      };
      if ([sw, se, nw, ne].some((c) => !Number.isFinite(c.v))) continue;
      const idx =
        (sw.v >= level ? 1 : 0) +
        (se.v >= level ? 2 : 0) +
        (ne.v >= level ? 4 : 0) +
        (nw.v >= level ? 8 : 0);
      if (idx === 0 || idx === 15) continue;
      const bottom = () => interp(sw, se);
      const right = () => interp(se, ne);
      const top = () => interp(nw, ne);
      const left = () => interp(sw, nw);
      const add = (a: IsoluxPoint, b: IsoluxPoint) => segments.push({ a, b });
      switch (idx) {
        case 1:
        case 14:
          add(left(), bottom());
          break;
        case 2:
        case 13:
          add(bottom(), right());
          break;
        case 3:
        case 12:
          add(left(), right());
          break;
        case 4:
        case 11:
          add(right(), top());
          break;
        case 6:
        case 9:
          add(bottom(), top());
          break;
        case 7:
        case 8:
          add(left(), top());
          break;
        case 5:
          add(left(), bottom());
          add(right(), top());
          break;
        case 10:
          add(bottom(), right());
          add(left(), top());
          break;
        default:
          break;
      }
    }
  }
  return stitch(segments);
}

function stitch(segments: { a: IsoluxPoint; b: IsoluxPoint }[]): IsoluxPoint[][] {
  const key = (p: IsoluxPoint) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`;
  const used = new Array(segments.length).fill(false);
  const lines: IsoluxPoint[][] = [];
  const findFrom = (pt: IsoluxPoint, skip: number) => {
    const k = key(pt);
    for (let i = 0; i < segments.length; i += 1) {
      if (used[i] || i === skip) continue;
      if (key(segments[i]!.a) === k) return { i, next: segments[i]!.b, rev: false };
      if (key(segments[i]!.b) === k) return { i, next: segments[i]!.a, rev: true };
    }
    return null;
  };
  for (let s = 0; s < segments.length; s += 1) {
    if (used[s]) continue;
    used[s] = true;
    const line = [segments[s]!.a, segments[s]!.b];
    let guard = 0;
    while (guard++ < segments.length + 2) {
      const hit = findFrom(line[line.length - 1]!, -1);
      if (!hit) break;
      used[hit.i] = true;
      line.push(hit.next);
    }
    while (guard++ < segments.length * 2) {
      const hit = findFrom(line[0]!, -1);
      if (!hit) break;
      used[hit.i] = true;
      line.unshift(hit.next);
    }
    if (line.length >= 2) lines.push(line);
  }
  return lines;
}

function formatPointLux(v: number): string {
  if (v >= 100) return String(Math.round(v));
  if (v >= 10) return v.toFixed(0);
  return v.toFixed(1);
}

export function buildIsoluxModel(
  room: RoomV2,
  results: CalcResults,
  opts?: {
    mode?: IsoluxMode;
    wallZoneM?: number;
    fixtures?: FixtureInstance[];
    targetLongSide?: number;
  }
): IsoluxModel | null {
  const { grid } = results;
  if (!grid?.lux?.length || grid.nx < 1 || grid.ny < 1) return null;
  const mode: IsoluxMode = opts?.mode ?? "falsecolor";
  const wallZone = opts?.wallZoneM ?? 0.25;
  const b = roomBounds(room);
  const padM = Math.max(b.width, b.depth) * 0.06 + 0.15;
  const minX = b.minX - padM;
  const maxX = b.maxX + padM;
  const minY = b.minY - padM;
  const maxY = b.maxY + padM;
  const worldW = Math.max(maxX - minX, 0.2);
  const worldH = Math.max(maxY - minY, 0.2);
  const target = opts?.targetLongSide ?? 1400;
  const scale = target / Math.max(worldW, worldH);
  const width = Math.max(80, Math.round(worldW * scale));
  const height = Math.max(80, Math.round(worldH * scale));
  const toPx = (p: Vec2): IsoluxPoint => ({
    x: (p.x - minX) * scale,
    y: (maxY - p.y) * scale,
  });

  const field = new Uint8ClampedArray(width * height * 4);
  for (let py = 0; py < height; py += 1) {
    const y = maxY - (py + 0.5) / scale;
    for (let px = 0; px < width; px += 1) {
      const x = minX + (px + 0.5) / scale;
      const pt = { x, y };
      if (!inWorkplane(pt, room.polygon, wallZone)) continue;
      const lux = sampleLux(grid, b, x, y);
      const i = (py * width + px) * 4;
      if (mode === "falsecolor") {
        const [r, g, bc] = luxToRgb(lux);
        field[i] = Math.round(r * 255);
        field[i + 1] = Math.round(g * 255);
        field[i + 2] = Math.round(bc * 255);
        field[i + 3] = 255;
      }
    }
  }

  const stepM = Math.max(0.04, grid.spacing / 8);
  const sx = Math.max(8, Math.ceil(worldW / stepM) + 1);
  const sy = Math.max(8, Math.ceil(worldH / stepM) + 1);
  const fieldVals = new Float64Array(sx * sy);
  fieldVals.fill(Number.NaN);
  for (let j = 0; j < sy; j += 1) {
    const y = minY + j * stepM;
    for (let i = 0; i < sx; i += 1) {
      const x = minX + i * stepM;
      if (!inWorkplane({ x, y }, room.polygon, wallZone)) continue;
      fieldVals[j * sx + i] = sampleLux(grid, b, x, y);
    }
  }

  const levels = isoluxLevels(results.summary.emin, results.summary.emax);
  const contours = levels.map((level) => ({
    level,
    polylines: marchingSquares(fieldVals, sx, sy, minX, minY, stepM, stepM, level).map((line) =>
      line.map(toPx)
    ),
  }));

  const contourLabels: IsoluxModel["contourLabels"] = [];
  const fontGuess = Math.max(12, Math.min(22, width / 70));
  const minDist = fontGuess * 3.2;
  for (const c of contours) {
    let best: IsoluxPoint[] = [];
    for (const line of c.polylines) {
      if (line.length > best.length) best = line;
    }
    if (best.length < 4) continue;
    const candidates = [0.45, 0.3, 0.6, 0.2, 0.75].map((f) => best[Math.min(best.length - 1, Math.floor(best.length * f))]!);
    const mid = candidates.find((pt) =>
      contourLabels.every((l) => Math.hypot(l.x - pt.x, l.y - pt.y) >= minDist)
    );
    if (!mid) continue;
    contourLabels.push({ x: mid.x, y: mid.y, text: formatPointLux(c.level) });
  }

  const valueLabels: IsoluxModel["valueLabels"] = [];
  const nPts = grid.nx * grid.ny;
  const stride = nPts > 90 ? Math.ceil(Math.sqrt(nPts / 70)) : 1;
  for (let j = 0; j < grid.ny; j += stride) {
    for (let i = 0; i < grid.nx; i += stride) {
      const lux = grid.lux[j * grid.nx + i] ?? 0;
      if (lux <= 0) continue;
      const x = b.minX + grid.originX + i * grid.spacing;
      const y = b.minY + grid.originY + j * grid.spacing;
      if (!inWorkplane({ x, y }, room.polygon, wallZone)) continue;
      const p = toPx({ x, y });
      valueLabels.push({ x: p.x, y: p.y, text: formatPointLux(lux) });
    }
  }

  const fixtures = (opts?.fixtures ?? [])
    .filter((f) => f.roomId === room.id)
    .map((f) => toPx({ x: f.position.x, y: f.position.y }));

  return {
    width,
    height,
    field,
    contours,
    contourLabels,
    valueLabels,
    roomOutline: room.polygon.map(toPx),
    workplaneOutline: insetPolygon(room.polygon, wallZone).map(toPx),
    fixtures,
    legendStops: legendStopsForRange(results.summary.emin, results.summary.emax),
    fontPx: Math.max(12, Math.min(22, width / 70)),
  };
}
