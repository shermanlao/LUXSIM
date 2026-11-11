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
} from "./types";
export { serializeLuxsim, parseLuxsim, downloadBlob } from "./luxsim";
export { buildDialuxPack } from "./dialux-pack";
export type { DialuxPackInput } from "./dialux-pack";
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
export { buildFullReportPdf, planReportSections } from "./report";
export type { ReportInput, ReportSectionPlan } from "./report";
export {
  cameraForRooms,
  drawRoomPerspective3dOnPdf,
  drawStoreyPerspective3dOnPdf,
  pdfIncludes3dDrawingMarkers,
  projectPoint,
} from "./view-3d-render";
export type { CameraPreset } from "./view-3d-render";
export {
  DEFAULT_PLAN_SPAN_M,
  underlayWorldSize,
  underlayFlipX,
  underlayFlipY,
  initialMetersPerPixel,
  legacyScaleToMetersPerPixel,
} from "./underlay";
