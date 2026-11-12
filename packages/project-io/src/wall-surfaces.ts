/**
 * Automatic vertical calculation surfaces on every room wall.
 *
 * Follows DIALux evo "Automatically select room main surfaces" practice
 * (surfaces sit on the walls, vertical / perpendicular illuminance, inward
 * normal, wall-zone inset) and EN 12464-1 guidance that walls get a grid and
 * an edge band. This project uses the same 0.25 m first-point inset as the
 * workplane (gridSpacing/2). EN 12464 allows up to 0.5 m; 0.25 m is used so
 * short walls in this project still receive a grid (DIALux skips a surface
 * when the wall zone is larger than the surface).
 */
import { totalDirectIlluminance } from "../../solver/src/direct";
import { interreflectedWallBoost } from "../../solver/src/interreflect";
import type { LuminaireInstance } from "../../solver/src/types";
import type { PhotometricData } from "../../photometry/src/types";
import { pointInPolygon, roomAreaM2 } from "./geometry";
import { wallZoneM } from "./report-model";
import type { FixtureInstance, RoomV2, Vec2, WallSurfaceResult } from "./types";

export const WALL_MERGE_DEG = 20;
export const WALL_ABSORB_SHORT_M = 0.15;
export const WALL_MIN_EDGE_M = 0.02;
export const WALL_SURFACE_OFFSET_M = 0.005;

export interface WallChain {
  polyline: Vec2[];
  lengthM: number;
  /** Inward unit normals, one per segment (polyline[i] → polyline[i+1]). */
  normals: Vec2[];
  curved: boolean;
}

export function signedPolygonArea(polygon: Vec2[]): number {
  let sum = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

export function inwardNormal(a: Vec2, b: Vec2, ccw: boolean): Vec2 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // Left normal; CCW polygons have the interior on the left.
  const left = { x: -dy / len, y: dx / len };
  return ccw ? left : { x: -left.x, y: -left.y };
}

function turnDeg(a: Vec2, b: Vec2, c: Vec2): number {
  const lx = b.x - a.x;
  const ly = b.y - a.y;
  const mx = c.x - b.x;
  const my = c.y - b.y;
  return (Math.atan2(lx * my - ly * mx, lx * mx + ly * my) * 180) / Math.PI;
}

function polylineLength(pts: Vec2[]): number {
  let L = 0;
  for (let i = 0; i < pts.length - 1; i += 1) {
    L += Math.hypot(pts[i + 1]!.x - pts[i]!.x, pts[i + 1]!.y - pts[i]!.y);
  }
  return L;
}

/**
 * Group room-polygon edges into wall chains.
 * Nearly colinear segments (curves) merge; tiny CAD fillets are absorbed;
 * sharp corners start a new wall.
 */
export function buildWallChains(
  room: RoomV2,
  opts?: { mergeDeg?: number; absorbShortM?: number; minEdgeM?: number }
): WallChain[] {
  const poly = room.polygon;
  const n = poly.length;
  if (n < 2) return [];
  const ccw = signedPolygonArea(poly) > 0;
  const mergeDeg = opts?.mergeDeg ?? WALL_MERGE_DEG;
  const absorbShortM = opts?.absorbShortM ?? WALL_ABSORB_SHORT_M;
  const minEdgeM = opts?.minEdgeM ?? WALL_MIN_EDGE_M;

  const edges: { a: Vec2; b: Vec2; lengthM: number }[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = poly[i]!;
    const b = poly[(i + 1) % n]!;
    const lengthM = Math.hypot(b.x - a.x, b.y - a.y);
    if (lengthM < minEdgeM) continue;
    edges.push({ a, b, lengthM });
  }
  if (!edges.length) return [];

  const chains: { pts: Vec2[] }[] = [];
  let pts: Vec2[] = [{ ...edges[0]!.a }, { ...edges[0]!.b }];

  for (let i = 1; i < edges.length; i += 1) {
    const prev = edges[i - 1]!;
    const cur = edges[i]!;
    const turn = Math.abs(turnDeg(prev.a, prev.b, cur.b));
    const absorb = cur.lengthM < absorbShortM || prev.lengthM < absorbShortM;
    if (turn < mergeDeg || absorb) {
      pts.push({ ...cur.b });
    } else {
      chains.push({ pts });
      pts = [{ ...cur.a }, { ...cur.b }];
    }
  }
  // Close the loop: maybe merge last chain with the first.
  const first = edges[0]!;
  const last = edges[edges.length - 1]!;
  const closeTurn = Math.abs(turnDeg(last.a, last.b, first.b));
  const closeAbsorb = first.lengthM < absorbShortM || last.lengthM < absorbShortM;
  if (chains.length && (closeTurn < mergeDeg || closeAbsorb)) {
    const head = chains.shift()!;
    pts = pts.concat(head.pts.slice(1));
    chains.push({ pts });
  } else {
    chains.push({ pts });
  }

  return chains
    .map((c) => {
      const lengthM = polylineLength(c.pts);
      const normals: Vec2[] = [];
      for (let i = 0; i < c.pts.length - 1; i += 1) {
        normals.push(inwardNormal(c.pts[i]!, c.pts[i + 1]!, ccw));
      }
      const curved = c.pts.length > 2 && normals.some((n, i) => {
        const m = normals[0]!;
        const dot = n.x * m.x + n.y * m.y;
        return dot < 0.985; // ~10°
      });
      return { polyline: c.pts, lengthM, normals, curved };
    })
    .filter((c) => c.lengthM >= minEdgeM && c.normals.length > 0);
}

export interface WallSample {
  u: number;
  v: number;
  point: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number };
}

export function locateOnPolyline(
  polyline: Vec2[],
  normals: Vec2[],
  u: number
): { x: number; y: number; normal: Vec2 } {
  let remain = Math.max(0, u);
  const last = polyline.length - 2;
  for (let i = 0; i <= last; i += 1) {
    const a = polyline[i]!;
    const b = polyline[i + 1]!;
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (i < last && remain > seg) {
      remain -= seg;
      continue;
    }
    const t = seg > 1e-9 ? Math.min(1, remain / seg) : 0;
    const n = normals[i] ?? normals[normals.length - 1]!;
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      normal: n,
    };
  }
  const a = polyline[polyline.length - 2]!;
  const b = polyline[polyline.length - 1]!;
  return { x: b.x, y: b.y, normal: normals[normals.length - 1]! };
}

export function wallGridAxes(lengthM: number, heightM: number, spacing: number, insetM: number): {
  us: number[];
  vs: number[];
} {
  const us: number[] = [];
  const vs: number[] = [];
  if (lengthM > 2 * insetM + 1e-6) {
    for (let u = insetM; u < lengthM - 1e-9; u += spacing) us.push(u);
  }
  if (us.length === 0 && lengthM >= WALL_MIN_EDGE_M) us.push(lengthM / 2);

  if (heightM > 2 * insetM + 1e-6) {
    for (let v = insetM; v < heightM - 1e-9; v += spacing) vs.push(v);
  }
  if (vs.length === 0 && heightM > 0) vs.push(heightM / 2);
  return { us, vs };
}

export function sampleWallGrid(chain: WallChain, heightM: number, spacing: number, insetM: number): WallSample[] {
  const { us, vs } = wallGridAxes(chain.lengthM, heightM, spacing, insetM);
  const samples: WallSample[] = [];
  for (const v of vs) {
    for (const u of us) {
      const loc = locateOnPolyline(chain.polyline, chain.normals, u);
      samples.push({
        u,
        v,
        point: {
          x: loc.x + loc.normal.x * WALL_SURFACE_OFFSET_M,
          y: loc.y + loc.normal.y * WALL_SURFACE_OFFSET_M,
          z: v,
        },
        normal: { x: loc.normal.x, y: loc.normal.y, z: 0 },
      });
    }
  }
  return samples;
}

/** Sample illuminance at a (u, v) on the unrolled wall (bilinear, clamped). */
export function sampleWallLux(surface: WallSurfaceResult, u: number, v: number): number {
  const { grid } = surface;
  if (grid.nu < 1 || grid.nv < 1) return 0;
  const fu = grid.nu === 1 ? 0 : (u - grid.originU) / Math.max(grid.spacing, 1e-6);
  const fv = grid.nv === 1 ? 0 : (v - grid.originV) / Math.max(grid.spacing, 1e-6);
  const at = (i: number, j: number): number => {
    const ii = Math.min(grid.nu - 1, Math.max(0, i));
    const jj = Math.min(grid.nv - 1, Math.max(0, j));
    return grid.lux[jj * grid.nu + ii] ?? 0;
  };
  const x0 = Math.floor(fu);
  const y0 = Math.floor(fv);
  const tx = Math.min(1, Math.max(0, fu - x0));
  const ty = Math.min(1, Math.max(0, fv - y0));
  return (
    at(x0, y0) * (1 - tx) * (1 - ty) +
    at(x0 + 1, y0) * tx * (1 - ty) +
    at(x0, y0 + 1) * (1 - tx) * ty +
    at(x0 + 1, y0 + 1) * tx * ty
  );
}

function meanVector(vectors: Vec2[]): Vec2 {
  let x = 0;
  let y = 0;
  for (const v of vectors) {
    x += v.x;
    y += v.y;
  }
  const n = vectors.length || 1;
  const L = Math.hypot(x / n, y / n) || 1;
  return { x: x / n / L, y: y / n / L };
}

export interface CalculateWallsInput {
  room: RoomV2;
  instances: FixtureInstance[];
  photometry: Record<string, PhotometricData>;
  wattsById?: Record<string, number | null | undefined>;
  /** Workplane direct-only mean, if already known. Otherwise recomputed (not written back). */
  workplaneDirectMean?: number;
}

/**
 * Calculate vertical illuminance on every automatic wall surface of a room.
 * Does not modify or replace the room's workplane CalcResults.
 */
export function calculateRoomWalls(input: CalculateWallsInput): WallSurfaceResult[] {
  const { room, instances, photometry, wattsById } = input;
  const spacing = Math.max(0.25, Math.min(2, room.calc.gridSpacing || 0.5));
  const insetM = wallZoneM(room);
  const chains = buildWallChains(room);
  const luminaires: LuminaireInstance[] = [];
  for (const inst of instances) {
    if (inst.roomId !== room.id) continue;
    const photo = photometry[inst.luminaireId];
    if (!photo) continue;
    luminaires.push({
      id: inst.instanceId,
      name: inst.name,
      position: { ...inst.position },
      rotationDeg: inst.rotationDeg,
      photometry: photo,
      watts: wattsById?.[inst.luminaireId] ?? photo.watts,
    });
  }

  const roomSpec = {
    width: 1,
    depth: 1,
    height: room.heightM,
    reflectance: room.reflectance,
    workplaneHeight: room.workplaneHeightM,
  };
  // Approximate plan dimensions for the area-weighted reflectance in the boost.
  // Use polygon area + perimeter-derived equivalent box.
  const area = Math.max(roomAreaM2(room), 0.1);
  const perim = chains.reduce((s, c) => s + c.lengthM, 0);
  // width*depth = area, 2*(w+d) ≈ perim → w+d = perim/2, wd = area
  const sum = perim / 2;
  const disc = Math.max(0, sum * sum - 4 * area);
  const wEq = (sum + Math.sqrt(disc)) / 2;
  const dEq = area / Math.max(wEq, 0.1);
  roomSpec.width = wEq;
  roomSpec.depth = dEq;

  let wpDirect = input.workplaneDirectMean;
  if (wpDirect == null && luminaires.length) {
    wpDirect = estimateWorkplaneDirectMean(room, luminaires, spacing);
  }
  wpDirect = wpDirect ?? 0;

  const out: WallSurfaceResult[] = [];
  let index = 0;
  for (const chain of chains) {
    const samples = sampleWallGrid(chain, room.heightM, spacing, insetM);
    if (!samples.length) continue;
    index += 1;
    const us = [...new Set(samples.map((s) => s.u))].sort((a, b) => a - b);
    const vs = [...new Set(samples.map((s) => s.v))].sort((a, b) => a - b);
    const nu = us.length;
    const nv = vs.length;
    const direct = new Array(nu * nv).fill(0);
    let sumD = 0;
    for (const s of samples) {
      const i = us.indexOf(s.u);
      const j = vs.indexOf(s.v);
      const e = totalDirectIlluminance(s.point, s.normal, luminaires);
      direct[j * nu + i] = e;
      sumD += e;
    }
    const eDirectMean = direct.length ? sumD / direct.length : 0;
    let indirect = 0;
    if (room.calc.interreflection) {
      indirect = interreflectedWallBoost(roomSpec, wpDirect, eDirectMean, room.calc.bounces ?? 2);
    }
    const lux = direct.map((e) => e + indirect);
    let sumE = 0;
    let emin = Infinity;
    let emax = -Infinity;
    for (const e of lux) {
      sumE += e;
      emin = Math.min(emin, e);
      emax = Math.max(emax, e);
    }
    const eave = lux.length ? sumE / lux.length : 0;
    const usableW = nu > 1 ? (nu - 1) * spacing : Math.max(chain.lengthM - 2 * insetM, spacing * 0.5);
    const usableH = nv > 1 ? (nv - 1) * spacing : Math.max(room.heightM - 2 * insetM, spacing * 0.5);
    const label = chain.curved ? `Wall ${index} (curved)` : `Wall ${index}`;
    out.push({
      id: `${room.id}-wall-${index}`,
      roomId: room.id,
      name: `${label} (${room.name})`,
      polyline: chain.polyline,
      normals: chain.normals,
      heightM: room.heightM,
      insetM,
      normal: meanVector(chain.normals),
      widthM: chain.lengthM,
      curved: chain.curved,
      grid: {
        originU: us[0] ?? insetM,
        originV: vs[0] ?? insetM,
        spacing,
        nu,
        nv,
        lux,
      },
      summary: {
        eave,
        emin: Number.isFinite(emin) ? emin : 0,
        emax: Number.isFinite(emax) ? emax : 0,
        uo: eave > 1e-6 ? emin / eave : 0,
        areaM2: Math.max(0, usableW * usableH),
      },
    });
  }
  return out;
}

/** Direct-only workplane mean, used as the energy basis for the wall bounce model. Never written as results. */
export function estimateWorkplaneDirectMean(
  room: RoomV2,
  luminaires: LuminaireInstance[],
  spacing: number
): number {
  const inset = wallZoneM(room);
  const z = Math.min(room.workplaneHeightM, room.heightM - 0.05);
  // Sample a coarse grid inside the polygon (world coords).
  const xs: number[] = [];
  const ys: number[] = [];
  const pts = room.polygon;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  for (let x = minX + inset; x < maxX - 1e-9; x += spacing) xs.push(x);
  for (let y = minY + inset; y < maxY - 1e-9; y += spacing) ys.push(y);
  if (!xs.length) xs.push((minX + maxX) / 2);
  if (!ys.length) ys.push((minY + maxY) / 2);
  const up = { x: 0, y: 0, z: 1 };
  let sum = 0;
  let n = 0;
  for (const y of ys) {
    for (const x of xs) {
      if (!pointInPolygon({ x, y }, room.polygon)) continue;
      sum += totalDirectIlluminance({ x, y, z }, up, luminaires);
      n += 1;
    }
  }
  return n > 0 ? sum / n : 0;
}
