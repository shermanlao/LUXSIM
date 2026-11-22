/**
 * Shared Three.js scene construction for the in-app 3D viewer and report captures.
 * Rooms have a floor, walls, and a downward-facing ceiling so the underside is
 * visible from inside the room. Report cameras looking down still see into the space.
 * False-colour workplanes are tessellated denser than the room corners and clipped to the polygon.
 */
import * as THREE from "three";
import type { PhotometricData } from "@luxsim/photometry";
import { luminaireBody } from "@luxsim/photometry";
import type { CalcResults } from "@luxsim/solver";
import {
  isoluxPxToWorld,
  luxToRgbLinear,
  officialIsoluxModelForRoom,
  OFFICIAL_FALSE_COLOR_SCALE,
  pointInPolygon,
  roomBounds,
  locateOnPolyline,
  sampleWallLux,
  type Display3dMode,
  type IsoluxPalette,
  type FalseColorScale,
  type ProjectSceneV2,
  type ResultsV2,
  type RoomV2,
  type WallSurfaceResult,
} from "@luxsim/project-io";
import { officialIlluminanceFieldHeightM } from "./workplane-display";

export const EDITOR_BG = "#0f1c24";
export const REPORT_BG = "#f3f3f0";

/** Opaque grey shell so the exterior façade stays uncoloured and interior wall colour cannot show through. */
export const FALSE_COLOR_WALL_SHELL_OPACITY = 1;
export const GREYSCALE_WALL_SHELL_OPACITY = 1;
export const ILLUMINANCE_WALL_SHELL_OPACITY = 1;

/** Outer wall face sits this far inside the room polygon so adjacent rooms do not share a plane. */
export const WALL_SHELL_OUTER_INSET_M = 0.005;
/** Visual wall thickness (inner face is this far inward of the outer face). */
export const WALL_SHELL_THICKNESS_M = 0.02;
export const WALL_SHELL_INNER_INSET_M = WALL_SHELL_OUTER_INSET_M + WALL_SHELL_THICKNESS_M;
/** Extra inward offset past the inner shell face so the colour mesh sits just inside the room. */
export const WALL_FALSE_COLOR_INSET_EPSILON_M = 0.002;
/** False-colour wall overlay sits just inside the opaque inner shell face. FrontSide only; the exterior stays grey. */
export const WALL_FALSE_COLOR_INSET_M = WALL_SHELL_INNER_INSET_M + WALL_FALSE_COLOR_INSET_EPSILON_M;

export function wallShellOpacity(_mode: Display3dMode): number {
  return ILLUMINANCE_WALL_SHELL_OPACITY;
}

const FLOOR_COLOR = "#c8cbcf";
const CEILING_COLOR = "#d8dce0";
const WALL_COLOR = "#b0b4b8";
const WALL_COLOR_ACTIVE = "#c5b7ab";
const EDGE_COLOR = "#2c2c2c";
const EDGE_COLOR_ACTIVE = "#c45c26";

export function sampleGridLux(room: RoomV2, grid: CalcResults["grid"], wx: number, wy: number): number {
  const b = roomBounds(room);
  const fx = (wx - (b.minX + grid.originX)) / Math.max(grid.spacing, 1e-6);
  const fy = (wy - (b.minY + grid.originY)) / Math.max(grid.spacing, 1e-6);
  if (!Number.isFinite(fx) || !Number.isFinite(fy)) return 0;
  const at = (i: number, j: number): number | null => {
    if (i < 0 || j < 0 || i >= grid.nx || j >= grid.ny) return null;
    return grid.lux[j * grid.nx + i] ?? 0;
  };
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const q00 = at(x0, y0);
  const q10 = at(x0 + 1, y0);
  const q01 = at(x0, y0 + 1);
  const q11 = at(x0 + 1, y0 + 1);
  const samples = [
    [q00, (1 - tx) * (1 - ty)],
    [q10, tx * (1 - ty)],
    [q01, (1 - tx) * ty],
    [q11, tx * ty],
  ] as const;
  let num = 0;
  let den = 0;
  for (const [v, w] of samples) {
    if (v == null) continue;
    num += v * w;
    den += w;
  }
  if (den < 1e-8) {
    // Nearest in-grid sample, otherwise 0.
    const i = Math.min(grid.nx - 1, Math.max(0, Math.round(fx)));
    const j = Math.min(grid.ny - 1, Math.max(0, Math.round(fy)));
    return at(i, j) ?? 0;
  }
  return num / den;
}

function shapeFromPolygon(polygon: { x: number; y: number }[]): THREE.Shape | null {
  if (polygon.length < 3) return null;
  const shape = new THREE.Shape();
  const first = polygon[0]!;
  shape.moveTo(first.x, -first.y);
  for (let i = 1; i < polygon.length; i += 1) {
    const p = polygon[i]!;
    shape.lineTo(p.x, -p.y);
  }
  shape.closePath();
  return shape;
}

/** Same family as wall false-colour sampling: half the calculation grid, with a floor. */
export const WORKPLANE_FALSE_COLOR_MIN_SPACING_M = 0.15;
/** Longest AABB side is split into at most this many steps so a large room cannot explode. */
export const WORKPLANE_FALSE_COLOR_MAX_DIVISIONS = 80;

export function workplaneFalseColorSpacing(gridSpacing: number, width: number, depth: number): number {
  const preferred = Math.max(WORKPLANE_FALSE_COLOR_MIN_SPACING_M, gridSpacing / 2);
  const maxDim = Math.max(width, depth, 1e-6);
  return Math.max(preferred, maxDim / WORKPLANE_FALSE_COLOR_MAX_DIVISIONS);
}

type PlanPt = { x: number; y: number };

function planSignedArea(poly: PlanPt[]): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function planEnsureCcw(poly: PlanPt[]): PlanPt[] {
  return planSignedArea(poly) < 0 ? [...poly].reverse() : poly;
}

function uniqueSorted(values: number[], eps = 1e-9): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of sorted) {
    if (!out.length || v - out[out.length - 1]! > eps) out.push(v);
  }
  return out;
}

/** Origin-aligned samples plus bounds and extra vertices, then uniqued. */
function axisSamples(min: number, max: number, origin: number, spacing: number, extra: number[]): number[] {
  const values = [min, max, ...extra.filter((v) => v >= min - 1e-9 && v <= max + 1e-9)];
  const span = Math.max(max - min, 0);
  const step = Math.max(spacing, 1e-6);
  const startK = Math.ceil((min - origin) / step - 1e-9);
  const endK = Math.floor((max - origin) / step + 1e-9);
  for (let k = startK; k <= endK; k += 1) {
    const v = origin + k * step;
    if (v >= min - 1e-9 && v <= max + 1e-9) values.push(Math.min(max, Math.max(min, v)));
  }
  // If origin alignment produced almost no interior steps (degenerate origin),
  // still walk from min so a typical room gets a dense mesh.
  if (span > step * 1.5) {
    const expected = Math.floor(span / step);
    const interior = values.filter((v) => v > min + 1e-9 && v < max - 1e-9).length;
    if (interior < expected * 0.5) {
      for (let x = min + step; x < max - 1e-9; x += step) values.push(x);
    }
  }
  return uniqueSorted(values);
}

function leftOfEdge(p: PlanPt, a: PlanPt, b: PlanPt): boolean {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) >= -1e-12;
}

function segmentIntersection(s: PlanPt, e: PlanPt, a: PlanPt, b: PlanPt): PlanPt {
  const dsx = e.x - s.x;
  const dsy = e.y - s.y;
  const dax = b.x - a.x;
  const day = b.y - a.y;
  const den = dsx * day - dsy * dax;
  if (Math.abs(den) < 1e-18) return { x: e.x, y: e.y };
  const t = ((a.x - s.x) * day - (a.y - s.y) * dax) / den;
  return { x: s.x + t * dsx, y: s.y + t * dsy };
}

/** Convex clip (Sutherland–Hodgman). Room polygons may be concave, so callers clip against triangles. */
function clipPolygonByConvex(subject: PlanPt[], clip: PlanPt[]): PlanPt[] {
  const clipCcw = planEnsureCcw(clip);
  let output = subject;
  for (let i = 0; i < clipCcw.length; i += 1) {
    const a = clipCcw[i]!;
    const b = clipCcw[(i + 1) % clipCcw.length]!;
    const input = output;
    output = [];
    if (!input.length) break;
    for (let j = 0; j < input.length; j += 1) {
      const cur = input[j]!;
      const prev = input[(j + input.length - 1) % input.length]!;
      const curIn = leftOfEdge(cur, a, b);
      const prevIn = leftOfEdge(prev, a, b);
      if (curIn) {
        if (!prevIn) output.push(segmentIntersection(prev, cur, a, b));
        output.push(cur);
      } else if (prevIn) {
        output.push(segmentIntersection(prev, cur, a, b));
      }
    }
  }
  return output;
}

function triangulateRoomPlan(polygon: PlanPt[]): PlanPt[][] {
  const shape = shapeFromPolygon(polygon);
  if (!shape) return [];
  const geo = new THREE.ShapeGeometry(shape);
  const pos = geo.getAttribute("position");
  const idx = geo.getIndex();
  const tris: PlanPt[][] = [];
  const at = (i: number): PlanPt => ({ x: pos.getX(i), y: -pos.getY(i) });
  if (idx) {
    for (let i = 0; i + 2 < idx.count; i += 3) {
      tris.push([at(idx.getX(i)), at(idx.getX(i + 1)), at(idx.getX(i + 2))]);
    }
  } else if (pos) {
    for (let i = 0; i + 2 < pos.count; i += 3) {
      tris.push([at(i), at(i + 1), at(i + 2)]);
    }
  }
  geo.dispose();
  return tris.filter((t) => Math.abs(planSignedArea(t)) > 1e-16).map(planEnsureCcw);
}

/** Clipped workplane in Three.js world space (y-up). Vertex-coloured with the project-wide lux scale. */
export function createClippedWorkplaneGeometry(
  room: RoomV2,
  results: CalcResults,
  elevationM: number,
  scale?: FalseColorScale,
  palette: IsoluxPalette = "falsecolor",
  showWorkplane = true
): THREE.BufferGeometry | null {
  if (room.polygon.length < 3) return null;
  const triangles = triangulateRoomPlan(room.polygon);
  if (!triangles.length) return null;

  const b = roomBounds(room);
  const spacing = workplaneFalseColorSpacing(results.grid.spacing, b.width, b.depth);
  const xs = axisSamples(
    b.minX,
    b.maxX,
    b.minX + results.grid.originX,
    spacing,
    room.polygon.map((p) => p.x)
  );
  const ys = axisSamples(
    b.minY,
    b.maxY,
    b.minY + results.grid.originY,
    spacing,
    room.polygon.map((p) => p.y)
  );
  if (xs.length < 2 || ys.length < 2) return null;

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const height = officialFalseColorWorkplaneHeight(room, results, elevationM, showWorkplane);
  const vertIndex = new Map<string, number>();

  const vertexAt = (p: PlanPt): number => {
    const key = `${p.x.toFixed(6)},${p.y.toFixed(6)}`;
    const existing = vertIndex.get(key);
    if (existing != null) return existing;
    const i = positions.length / 3;
    positions.push(p.x, height, p.y);
    const lux = sampleGridLux(room, results.grid, p.x, p.y);
    const [r, g, bl] = luxToRgbLinear(lux, scale, palette);
    colors.push(r, g, bl);
    vertIndex.set(key, i);
    return i;
  };

  const almostSame = (a: PlanPt, b: PlanPt): boolean => Math.hypot(a.x - b.x, a.y - b.y) < 1e-9;

  const cleanRing = (poly: PlanPt[]): PlanPt[] => {
    const ccw = planEnsureCcw(poly);
    const out: PlanPt[] = [];
    for (const p of ccw) {
      if (!out.length || !almostSame(out[out.length - 1]!, p)) out.push(p);
    }
    if (out.length >= 2 && almostSame(out[0]!, out[out.length - 1]!)) out.pop();
    return out;
  };

  const emitFan = (poly: PlanPt[]) => {
    const ring = cleanRing(poly);
    if (ring.length < 3 || Math.abs(planSignedArea(ring)) < 1e-16) return;
    const ids = ring.map(vertexAt);
    for (let i = 1; i < ids.length - 1; i += 1) {
      const ia = ids[0]!;
      const ib = ids[i]!;
      const ic = ids[i + 1]!;
      if (ia === ib || ib === ic || ia === ic) continue;
      const area = planSignedArea([ring[0]!, ring[i]!, ring[i + 1]!]);
      if (Math.abs(area) < 1e-16) continue;
      indices.push(ia, ib, ic);
    }
  };

  for (let iy = 0; iy < ys.length - 1; iy += 1) {
    const y0 = ys[iy]!;
    const y1 = ys[iy + 1]!;
    if (y1 - y0 < 1e-12) continue;
    for (let ix = 0; ix < xs.length - 1; ix += 1) {
      const x0 = xs[ix]!;
      const x1 = xs[ix + 1]!;
      if (x1 - x0 < 1e-12) continue;
      const cell: PlanPt[] = [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: x1, y: y1 },
        { x: x0, y: y1 },
      ];
      for (const tri of triangles) {
        emitFan(clipPolygonByConvex(cell, tri));
      }
    }
  }

  if (positions.length < 9 || indices.length < 3) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Display height of the 3D workplane / calculation plane. Follows room.workplaneHeightM immediately. */
export function workplaneDisplayHeightM(room: Pick<RoomV2, "workplaneHeightM">, elevationM = 0): number {
  return officialIlluminanceFieldHeightM(room, elevationM, true);
}

export function officialFalseColorWorkplaneHeight(
  room: RoomV2,
  results: CalcResults,
  elevationM: number,
  showWorkplane = true
): number {
  // Display follows the live Workplane (m) field, not the last calculated grid z.
  void results;
  return officialIlluminanceFieldHeightM(room, elevationM, showWorkplane);
}

/** Uncoloured calculation-plane plate, at the same height as the false-colour workplane. */
export function createWorkplanePlateGeometry(
  room: RoomV2,
  elevationM: number
): THREE.BufferGeometry | null {
  const shape = shapeFromPolygon(room.polygon);
  if (!shape) return null;
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, workplaneDisplayHeightM(room, elevationM), 0);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Official 3D workplane that uses the same isolux field bitmap as the Top plan,
 * with an sRGB canvas texture so colour-managed WebGL matches the 2D canvas.
 */
export function createOfficialFalseColorWorkplane(
  room: RoomV2,
  results: CalcResults,
  elevationM: number,
  scale?: FalseColorScale,
  palette: IsoluxPalette = "falsecolor",
  showWorkplane = true
): { geometry: THREE.BufferGeometry; material: THREE.MeshBasicMaterial; texture: THREE.CanvasTexture } | null {
  if (typeof document === "undefined") return null;
  const model = officialIsoluxModelForRoom(room, results, {
    mode: "falsecolor",
    targetLongSide: 800,
    colorScale: scale,
    includeContours: false,
    includeValueLabels: false,
    palette,
  });
  if (!model) return null;
  const canvas = document.createElement("canvas");
  canvas.width = model.width;
  canvas.height = model.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const image = new ImageData(model.width, model.height);
  image.data.set(model.field);
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  const height = officialFalseColorWorkplaneHeight(room, results, elevationM, showWorkplane);
  const tl = isoluxPxToWorld(model.world, { x: 0, y: 0 });
  const tr = isoluxPxToWorld(model.world, { x: model.width, y: 0 });
  const bl = isoluxPxToWorld(model.world, { x: 0, y: model.height });
  const br = isoluxPxToWorld(model.world, { x: model.width, y: model.height });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [tl.x, height, tl.y, tr.x, height, tr.y, bl.x, height, bl.y, br.x, height, br.y],
      3
    )
  );
  // CanvasTexture flipY defaults to true: uv (0,0) is the bottom of the image (min Y).
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2));
  geometry.setIndex([0, 2, 1, 1, 2, 3]);
  geometry.computeVertexNormals();
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.05,
    side: THREE.DoubleSide,
    depthWrite: true,
    toneMapped: false,
  });
  return { geometry, material, texture };
}


/** False-colour mesh for a vertical wall surface, following the wall polyline (not a bounding box). */
export function createWallFalseColorGeometry(
  surface: WallSurfaceResult,
  elevationM: number,
  inwardOffset = WALL_FALSE_COLOR_INSET_M,
  scale?: FalseColorScale,
  palette: IsoluxPalette = "falsecolor"
): THREE.BufferGeometry | null {
  const poly = surface.polyline;
  const normals = surface.normals;
  if (!poly || poly.length < 2 || !normals?.length) return null;
  const height = Math.max(0.05, surface.heightM);
  const spacing = Math.max(0.15, surface.grid.spacing / 2);
  const us: number[] = [];
  for (let u = 0; u < surface.widthM - 1e-9; u += spacing) us.push(u);
  if (!us.length || us[us.length - 1]! < surface.widthM - 1e-6) us.push(surface.widthM);
  const vs: number[] = [];
  for (let v = 0; v < height - 1e-9; v += spacing) vs.push(v);
  if (!vs.length || vs[vs.length - 1]! < height - 1e-6) vs.push(height);

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const colN = us.length;
  const rowN = vs.length;
  for (const v of vs) {
    for (const u of us) {
      const loc = locateOnPolyline(poly, normals, u);
      positions.push(
        loc.x + loc.normal.x * inwardOffset,
        elevationM + v,
        loc.y + loc.normal.y * inwardOffset
      );
      const [cr, cg, cb] = luxToRgbLinear(sampleWallLux(surface, u, v), scale, palette);
      colors.push(cr, cg, cb);
    }
  }
  for (let r = 0; r < rowN - 1; r += 1) {
    for (let c = 0; c < colN - 1; c += 1) {
      const i = r * colN + c;
      indices.push(i, i + 1, i + colN);
      indices.push(i + 1, i + colN + 1, i + colN);
    }
  }
  if (positions.length < 9 || indices.length < 3) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function workplaneVerticesInsideRoom(
  geo: THREE.BufferGeometry,
  room: RoomV2,
  epsilon = 0.04
): { inside: number; total: number } {
  const pos = geo.getAttribute("position");
  let inside = 0;
  const total = pos?.count ?? 0;
  for (let i = 0; i < total; i += 1) {
    const p = { x: pos!.getX(i), y: pos!.getZ(i) };
    if (pointInPolygon(p, room.polygon)) {
      inside += 1;
      continue;
    }
    // Allow a small epsilon for tessellation vertices on the boundary.
    const b = roomBounds(room);
    if (
      p.x >= b.minX - epsilon &&
      p.x <= b.maxX + epsilon &&
      p.y >= b.minY - epsilon &&
      p.y <= b.maxY + epsilon
    ) {
      // Distance to nearest edge — treat near-edge verts as inside.
      let near = false;
      const n = room.polygon.length;
      for (let e = 0; e < n; e += 1) {
        const a = room.polygon[e]!;
        const c = room.polygon[(e + 1) % n]!;
        const dx = c.x - a.x;
        const dy = c.y - a.y;
        const len2 = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
        const dist = Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
        if (dist <= epsilon) {
          near = true;
          break;
        }
      }
      if (near) inside += 1;
    }
  }
  return { inside, total };
}

export function createFloorGeometry(room: RoomV2, elevationM: number): THREE.BufferGeometry | null {
  const shape = shapeFromPolygon(room.polygon);
  if (!shape) return null;
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, elevationM + 0.002, 0);
  geo.computeVertexNormals();
  return geo;
}

export function createCeilingGeometry(room: RoomV2, elevationM: number): THREE.BufferGeometry | null {
  const shape = shapeFromPolygon(room.polygon);
  if (!shape) return null;
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  const y = elevationM + Math.max(0.1, room.heightM) - 0.002;
  geo.translate(0, y, 0);
  // Reverse triangle winding so the front face points down into the room.
  // (A Y scale would not change XZ winding, so it cannot flip the face.)
  const index = geo.getIndex();
  if (index) {
    const arr = index.array;
    for (let i = 0; i + 2 < arr.length; i += 3) {
      const tmp = arr[i + 1];
      arr[i + 1] = arr[i + 2];
      arr[i + 2] = tmp;
    }
    index.needsUpdate = true;
  } else {
    const pos = geo.getAttribute("position");
    const arr = pos.array as Float32Array;
    for (let i = 0; i + 2 < pos.count; i += 3) {
      const i1 = (i + 1) * 3;
      const i2 = (i + 2) * 3;
      for (let k = 0; k < 3; k += 1) {
        const tmp = arr[i1 + k]!;
        arr[i1 + k] = arr[i2 + k]!;
        arr[i2 + k] = tmp;
      }
    }
    pos.needsUpdate = true;
  }
  geo.computeVertexNormals();
  return geo;
}

function signedPolygonArea(poly: { x: number; y: number }[]): number {
  let sum = 0;
  const n = poly.length;
  for (let i = 0; i < n; i += 1) {
    const a = poly[i]!;
    const b = poly[(i + 1) % n]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function closedRing(poly: { x: number; y: number }[]): { x: number; y: number }[] {
  if (poly.length < 3) return [];
  const ring = poly.map((p) => ({ x: p.x, y: p.y }));
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  if (Math.hypot(first.x - last.x, first.y - last.y) < 1e-9) ring.pop();
  return ring.length >= 3 ? ring : [];
}

/** Unit inward perpendicular. Left of the edge for a CCW ring, right for CW. */
function inwardEdgeNormal(
  a: { x: number; y: number },
  b: { x: number; y: number },
  ccw: boolean
): { x: number; z: number } | null {
  let nx = a.y - b.y;
  let nz = b.x - a.x;
  const len = Math.hypot(nx, nz);
  if (len < 1e-12) return null;
  nx /= len;
  nz /= len;
  if (!ccw) {
    nx = -nx;
    nz = -nz;
  }
  return { x: nx, z: nz };
}

const WALL_SHELL_MITER_LIMIT = 4;

function offsetRing(
  ring: { x: number; y: number }[],
  dist: number,
  ccw: boolean
): { x: number; y: number }[] {
  const n = ring.length;
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i += 1) {
    const prev = ring[(i - 1 + n) % n]!;
    const curr = ring[i]!;
    const next = ring[(i + 1) % n]!;
    const n1 = inwardEdgeNormal(prev, curr, ccw);
    const n2 = inwardEdgeNormal(curr, next, ccw);
    if (!n1 && !n2) {
      out.push({ x: curr.x, y: curr.y });
      continue;
    }
    if (!n1 || !n2) {
      const nn = (n1 ?? n2)!;
      out.push({ x: curr.x + nn.x * dist, y: curr.y + nn.z * dist });
      continue;
    }
    const bx = n1.x + n2.x;
    const bz = n1.z + n2.z;
    const blen = Math.hypot(bx, bz);
    if (blen < 1e-8) {
      out.push({ x: curr.x + n2.x * dist, y: curr.y + n2.z * dist });
      continue;
    }
    const ux = bx / blen;
    const uz = bz / blen;
    const denom = n1.x * ux + n1.z * uz;
    if (denom < 1e-6) {
      out.push({ x: curr.x + n2.x * dist, y: curr.y + n2.z * dist });
      continue;
    }
    const along = Math.min(dist / denom, dist * WALL_SHELL_MITER_LIMIT);
    out.push({ x: curr.x + ux * along, y: curr.y + uz * along });
  }
  return out;
}

function pushVerticalQuad(
  positions: number[],
  normals: number[],
  ax: number,
  az: number,
  bx: number,
  bz: number,
  y0: number,
  y1: number,
  nx: number,
  nz: number
): void {
  // CCW when viewed from the front (normal toward the camera): bottom a → bottom b → top.
  positions.push(ax, y0, az, bx, y0, bz, bx, y1, bz);
  positions.push(ax, y0, az, bx, y1, bz, ax, y1, az);
  for (let k = 0; k < 6; k += 1) normals.push(nx, 0, nz);
}

/** Thin inward wall slab (not a zero-thickness plane) so adjacent rooms and inner/outer faces do not z-fight. */
export function createWallGeometry(room: RoomV2, elevationM: number): THREE.BufferGeometry | null {
  const ring = closedRing(room.polygon);
  if (ring.length < 3) return null;
  const h = Math.max(0.1, room.heightM);
  const y0 = elevationM;
  const y1 = elevationM + h;
  const ccw = signedPolygonArea(ring) >= 0;
  const outer = offsetRing(ring, WALL_SHELL_OUTER_INSET_M, ccw);
  const inner = offsetRing(ring, WALL_SHELL_INNER_INSET_M, ccw);
  const positions: number[] = [];
  const normals: number[] = [];
  const n = ring.length;
  for (let i = 0; i < n; i += 1) {
    const a = ring[i]!;
    const b = ring[(i + 1) % n]!;
    const inward = inwardEdgeNormal(a, b, ccw);
    if (!inward) continue;
    const oa = outer[i]!;
    const ob = outer[(i + 1) % n]!;
    const ia = inner[i]!;
    const ib = inner[(i + 1) % n]!;
    // Outer face: front points out of the room.
    pushVerticalQuad(
      positions,
      normals,
      oa.x,
      oa.y,
      ob.x,
      ob.y,
      y0,
      y1,
      -inward.x,
      -inward.z
    );
    // Inner face: front points into the room (walk the edge in reverse).
    pushVerticalQuad(
      positions,
      normals,
      ib.x,
      ib.y,
      ia.x,
      ia.y,
      y0,
      y1,
      inward.x,
      inward.z
    );
  }
  if (positions.length < 9) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  return geo;
}

export function createCeilingEdgeGeometry(room: RoomV2, elevationM: number): THREE.BufferGeometry | null {
  const poly = room.polygon;
  if (poly.length < 2) return null;
  const y = elevationM + Math.max(0.1, room.heightM);
  const positions: number[] = [];
  const n = poly.length;
  for (let i = 0; i < n; i += 1) {
    const a = poly[i]!;
    const b = poly[(i + 1) % n]!;
    positions.push(a.x, y, a.y, b.x, y, b.y);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geo;
}

export function housingColors(
  photo: PhotometricData | undefined,
  selected: boolean
): { housing: string; bezel: string; aperture: string } {
  if (selected) {
    return { housing: "#c45c26", bezel: "#e07038", aperture: "#f8e7b0" };
  }
  const body = luminaireBody(photo);
  if (body.housing === "black") {
    return { housing: "#2a2a2c", bezel: "#1a1a1c", aperture: "#f3e2b0" };
  }
  return { housing: "#d4d0c8", bezel: "#ece8e0", aperture: "#f3e2b0" };
}

/** Build a luminaire mesh sized from the IES luminous opening (same as LuminaireBodyMesh). */
export function createLuminaireMesh(photo: PhotometricData | undefined, selected = false): THREE.Group {
  const body = luminaireBody(photo);
  const c = housingColors(photo, selected);
  const group = new THREE.Group();
  const h = body.heightM;
  const bezelH = Math.min(0.005, h * 0.2);

  if (body.isCircular) {
    const r = (body.diameterM ?? body.widthM) / 2;
    const bezelR = r * 1.12;
    const apertureR = r * 0.68;
    const housing = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, h, 24),
      new THREE.MeshStandardMaterial({ color: c.housing, roughness: 0.55, metalness: 0.15 })
    );
    group.add(housing);
    const bezel = new THREE.Mesh(
      new THREE.CylinderGeometry(bezelR, bezelR, bezelH, 24),
      new THREE.MeshStandardMaterial({ color: c.bezel, roughness: 0.4, metalness: 0.08 })
    );
    bezel.position.y = -h / 2 + bezelH / 2;
    group.add(bezel);
    const aperture = new THREE.Mesh(
      new THREE.CircleGeometry(apertureR, 24),
      new THREE.MeshBasicMaterial({ color: c.aperture })
    );
    aperture.position.y = -h / 2 - 0.0008;
    aperture.rotation.x = -Math.PI / 2;
    group.add(aperture);
    return group;
  }

  const housing = new THREE.Mesh(
    new THREE.BoxGeometry(body.widthM, h, body.lengthM),
    new THREE.MeshStandardMaterial({ color: c.housing, roughness: 0.55, metalness: 0.12 })
  );
  group.add(housing);
  const aperture = new THREE.Mesh(
    new THREE.PlaneGeometry(body.widthM * 0.72, body.lengthM * 0.72),
    new THREE.MeshBasicMaterial({ color: c.aperture })
  );
  aperture.position.y = -h / 2 - 0.0008;
  aperture.rotation.x = -Math.PI / 2;
  group.add(aperture);
  return group;
}

export interface BuildBuildingSceneOpts {
  scene: ProjectSceneV2;
  results?: ResultsV2 | null;
  photometry?: Record<string, PhotometricData>;
  mode: Display3dMode;
  theme: "dark" | "light";
  storeyId?: string | null;
  highlightRoomId?: string | null;
  /** When set, only this room (and its fixtures) is drawn — used for per-room report views. */
  isolateRoomId?: string | null;
  /** When omitted in false-colour mode, the project-wide emin/emax is used. */
  falseColorScale?: FalseColorScale;
}


/** Reflect plan X about a vertical plane so a south look-down matches Top (east right, north up). */
export function mirrorPlanX(x: number, aboutX: number): number {
  return 2 * aboutX - x;
}

/** Root group that mirrors its children about plan X = mirrorX. Add meshes to `content`. */
export function createPlanHandednessRoot(mirrorX: number): { root: THREE.Group; content: THREE.Group } {
  const root = new THREE.Group();
  root.name = "planHandedness";
  root.position.set(mirrorX, 0, 0);
  const flip = new THREE.Group();
  flip.scale.set(-1, 1, 1);
  const content = new THREE.Group();
  content.position.set(-mirrorX, 0, 0);
  flip.add(content);
  root.add(flip);
  return { root, content };
}

/** A mirrored group reverses triangle winding; use clockwise front faces so FrontSide materials stay correct. */
export function setMirroredFrontFace(renderer: THREE.WebGLRenderer): void {
  const gl = renderer.getContext();
  gl.frontFace(gl.CW);
}

export function buildBuildingThreeScene(opts: BuildBuildingSceneOpts): {
  scene: THREE.Scene;
  content: THREE.Group;
  rooms: RoomV2[];
  elevationM: number;
  dispose: () => void;
} {
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(obj: T): T => {
    disposables.push(obj);
    return obj;
  };
  const threeScene = new THREE.Scene();
  const bg = opts.theme === "light" ? REPORT_BG : EDITOR_BG;
  threeScene.background = new THREE.Color(bg);

  const storeyId =
    opts.storeyId ?? opts.scene.ui.activeStoreyId ?? opts.scene.storeys[0]?.id;
  const storey = opts.scene.storeys.find((s) => s.id === storeyId);
  const elev = storey?.elevationM ?? 0;
  let rooms = opts.scene.rooms.filter((r) => r.storeyId === storeyId);
  if (opts.isolateRoomId) {
    rooms = rooms.filter((r) => r.id === opts.isolateRoomId);
  }
  const instances = opts.scene.instances.filter((i) => {
    if (i.storeyId !== storeyId) return false;
    if (opts.isolateRoomId) return i.roomId === opts.isolateRoomId;
    return true;
  });

  let minX = 0,
    maxX = 0,
    minY = 0,
    maxY = 0;
  if (rooms.length) {
    minX = Infinity;
    maxX = -Infinity;
    minY = Infinity;
    maxY = -Infinity;
    for (const r of rooms) {
      const b = roomBounds(r);
      minX = Math.min(minX, b.minX);
      maxX = Math.max(maxX, b.maxX);
      minY = Math.min(minY, b.minY);
      maxY = Math.max(maxY, b.maxY);
    }
  }
  const { root, content } = createPlanHandednessRoot(rooms.length ? (minX + maxX) / 2 : 0);
  threeScene.add(root);

  const amb = new THREE.AmbientLight(0xffffff, opts.theme === "light" ? 0.82 : 0.55);
  content.add(amb);
  const key = new THREE.DirectionalLight(0xffffff, opts.theme === "light" ? 0.7 : 0.85);
  key.position.set(22, 32, -14);
  content.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, opts.theme === "light" ? 0.28 : 0.22);
  fill.position.set(-18, 12, 16);
  content.add(fill);

  if (rooms.length) {
    const gw = Math.max(4, (maxX - minX) * 1.18);
    const gd = Math.max(4, (maxY - minY) * 1.18);
    const ground = new THREE.Mesh(
      track(new THREE.PlaneGeometry(gw, gd)),
      track(
        new THREE.MeshStandardMaterial({
          color: opts.theme === "light" ? "#e4e4e0" : "#15232c",
          roughness: 1,
          metalness: 0,
        })
      )
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set((minX + maxX) / 2, elev - 0.03, (minY + maxY) / 2);
    ground.receiveShadow = true;
    content.add(ground);
  }

  const floorMat = track(
    new THREE.MeshStandardMaterial({
      color: FLOOR_COLOR,
      roughness: 0.92,
      metalness: 0.02,
      side: THREE.DoubleSide,
    })
  );
  const ceilMeshMat = track(
    new THREE.MeshStandardMaterial({
      color: CEILING_COLOR,
      roughness: 0.9,
      metalness: 0.02,
      side: THREE.FrontSide,
    })
  );
  const shellOpacity = wallShellOpacity(opts.mode);
  const wallMat = track(
    new THREE.MeshStandardMaterial({
      color: WALL_COLOR,
      roughness: 0.88,
      metalness: 0.04,
      transparent: shellOpacity < 0.999,
      opacity: shellOpacity,
      side: THREE.FrontSide,
      // Inner and outer slab faces are separate, so FrontSide is enough.
      // Inward false-colour meshes stay just inside the inner face.
      depthWrite: true,
    })
  );
  const wallMatActive = track(
    new THREE.MeshStandardMaterial({
      color: WALL_COLOR_ACTIVE,
      roughness: 0.88,
      metalness: 0.04,
      transparent: shellOpacity < 0.999,
      opacity: shellOpacity,
      side: THREE.FrontSide,
      depthWrite: true,
    })
  );
  const edgeMat = track(new THREE.LineBasicMaterial({ color: EDGE_COLOR }));
  const edgeMatActive = track(new THREE.LineBasicMaterial({ color: EDGE_COLOR_ACTIVE }));
  const workMat = track(
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      depthWrite: true,
      toneMapped: false,
    })
  );
  // FrontSide faces into the room (inward normals). The outside of the wall
  // stays the uncoloured shell — no light is emitted outdoors.
  const wallFalseColorMat = track(
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.FrontSide,
      depthWrite: true,
      toneMapped: false,
    })
  );

  for (const room of rooms) {
    const active = opts.highlightRoomId != null && room.id === opts.highlightRoomId;
    const floor = createFloorGeometry(room, elev);
    if (floor) {
      track(floor);
      content.add(new THREE.Mesh(floor, floorMat));
      const floorEdges = new THREE.LineSegments(track(new THREE.EdgesGeometry(floor)), active ? edgeMatActive : edgeMat);
      content.add(floorEdges);
    }
    const walls = createWallGeometry(room, elev);
    if (walls) {
      track(walls);
      content.add(new THREE.Mesh(walls, active ? wallMatActive : wallMat));
      const wallEdges = new THREE.LineSegments(track(new THREE.EdgesGeometry(walls, 20)), active ? edgeMatActive : edgeMat);
      content.add(wallEdges);
    }
    const ceiling = createCeilingGeometry(room, elev);
    if (ceiling) {
      track(ceiling);
      content.add(new THREE.Mesh(ceiling, ceilMeshMat));
      content.add(new THREE.LineSegments(track(new THREE.EdgesGeometry(ceiling)), active ? edgeMatActive : edgeMat));
    }

    if (opts.mode === "falsecolor") {
      const scale = opts.falseColorScale ?? OFFICIAL_FALSE_COLOR_SCALE;
      const res = opts.results?.byRoomId[room.id];
      if (res) {
        const official = createOfficialFalseColorWorkplane(room, res, elev, scale);
        if (official) {
          track(official.geometry);
          track(official.material);
          track(official.texture);
          content.add(new THREE.Mesh(official.geometry, official.material));
        } else {
          const wp = createClippedWorkplaneGeometry(room, res, elev, scale);
          if (wp) {
            track(wp);
            content.add(new THREE.Mesh(wp, workMat));
          }
        }
      }
      const wallSurfaces = opts.results?.wallsByRoomId?.[room.id] ?? [];
      for (const surface of wallSurfaces) {
        const wg = createWallFalseColorGeometry(surface, elev, WALL_FALSE_COLOR_INSET_M, scale);
        if (wg) {
          track(wg);
          content.add(new THREE.Mesh(wg, wallFalseColorMat));
        }
      }
    }
  }

  for (const lum of instances) {
    const mesh = createLuminaireMesh(opts.photometry?.[lum.luminaireId], false);
    mesh.position.set(lum.position.x, elev + lum.position.z, lum.position.y);
    mesh.rotation.y = (-lum.rotationDeg * Math.PI) / 180;
    mesh.traverse((obj) => {
      const meshObj = obj as THREE.Mesh;
      if (meshObj.geometry) track(meshObj.geometry);
      const mat = meshObj.material;
      if (Array.isArray(mat)) mat.forEach((m) => track(m));
      else if (mat) track(mat);
    });
    content.add(mesh);
  }

  return {
    scene: threeScene,
    content,
    rooms,
    elevationM: elev,
    dispose: () => {
      for (const d of disposables) {
        try {
          d.dispose();
        } catch {
          /* ignore */
        }
      }
    },
  };
}
