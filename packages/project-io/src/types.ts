import type { PhotometricData } from "../../photometry/src/types";
import type { CalcResults, RoomSpec } from "../../solver/src/types";

/** @deprecated v1 — use ProjectSceneV2 */
export interface SceneLuminaire {
  instanceId: string;
  luminaireId: string;
  name: string;
  position: { x: number; y: number; z: number };
  rotationDeg: number;
}

/** @deprecated v1 — use ProjectSceneV2 */
export interface SceneJson {
  version: 1;
  room: RoomSpec;
  gridSpacing: number;
  luminaires: SceneLuminaire[];
  calcOptions: {
    interreflection: boolean;
    bounces: number;
    computeUgr: boolean;
  };
}

export type ViewMode = "top" | "bottom" | "front" | "side" | "persp3d";

/** In-app / report 3D presentation: clean architecture vs illuminance overlay. */
export type Display3dMode = "greyscale" | "falsecolor";

/** Three.js orbit camera pose (y-up) for persp3d restore */
export interface Camera3dView {
  position: [number, number, number];
  target: [number, number, number];
  /** Optional camera up. Report overviews use plan-north [0,0,1] so +X is right. */
  up?: [number, number, number];
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface Storey {
  id: string;
  name: string;
  elevationM: number;
  heightM: number;
}

export interface RoomV2 {
  id: string;
  storeyId: string;
  name: string;
  polygon: Vec2[];
  heightM: number;
  workplaneHeightM: number;
  reflectance: { floor: number; ceiling: number; walls: number };
  calc: {
    gridSpacing: number;
    interreflection: boolean;
    bounces: number;
    computeUgr: boolean;
  };
}

export interface Underlay {
  id: string;
  storeyId: string;
  assetId: string;
  kind: "image" | "pdf" | "dxf" | "ifc";
  opacity: number;
  /**
   * Uniform meters per source pixel (same for X and Y).
   * World size = sourceWidthPx × metersPerUnit by sourceHeightPx × metersPerUnit.
   */
  metersPerUnit: number;
  offsetX: number;
  offsetY: number;
  rotationDeg: number;
  /** Native pixel width of the imported image (required for correct aspect). */
  sourceWidthPx?: number;
  /** Native pixel height of the imported image (required for correct aspect). */
  sourceHeightPx?: number;
  /** Mirror plan image on X (Top + 3D). */
  flipX?: boolean;
  /** Mirror plan image on Y (Top + 3D) — use for bottom-view → look-down. */
  flipY?: boolean;
  /** Internal: orientation defaults applied / legacy handedness undo done. */
  orientationMigrated?: boolean;
  /** DXF entities cached for render */
  dxfEntities?: DxfEntity[];
}

export interface DxfEntity {
  type: "line" | "polyline";
  points: Vec2[];
}

export interface FixtureInstance {
  instanceId: string;
  luminaireId: string;
  storeyId: string;
  roomId: string | null;
  name: string;
  position: { x: number; y: number; z: number };
  rotationDeg: number;
}

export interface ProjectSceneV2 {
  version: 2;
  storeys: Storey[];
  rooms: RoomV2[];
  underlays: Underlay[];
  fixtureLibraryIds: string[];
  instances: FixtureInstance[];
  ui: {
    activeStoreyId: string;
    activeRoomId: string | null;
    viewMode: ViewMode;
    tool: "select" | "drawRoom" | "calibrate";
    /** Last 3D orbit pose; restored when opening / switching back to 3D */
    camera3d?: Camera3dView | null;
    /** Greyscale architecture vs false-colour workplanes in the 3D view. */
    display3d?: Display3dMode;
  };
}

/** Vertical (wall) calculation surface — stored beside, not instead of, the workplane. */
export interface WallSurfaceGrid {
  originU: number;
  originV: number;
  spacing: number;
  nu: number;
  nv: number;
  /** Row-major lux, nv rows of nu samples. */
  lux: number[];
}

export interface WallSurfaceResult {
  id: string;
  roomId: string;
  name: string;
  /** Plan polyline of the wall (world XY), at least two points. */
  polyline: Vec2[];
  /** Inward unit normal for each segment of the polyline. */
  normals: Vec2[];
  heightM: number;
  insetM: number;
  /** Representative inward horizontal normal. */
  normal: Vec2;
  /** Unrolled length of the polyline (m). */
  widthM: number;
  curved: boolean;
  grid: WallSurfaceGrid;
  summary: {
    eave: number;
    emin: number;
    emax: number;
    uo: number;
    areaM2: number;
  };
}

export interface ResultsV2 {
  version: 2;
  byRoomId: Record<string, CalcResults>;
  /** Wall calculation surfaces keyed by roomId. Absent on older projects. */
  wallsByRoomId?: Record<string, WallSurfaceResult[]>;
}

export type AnyScene = SceneJson | ProjectSceneV2;

export interface LuxsimProjectFile {
  format: "luxsim";
  version: 1 | 2;
  name: string;
  scene: AnyScene;
  results: CalcResults | ResultsV2 | null;
  photometry: Record<string, PhotometricData>;
  sourceFiles?: Record<string, { filename: string; text: string }>;
}
