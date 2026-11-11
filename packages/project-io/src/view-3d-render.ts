import type { jsPDF } from "jspdf";
import type { FixtureInstance, ProjectSceneV2, RoomV2 } from "./types";
import { roomBounds } from "./geometry";
import type { PlanDrawBox } from "./plan-render";

type Vec3 = { x: number; y: number; z: number };

/** LUXSIM world → Three.js-style axes (Y up). */
function toYUp(p: Vec3): Vec3 {
  return { x: p.x, y: p.z, z: p.y };
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function len(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

function normalize(v: Vec3): Vec3 {
  const l = len(v);
  if (l < 1e-9) return { x: 0, y: 1, z: 0 };
  return scale(v, 1 / l);
}

export interface CameraPreset {
  position: Vec3;
  target: Vec3;
}

export function cameraForRooms(rooms: RoomV2[], elevationM: number): CameraPreset {
  if (!rooms.length) {
    return {
      position: toYUp({ x: 12, y: 12, z: elevationM + 8 }),
      target: toYUp({ x: 4, y: 3, z: elevationM + 1.4 }),
    };
  }
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity,
    maxH = 2.8;
  for (const r of rooms) {
    const b = roomBounds(r);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
    maxH = Math.max(maxH, r.heightM);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const span = Math.max(maxX - minX, maxY - minY, 4);
  const cz = elevationM + maxH * 0.35;
  const dist = span * 1.35;
  return {
    target: toYUp({ x: cx, y: cy, z: cz }),
    position: toYUp({ x: cx + dist, y: cy + dist * 0.85, z: cz + dist * 0.65 }),
  };
}

export function projectPoint(
  world: Vec3,
  camera: CameraPreset,
  box: PlanDrawBox,
  fovDeg = 42
): { x: number; y: number; depth: number } {
  const forward = normalize(sub(camera.target, camera.position));
  const worldUp = { x: 0, y: 1, z: 0 };
  let right = normalize(cross(forward, worldUp));
  if (len(right) < 1e-6) right = { x: 1, y: 0, z: 0 };
  const up = normalize(cross(right, forward));

  const p = sub(toYUp(world), camera.position);
  const xc = dot(p, right);
  const yc = dot(p, up);
  const zc = dot(p, forward);
  if (zc < 0.05) return { x: box.x, y: box.y, depth: -1e6 };

  const f = 1 / Math.tan((fovDeg * Math.PI) / 360);
  const ndcX = (xc / zc) * f;
  const ndcY = (yc / zc) * f;

  const pad = 5;
  const innerW = box.w - pad * 2;
  const innerH = box.h - pad * 2;
  const x = box.x + pad + innerW * (0.5 + ndcX * 0.42);
  const y = box.y + pad + innerH * (0.52 - ndcY * 0.42);
  return { x, y, depth: zc };
}

interface Face {
  pts: Vec3[];
  depth: number;
  kind: "floor" | "wall" | "ceiling";
}

function roomFaces(room: RoomV2, elevationM: number): Face[] {
  const poly = room.polygon;
  if (poly.length < 3) return [];
  const z0 = elevationM;
  const z1 = elevationM + room.heightM;
  const floor: Vec3[] = poly.map((p) => ({ x: p.x, y: p.y, z: z0 }));
  const ceiling: Vec3[] = poly.map((p) => ({ x: p.x, y: p.y, z: z1 }));
  const faces: Face[] = [];

  const avgZ = (pts: Vec3[]) => pts.reduce((s, p) => s + p.z, 0) / pts.length;
  faces.push({ pts: floor, depth: avgZ(floor), kind: "floor" });
  faces.push({ pts: ceiling, depth: avgZ(ceiling), kind: "ceiling" });

  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const wall = [
      { x: a.x, y: a.y, z: z0 },
      { x: b.x, y: b.y, z: z0 },
      { x: b.x, y: b.y, z: z1 },
      { x: a.x, y: a.y, z: z1 },
    ];
    faces.push({ pts: wall, depth: avgZ(wall), kind: "wall" });
  }
  return faces;
}

function drawProjectedFace(
  doc: jsPDF,
  face: Face,
  camera: CameraPreset,
  box: PlanDrawBox,
  active: boolean
): void {
  const projected = face.pts.map((p) => projectPoint(p, camera, box));
  if (projected.some((p) => p.depth < 0)) return;

  const fill =
    face.kind === "floor"
      ? active
        ? [210, 225, 235]
        : [225, 232, 238]
      : face.kind === "ceiling"
        ? [248, 250, 252]
        : active
          ? [180, 205, 220]
          : [200, 215, 228];

  doc.setFillColor(fill[0]!, fill[1]!, fill[2]!);
  doc.setDrawColor(active ? 50 : 90, active ? 110 : 130, 150);
  doc.setLineWidth(0.25);

  if (projected.length < 3) return;
  const p0 = projected[0]!;
  for (let i = 1; i < projected.length - 1; i += 1) {
    const p1 = projected[i]!;
    const p2 = projected[i + 1]!;
    doc.triangle(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, "F");
  }
  for (let i = 0; i < projected.length; i += 1) {
    const a = projected[i]!;
    const b = projected[(i + 1) % projected.length]!;
    doc.line(a.x, a.y, b.x, b.y);
  }
}

function drawFixtures3d(
  doc: jsPDF,
  instances: FixtureInstance[],
  elevationM: number,
  camera: CameraPreset,
  box: PlanDrawBox
): void {
  doc.setFillColor(232, 194, 122);
  doc.setDrawColor(80, 60, 30);
  for (const inst of instances) {
    const base = {
      x: inst.position.x,
      y: inst.position.y,
      z: elevationM + inst.position.z - 0.06,
    };
    const top = { ...base, z: base.z + 0.12 };
    const b = projectPoint(base, camera, box);
    const t = projectPoint(top, camera, box);
    if (b.depth < 0 || t.depth < 0) continue;
    const r = Math.max(0.4, Math.abs(t.y - b.y));
    doc.circle(b.x, b.y - r / 2, r, "FD");
  }
}

export function drawRoomsPerspective3dOnPdf(
  doc: jsPDF,
  rooms: RoomV2[],
  instances: FixtureInstance[],
  elevationM: number,
  box: PlanDrawBox,
  highlightRoomId?: string | null
): void {
  if (!rooms.length) return;
  const camera = cameraForRooms(rooms, elevationM);
  const faces = rooms
    .flatMap((r) =>
      roomFaces(r, elevationM).map((f) => ({ face: f, roomId: r.id }))
    )
    .sort((a, b) => a.face.depth - b.face.depth);

  for (const f of faces) {
    drawProjectedFace(doc, f.face, camera, box, f.roomId === highlightRoomId);
  }

  const roomIds = new Set(rooms.map((r) => r.id));
  const scoped = instances.filter((i) => i.roomId && roomIds.has(i.roomId));
  drawFixtures3d(doc, scoped, elevationM, camera, box);
}

export function drawStoreyPerspective3dOnPdf(
  doc: jsPDF,
  scene: ProjectSceneV2,
  storeyId: string,
  box: PlanDrawBox
): void {
  const storey = scene.storeys.find((s) => s.id === storeyId);
  const elev = storey?.elevationM ?? 0;
  const rooms = scene.rooms.filter((r) => r.storeyId === storeyId);
  const instances = scene.instances.filter((i) => i.storeyId === storeyId);
  drawRoomsPerspective3dOnPdf(doc, rooms, instances, elev, box, scene.ui.activeRoomId);
}

export function drawRoomPerspective3dOnPdf(
  doc: jsPDF,
  scene: ProjectSceneV2,
  room: RoomV2,
  box: PlanDrawBox
): void {
  const storey = scene.storeys.find((s) => s.id === room.storeyId);
  const elev = storey?.elevationM ?? 0;
  const instances = scene.instances.filter((i) => i.roomId === room.id);
  drawRoomsPerspective3dOnPdf(doc, [room], instances, elev, box, room.id);
}

/** True when PDF was built with 3D illustration markers (for tests). */
export function pdfIncludes3dDrawingMarkers(pdfLatin1: string): boolean {
  return pdfLatin1.includes("3D perspective") && /Plan.*fixtures/i.test(pdfLatin1);
}

/** Heuristic: PDF stream contains embedded raster images (WebGL snapshots). */
export function pdfIncludesEmbeddedImages(pdfLatin1: string): boolean {
  return pdfLatin1.includes("/Subtype") && pdfLatin1.includes("/Image");
}
