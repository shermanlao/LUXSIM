import type { Camera3dView, Display3dMode, ProjectSceneV2, ResultsV2, RoomV2 } from "./types";
import { roomBounds } from "./geometry";

export function defaultDisplay3d(
  results?: ResultsV2 | null,
  stored?: Display3dMode | null
): Display3dMode {
  if (stored === "greyscale" || stored === "falsecolor") return stored;
  if (results && Object.keys(results.byRoomId).length > 0) return "falsecolor";
  return "greyscale";
}

export function projectLuxRange(results: ResultsV2): { emin: number; emax: number } {
  let emin = Infinity;
  let emax = -Infinity;
  for (const res of Object.values(results.byRoomId)) {
    if (!res) continue;
    emin = Math.min(emin, res.summary.emin);
    emax = Math.max(emax, res.summary.emax);
  }
  if (!Number.isFinite(emin) || !Number.isFinite(emax)) {
    return { emin: 56, emax: 500 };
  }
  return { emin, emax };
}

export function storeyRooms(scene: ProjectSceneV2, storeyId?: string | null): RoomV2[] {
  const id = storeyId ?? scene.ui.activeStoreyId ?? scene.storeys[0]?.id;
  return scene.rooms.filter((r) => r.storeyId === id);
}

export function unionWorldBounds(
  rooms: RoomV2[],
  elevationM = 0
): { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number } | null {
  if (!rooms.length) return null;
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity,
    maxZ = elevationM;
  for (const r of rooms) {
    const b = roomBounds(r);
    minX = Math.min(minX, b.minX);
    maxX = Math.max(maxX, b.maxX);
    minY = Math.min(minY, b.minY);
    maxY = Math.max(maxY, b.maxY);
    maxZ = Math.max(maxZ, elevationM + r.heightM);
  }
  return { minX, maxX, minY, maxY, minZ: elevationM, maxZ };
}

/**
 * Perspective camera that frames the given plan bounds so that high world-Y
 * (top of the Lighting Plan) appears toward the top of the image.
 * Three.js coords: (x, z-up, y-plan) via position [x, z, y].
 */
export function fitCameraToBounds(
  bounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number },
  opts?: { fovDeg?: number; pad?: number }
): Camera3dView {
  const fovDeg = opts?.fovDeg ?? 45;
  const pad = opts?.pad ?? 0.92;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const width = Math.max(0.5, bounds.maxX - bounds.minX);
  const depth = Math.max(0.5, bounds.maxY - bounds.minY);
  const height = Math.max(0.5, bounds.maxZ - bounds.minZ);
  const radius = Math.hypot(width, depth, height) / 2;
  const fov = (fovDeg * Math.PI) / 180;
  const dist = (radius / Math.sin(fov / 2)) * pad;
  // High oblique from the south. camera.up is plan-north so the still matches
  // the Lighting Plan: +Y toward the top of the image, +X to the right.
  const south = dist * 0.42;
  const lift = dist * 0.92;
  const east = dist * 0.12;
  const position: [number, number, number] = [cx + east, bounds.minZ + lift, cy - south];
  const target: [number, number, number] = [cx, bounds.minZ + height * 0.08, cy];
  const up: [number, number, number] = [0, 0, 1];
  return { position, target, up };
}

export function fitOverviewCamera(scene: ProjectSceneV2, storeyId?: string | null): Camera3dView {
  const id = storeyId ?? scene.ui.activeStoreyId ?? scene.storeys[0]?.id;
  const storey = scene.storeys.find((s) => s.id === id);
  const rooms = storeyRooms(scene, id);
  const elev = storey?.elevationM ?? 0;
  const bounds = unionWorldBounds(rooms, elev) ?? {
    minX: 0,
    maxX: 8,
    minY: 0,
    maxY: 6,
    minZ: elev,
    maxZ: elev + (storey?.heightM ?? 3),
  };
  return fitCameraToBounds(bounds);
}

export function fitRoomCamera(room: RoomV2, elevationM = 0): Camera3dView {
  const b = roomBounds(room);
  return fitCameraToBounds({
    minX: b.minX,
    maxX: b.maxX,
    minY: b.minY,
    maxY: b.maxY,
    minZ: elevationM,
    maxZ: elevationM + room.heightM,
  });
}

export function storeyCenter(
  scene: ProjectSceneV2,
  storeyId?: string | null
): { x: number; y: number; z: number } {
  const id = storeyId ?? scene.ui.activeStoreyId ?? scene.storeys[0]?.id;
  const storey = scene.storeys.find((s) => s.id === id);
  const elev = storey?.elevationM ?? 0;
  const rooms = storeyRooms(scene, id);
  if (rooms.length) {
    let sx = 0,
      sy = 0,
      n = 0;
    for (const r of rooms) {
      const b = roomBounds(r);
      sx += (b.minX + b.maxX) / 2;
      sy += (b.minY + b.maxY) / 2;
      n += 1;
    }
    return { x: sx / n, y: sy / n, z: elev + (storey?.heightM ?? 3) * 0.4 };
  }
  return { x: 4, y: 3, z: elev + 1.4 };
}

/**
 * The original editor default looked from the north-east (+X/+Y), which rotated
 * the floor plate relative to Top view and the Lighting Plan.
 */
export function isLegacyNortheastOrbit(
  view: Camera3dView,
  center: { x: number; y: number; z: number },
  epsilon = 0.08
): boolean {
  const [x, y, z] = view.position;
  return (
    Math.abs(x - (center.x + 8)) <= epsilon &&
    Math.abs(y - (center.z + 6)) <= epsilon &&
    Math.abs(z - (center.y + 8)) <= epsilon
  );
}

/** Plan-aligned editor start: from the south, slightly east, world-up for orbit. */
export function editorOverviewCamera(scene: ProjectSceneV2, storeyId?: string | null): Camera3dView {
  const view = fitOverviewCamera(scene, storeyId);
  return { position: view.position, target: view.target };
}

/** Plan-aligned room framing for the editor (world-up, from the south). */
export function editorRoomCamera(room: RoomV2, elevationM = 0): Camera3dView {
  const view = fitRoomCamera(room, elevationM);
  return { position: view.position, target: view.target };
}

/**
 * A camera on or north of its target looks south, so the plan appears
 * upside-down versus Top view (north at the bottom of the frame).
 */
export function isInvertedPlanOrbit(view: Camera3dView): boolean {
  return view.position[2] >= view.target[2];
}

export function resolveEditorCamera(
  stored: Camera3dView | null | undefined,
  scene: ProjectSceneV2,
  storeyId?: string | null
): Camera3dView {
  const fallback = editorOverviewCamera(scene, storeyId);
  if (!stored) return fallback;
  if (isLegacyNortheastOrbit(stored, storeyCenter(scene, storeyId))) return fallback;
  if (isInvertedPlanOrbit(stored)) return fallback;
  return stored;
}
