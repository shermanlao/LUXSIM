export type {
  SceneJson,
  SceneLuminaire,
  LuxsimProjectFile,
  ProjectSceneV2,
  ResultsV2,
  RoomV2,
  Storey,
  Underlay,
  FixtureInstance,
  ViewMode,
  Camera3dView,
  DxfEntity,
  AnyScene,
  Vec2,
  EditorWorkflowMode,
} from "./types";
export { normalizeWorkflowMode, WORKFLOW_MODES } from "./editor-workflow";
export { buildDialuxPack, getDialuxPackWarnings } from "./dialux-pack";
export type { DialuxPackInput } from "./dialux-pack";
export { serializeLuxsim, parseLuxsim, downloadBlob } from "./luxsim";
export {
  EN12464_TEMPLATES,
  evaluateEn12464,
  getEn12464Template,
  defaultMaintenanceFactor,
  clampMf,
} from "./en12464";
export type { En12464Template, En12464Check } from "./en12464";
export { buildVerificationDxf } from "./dxf-export";
export {
  defaultSceneV2,
  migrateSceneV1toV2,
  normalizeScene,
  normalizeResults,
  isSceneV1,
  isSceneV2,
} from "./migrate";
export {
  pointInPolygon,
  roomBounds,
  rectPolygon,
  findRoomAt,
  roomAreaM2,
  translatePolygon,
  isCloseToStart,
  pointOnCircle,
  orthoPoint,
  polarOrthoPoint,
  resolveDraftPoint,
  CLOSE_START_TOL_M,
} from "./geometry";
export { mmToM, mToMm, parseLengthToM } from "./units";
export { roomToCalcOptions, clipResultsToPolygon } from "./room-adapter";
export { parseDxfEntities, dxfBounds } from "./dxf";
export { importIfcText } from "./ifc-import";
export type { IfcImportResult } from "./ifc-import";
export { buildFullReportPdf } from "./report";
export type { ReportInput } from "./report";
export {
  DEFAULT_PLAN_SPAN_M,
  underlayWorldSize,
  underlayFlipX,
  underlayFlipY,
  initialMetersPerPixel,
  legacyScaleToMetersPerPixel,
} from "./underlay";
