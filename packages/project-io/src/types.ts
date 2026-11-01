import type { PhotometricData } from "../../photometry/src/types";
import type { CalcResults, RoomSpec } from "../../solver/src/types";
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

/** Three.js orbit camera pose (y-up) for persp3d restore */
export interface Camera3dView {
  position: [number, number, number];
  target: [number, number, number];
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
  /** PDF source page (0-based) used for raster underlay */
  pageIndex?: number;
  /** Derived PNG/WebP asset for Top/3D display */
  pageRasterAssetId?: string;
  /** DPI used when rasterizing the current page */
  rasterDpi?: number;
  /** Total pages in linked PDF asset */
  pdfPageCount?: number;
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
    tool: "select" | "drawRoom" | "calibrate";
    /** Workflow mode bar (Construction → Light → Calculation → Export) */
    workflowMode?: EditorWorkflowMode;
    /** Last 3D orbit pose; restored when opening / switching back to 3D */
    camera3d?: Camera3dView | null;
  };
}

export interface ResultsV2 {
  version: 2;
  byRoomId: Record<string, CalcResults>;
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
