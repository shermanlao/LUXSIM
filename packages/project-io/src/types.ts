import type { PhotometricData } from "../../photometry/src/types";
import type { CalcResults, RoomSpec } from "../../solver/src/types";
export type { CalcResults };
import type { EditorWorkflowMode } from "./editor-workflow";
import type { MfBreakdown } from "./maintenance-factor";

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

export type { EditorWorkflowMode } from "./editor-workflow";

/** In-app / report 3D presentation: clean architecture, false-colour, or isolines. */
export type Display3dMode = "greyscale" | "falsecolor" | "isolines";

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
  /**
   * Optional official floor-plate outline on this storey (simple polygon,
   * no holes). Same validity rules as official rooms. This is not a room:
   * it is not listed in the room tree, luminaire schedule, or calculation.
   * Absent on legacy storeys.
   */
  outline?: Vec2[];
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
    /** Maintenance factor for maintained illuminance checks (0.5–1). Default 0.8. */
    maintenanceFactor?: number;
    /** EN 12464-1 assist template id; see en12464.ts */
    en12464TemplateId?: string;
    /** CIE 97-style MF components (product overrides overall MF when set) */
    mfBreakdown?: Partial<MfBreakdown>;
  };
}

export interface Underlay {
  id: string;
  storeyId: string;
  assetId: string;
  kind: "image" | "pdf" | "dxf" | "ifc" | "dwg";
  opacity: number;
  /**
   * Uniform metres per source unit on both axes (metres per pixel for a raster;
   * metres per drawing unit for a DXF). Raster world size = sourceWidthPx ×
   * metersPerUnit by sourceHeightPx × metersPerUnit. For a new image/PDF this
   * is a preview scale until `scaleCalibrated` is true. A new DXF starts at 1
   * (entities already in metres); official Calibrate scale updates this value
   * and DXF strokes, object snap, and plan bounds use entity × metersPerUnit
   * plus the underlay origin offset.
   */
  metersPerUnit: number;
  /**
   * False until the user calibrates scale on a raster/PDF underlay.
   * DXF and a converted DWG are stored as true. An unconverted DWG is false.
   * When omitted (legacy scenes), an image/PDF still at the default preview span
   * is treated as uncalibrated.
   */
  scaleCalibrated?: boolean;
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
  /**
   * Compressed visible CAD linework used for Top-view display and object snap.
   * Hidden layers are omitted. The full uncompressed source stays on the
   * project asset (`meta.entities`) so a later layer Apply can restore a layer.
   */
  dxfEntities?: DxfEntity[];
  /**
   * Layer names hidden after the last official Apply. Omitted or empty means
   * all layers are visible. Re-importing a plan clears this and shows every
   * layer from the new file.
   */
  hiddenLayers?: string[];
  /** LAYER table entries from the source file, when present. */
  dxfLayers?: OfficialDxfLayer[];
  /** PDF source page (0-based) used for raster underlay */
  pageIndex?: number;
  /** Derived PNG/WebP asset for Top/3D display */
  pageRasterAssetId?: string;
  /** DPI used when rasterizing the current page */
  rasterDpi?: number;
  /** Total pages in linked PDF asset */
  pdfPageCount?: number;
}

export interface OfficialDxfLayer {
  name: string;
  /** False when the file had the layer turned off (group 62 color negative). */
  on: boolean;
  /** True when the file had the layer frozen (group 70 bit 0). */
  frozen: boolean;
}

export interface DxfEntity {
  type: "line" | "polyline";
  points: Vec2[];
  /**
   * Closed flag from LWPOLYLINE / old POLYLINE (group 70 bit 1), a CIRCLE,
   * a full ELLIPSE, a closed or periodic SPLINE, or a full-turn ARC, or first
   * and last vertices coincide.
   * Omitted on open LINE, ARC, open ELLIPSE, open SPLINE, and open polyline entities.
   */
  closed?: boolean;
  /**
   * DXF group 8 layer name. Omitted or empty is treated as layer "0".
   */
  layer?: string;
}

export interface FixtureInstance {
  instanceId: string;
  luminaireId: string;
  storeyId: string;
  roomId: string | null;
  name: string;
  position: { x: number; y: number; z: number };
  rotationDeg: number;
  /** Present when placed via RCP detect commit (F2.4). */
  rcpProposalId?: string;
}

/** RCP / schedule fixture code → org luminaire (exact/alias only; stored on project scene). */
export interface FixtureCodeMapRule {
  id: string;
  /** Normalized primary code (see normalizeFixtureCode in app lib). */
  codeNorm: string;
  aliases: string[];
  luminaireId: string;
  match: "exact" | "alias";
  active: boolean;
}

/** OCR / vision proposal — not a placed fixture until F2.4 commit. */
export type RcpProposalStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "edited"
  | "committed";

export interface RcpDetectionProposal {
  id: string;
  underlayId?: string;
  codeRaw: string;
  codeNorm?: string;
  bboxPx?: { x0: number; y0: number; x1: number; y1: number };
  pointPx?: { x: number; y: number };
  pointM?: { x: number; y: number };
  confidence: number;
  status: RcpProposalStatus;
}

export interface ProjectSceneV2 {
  version: 2;
  storeys: Storey[];
  rooms: RoomV2[];
  underlays: Underlay[];
  fixtureLibraryIds: string[];
  instances: FixtureInstance[];
  /** Fixture code map rules for RCP/schedule import pipelines (project-scoped). */
  fixtureCodeMap?: FixtureCodeMapRule[];
  /** Pending RCP code detections from plan OCR (F2.2). */
  rcpProposals?: RcpDetectionProposal[];
  ui: {
    activeStoreyId: string;
    activeRoomId: string | null;
    viewMode: ViewMode;
    tool: "select" | "drawRoom" | "drawStoreyContour" | "calibrate";
    /** Workflow mode bar (Construction → Light → Calculation → Export) */
    workflowMode?: EditorWorkflowMode;
    /** Last 3D orbit pose; restored when opening / switching back to 3D */
    camera3d?: Camera3dView | null;
    /** Greyscale or false-colour illuminance in the 3D view. Isolines is a legacy stored value and is treated as false colour plus the isolines overlay. */
    display3d?: Display3dMode;
    /** False-colour vs isolines overlay on the Top/Bottom plan (legacy exclusive mode). */
    planIsoluxMode?: "falsecolor" | "isolines";
    /** When set, False colour on the plan is an independent overlay (default on). */
    planShowFalseColor?: boolean;
    /** Isolines overlay on the plan or 3D view, independent of Greyscale / False colour. */
    planShowIsolines?: boolean;
    /** Show workplane value labels on the Top plan and 3D view. */
    planValueLabels?: boolean;
    /** Show the 3D workplane / calculation plane (default shown). */
    showWorkplane?: boolean;
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
  /**
   * Plan / underlay source files keyed by the scene's asset ids.
   * Absent on older files. Binary kinds use base64; DXF and IFC use text.
   */
  assets?: Record<string, LuxsimEmbeddedAsset>;
  /**
   * Optional Generate LDT / library-origin metadata keyed by luminaire id.
   * Absent on older files. Importers must not invent these fields.
   */
  luminaireLibrary?: Record<string, LuxsimLuminaireLibraryEntry>;
}

/** One underlay / CAD file embedded in a .lux project. */
export interface LuxsimEmbeddedAsset {
  fileName: string;
  kind: string;
  encoding: "text" | "base64";
  content: string;
  /** Optional ProjectAsset.metaJson, recreated on import when present. */
  metaJson?: string;
}

/** Library recognition fields for a luminaire stored in a .lxm / .lux / .luxsim file. */
export interface LuxsimLuminaireLibraryEntry {
  origin?: string;
  libraryFamily?: string | null;
  libraryBeamDeg?: number | null;
}
