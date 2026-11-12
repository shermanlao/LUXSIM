/**
 * Shared Three.js scene construction for the in-app 3D viewer and report captures.
 * Rooms have a floor, walls, and a downward-facing ceiling so the underside is
 * visible from inside the room. Report cameras looking down still see into the space.
 * False-colour workplanes are clipped to the room polygon.
 */
import * as THREE from "three";
import type { PhotometricData } from "@luxsim/photometry";
import { luminaireBody } from "@luxsim/photometry";
import type { CalcResults } from "@luxsim/solver";
import {
  luxToRgb,
  pointInPolygon,
  roomBounds,
  locateOnPolyline,
  sampleWallLux,
  type Display3dMode,
  type ProjectSceneV2,
  type ResultsV2,
  type RoomV2,
  type WallSurfaceResult,
} from "@luxsim/project-io";

export const EDITOR_BG = "#0f1c24";
export const REPORT_BG = "#f3f3f0";

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

/** Clipped workplane in Three.js world space (y-up). Vertex-coloured with the project-wide lux scale. */
export function createClippedWorkplaneGeometry(
  room: RoomV2,
  results: CalcResults,
  elevationM: number
): THREE.BufferGeometry | null {
  const shape = shapeFromPolygon(room.polygon);
  if (!shape) return null;
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  const z = elevationM + (results.grid.z ?? room.workplaneHeightM) + 0.02;
  geo.translate(0, z, 0);
  const pos = geo.getAttribute("position");
  if (!pos) {
    geo.dispose();
    return null;
  }
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 1) {
    const wx = pos.getX(i);
    const wy = pos.getZ(i);
    const lux = sampleGridLux(room, results.grid, wx, wy);
    const [r, g, b] = luxToRgb(lux);
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}


/** False-colour mesh for a vertical wall surface, following the wall polyline (not a bounding box). */
export function createWallFalseColorGeometry(
  surface: WallSurfaceResult,
  elevationM: number,
  inwardOffset = 0.02
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
      const [cr, cg, cb] = luxToRgb(sampleWallLux(surface, u, v));
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

export function createWallGeometry(room: RoomV2, elevationM: number): THREE.BufferGeometry | null {
  const poly = room.polygon;
  if (poly.length < 2) return null;
  const h = Math.max(0.1, room.heightM);
  const positions: number[] = [];
  const normals: number[] = [];
  const n = poly.length;
  for (let i = 0; i < n; i += 1) {
    const a = poly[i]!;
    const b = poly[(i + 1) % n]!;
    const y0 = elevationM;
    const y1 = elevationM + h;
    // Two triangles in Three.js (x, y-up, z=worldY)
    const ax = a.x,
      az = a.y,
      bx = b.x,
      bz = b.y;
    positions.push(ax, y0, az, bx, y0, bz, bx, y1, bz);
    positions.push(ax, y0, az, bx, y1, bz, ax, y1, az);
    const nx = az - bz;
    const nz = bx - ax;
    const len = Math.hypot(nx, nz) || 1;
    const nnx = nx / len;
    const nnz = nz / len;
    for (let k = 0; k < 6; k += 1) normals.push(nnx, 0, nnz);
  }
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
}

export function buildBuildingThreeScene(opts: BuildBuildingSceneOpts): {
  scene: THREE.Scene;
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

  const amb = new THREE.AmbientLight(0xffffff, opts.theme === "light" ? 0.82 : 0.55);
  threeScene.add(amb);
  const key = new THREE.DirectionalLight(0xffffff, opts.theme === "light" ? 0.7 : 0.85);
  key.position.set(22, 32, -14);
  threeScene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, opts.theme === "light" ? 0.28 : 0.22);
  fill.position.set(-18, 12, 16);
  threeScene.add(fill);

  if (rooms.length) {
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const r of rooms) {
      const b = roomBounds(r);
      minX = Math.min(minX, b.minX);
      maxX = Math.max(maxX, b.maxX);
      minY = Math.min(minY, b.minY);
      maxY = Math.max(maxY, b.maxY);
    }
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
    threeScene.add(ground);
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
  const wallShellOpacity = opts.mode === "falsecolor" ? 0.22 : 0.82;
  const wallMat = track(
    new THREE.MeshStandardMaterial({
      color: WALL_COLOR,
      roughness: 0.88,
      metalness: 0.04,
      transparent: true,
      opacity: wallShellOpacity,
      side: THREE.DoubleSide,
      // In false-colour mode the calc surfaces sit just inside the shell;
      // keep depthWrite off so exterior report cameras can see them.
      depthWrite: opts.mode !== "falsecolor",
    })
  );
  const wallMatActive = track(
    new THREE.MeshStandardMaterial({
      color: WALL_COLOR_ACTIVE,
      roughness: 0.88,
      metalness: 0.04,
      transparent: true,
      opacity: opts.mode === "falsecolor" ? 0.28 : 0.86,
      side: THREE.DoubleSide,
      depthWrite: opts.mode !== "falsecolor",
    })
  );
  const edgeMat = track(new THREE.LineBasicMaterial({ color: EDGE_COLOR }));
  const edgeMatActive = track(new THREE.LineBasicMaterial({ color: EDGE_COLOR_ACTIVE }));
  const workMat = track(
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );

  for (const room of rooms) {
    const active = opts.highlightRoomId != null && room.id === opts.highlightRoomId;
    const floor = createFloorGeometry(room, elev);
    if (floor) {
      track(floor);
      threeScene.add(new THREE.Mesh(floor, floorMat));
      const floorEdges = new THREE.LineSegments(track(new THREE.EdgesGeometry(floor)), active ? edgeMatActive : edgeMat);
      threeScene.add(floorEdges);
    }
    const walls = createWallGeometry(room, elev);
    if (walls) {
      track(walls);
      threeScene.add(new THREE.Mesh(walls, active ? wallMatActive : wallMat));
      const wallEdges = new THREE.LineSegments(track(new THREE.EdgesGeometry(walls, 20)), active ? edgeMatActive : edgeMat);
      threeScene.add(wallEdges);
    }
    const ceiling = createCeilingGeometry(room, elev);
    if (ceiling) {
      track(ceiling);
      threeScene.add(new THREE.Mesh(ceiling, ceilMeshMat));
      threeScene.add(new THREE.LineSegments(track(new THREE.EdgesGeometry(ceiling)), active ? edgeMatActive : edgeMat));
    }

    if (opts.mode === "falsecolor") {
      const res = opts.results?.byRoomId[room.id];
      if (res) {
        const wp = createClippedWorkplaneGeometry(room, res, elev);
        if (wp) {
          track(wp);
          threeScene.add(new THREE.Mesh(wp, workMat));
        }
      }
      const wallSurfaces = opts.results?.wallsByRoomId?.[room.id] ?? [];
      for (const surface of wallSurfaces) {
        const wg = createWallFalseColorGeometry(surface, elev);
        if (wg) {
          track(wg);
          threeScene.add(new THREE.Mesh(wg, workMat));
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
    threeScene.add(mesh);
  }

  return {
    scene: threeScene,
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
