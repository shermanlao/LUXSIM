export type {
  SceneJson,
  SceneLuminaire,
  LuxsimProjectFile,
  LuxsimLuminaireLibraryEntry,
  ProjectSceneV2,
  ResultsV2,
  RoomV2,
  Storey,
  Underlay,
  FixtureInstance,
  FixtureCodeMapRule,
  RcpDetectionProposal,
  RcpProposalStatus,
  ViewMode,
  Display3dMode,
  Camera3dView,
  DxfEntity,
  AnyScene,
  Vec2,
  EditorWorkflowMode,
  WallSurfaceResult,
  WallSurfaceGrid,
} from "./types";
export { normalizeWorkflowMode, WORKFLOW_MODES } from "./editor-workflow";
export { buildDialuxPack, getDialuxPackWarnings } from "./dialux-pack";
export type { DialuxPackInput } from "./dialux-pack";
export {
  serializeLuxsim,
  parseLuxsim,
  prepareLuxsimImport,
  compactLuminaireLibraryEntry,
  collectReferencedLuminaireIds,
  remapSceneLuminaireIds,
  downloadBlob,
  LuxsimImportError,
} from "./luxsim";
export type { PreparedLuxsimImport } from "./luxsim";
export {
  EN12464_TEMPLATES,
  enAssistPendingStatus,
  evaluateEn12464,
  getEn12464Template,
} from "./en12464";
export type { En12464Template, En12464Check, En12464ZoneCheck } from "./en12464";
export {
  DEFAULT_MF_BREAKDOWN,
  applyMfComponentEdit,
  applyOverallMaintenanceFactor,
  clampMf,
  clampMfComponent,
  defaultMaintenanceFactor,
  hasActiveMfBreakdown,
  normalizeMfBreakdown,
  presentMfBreakdown,
  productMf,
  resolveMaintenanceFactor,
} from "./maintenance-factor";
export type { MfBreakdown, MfResolution, MfSource } from "./maintenance-factor";
export {
  GOLDEN_FIXTURES,
  GOLDEN_LUXSIM_EXPECTED,
  GOLDEN_ROOM,
  GOLDEN_ROOM_ID,
} from "./ab-golden-room";
export { buildVerificationDxf } from "./dxf-export";
export {
  defaultSceneV2,
  migrateSceneV1toV2,
  ensureFixtureCodeMapIds,
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
export { roomToCalcOptions, clipResultsToPolygon, roomSpecFromV2 } from "./room-adapter";
export { ugrObserverPositionsInRoom, polygonCentroid, interiorTarget } from "./ugr-observers";
export { parseDxfEntities, dxfBounds } from "./dxf";
export {
  DXF_CLOSED_VERTEX_EPS_M,
  officialDxfClosedRingVertices,
  officialDxfEntitySegments,
  officialDxfPointsCoincide,
  officialDxfPolylineClosed,
  officialDxfPolylineStrokePoints,
} from "./official-dxf-polyline";
export {
  officialDxfHasSimpleLineLoop,
  officialDxfOpenPathSegments,
  officialDxfSimpleLineLoopRings,
} from "./official-dxf-line-loops";
export {
  DXF_CLOSED_ROOM_MIN_AREA_M2,
  DXF_CLOSED_ROOMS_NEED_DXF_STATUS,
  DXF_CLOSED_ROOMS_NONE_STATUS,
  formatDxfClosedRoomsCreatedStatus,
  officialAppendRoomsFromDxfClosedPolylines,
  officialCanCreateRoomsFromDxf,
  officialDxfWorldEntitiesForRooms,
} from "./official-dxf-closed-rooms";
export type {
  OfficialAppendDxfClosedRoomsInput,
  OfficialAppendDxfClosedRoomsResult,
  OfficialDxfRoomsUnderlay,
} from "./official-dxf-closed-rooms";
export { importIfcText } from "./ifc-import";
export type { IfcImportResult } from "./ifc-import";
export { buildFullReportPdf } from "./report";
export type { ReportInput } from "./report";
export { gridToFalseColorPngDataUrl, workplaneFalseColorRgb } from "./false-color-snapshot";
export {
  luxToRgb,
  rgbCss,
  legendStopsForRange,
  legendStopsForScale,
  isoluxLevels,
  buildIsoluxModel,
  DIALUX_LUX_STOPS,
  normalizeFalseColorScale,
  isFalseColorScale,
  formatPointLux,
  isoluxPxToWorld,
} from "./isolux-map";
export type { IsoluxMode, IsoluxModel, IsoluxWorldFrame, IsoluxPoint, FalseColorScale } from "./isolux-map";
export {
  hasCalcGrid,
  officialIsoluxModelForRoom,
  officialIsoluxModelsByRoom,
  renderIsoluxModelPngDataUrl,
  isoluxFieldPngDataUrl,
  collectOfficialIsoluxSnapshots,
  OFFICIAL_PDF_ISOLUX_RENDER,
} from "./isolux-snapshot";
export type { OfficialIsoluxRenderOpts } from "./isolux-snapshot";
export {
  GRID_SPACING_MIN_M,
  GRID_SPACING_MAX_M,
  DEFAULT_GRID_SPACING_M,
  WORKPLANE_CLEARANCE_M,
  clampGridSpacingM,
  wallZoneFromSpacingM,
  clampWorkplaneHeightM,
  clampReflectance,
} from "../../solver/src/grid-spacing";
export {
  aggregateProjectLuminaires,
  enrichSummaryWithPolygonArea,
  formatLux,
  formatLpd,
  formatLpdPer100Lx,
  maintainedAverageLux,
  resultsStripLpdMetric,
  roomLpdFromPolygon,
  roomMaintenanceFactor,
  roomPolygonArea,
  wallZoneM,
} from "./report-model";
export {
  DEFAULT_PLAN_SPAN_M,
  PROJECT_ASSET_KIND_EXT,
  underlayWorldSize,
  underlayCalibratedWorldSize,
  underlayFlipX,
  underlayFlipY,
  initialMetersPerPixel,
  initialUnderlayScale,
  legacyScaleToMetersPerPixel,
  inferProjectAssetKind,
  projectAssetKindAllowed,
  underlayKindFromAssetKind,
  isDisplayableRasterUnderlay,
  isUnderlayScaleCalibrated,
  officialImportedUnderlay,
  applyUnderlayCalibration,
  officialDrawRoomAllowed,
  officialDrawRoomBlockedReason,
  UNCALIBRATED_DRAW_ROOM_STATUS,
} from "./underlay";
export type { OfficialUnderlayScaleFields } from "./underlay";
export type { UnderlayKind } from "./underlay";
export {
  officialDxfEntityToWorld,
  officialDxfEntitiesToWorld,
  officialDxfMetersPerUnit,
  officialDxfWorldOffset,
} from "./official-dxf-world";
export type { OfficialDxfWorldUnderlay } from "./official-dxf-world";

export {
  projectLuxRange,
  fitOverviewCamera,
  fitRoomCamera,
  defaultDisplay3d,
  storeyCenter,
  isLegacyNortheastOrbit,
  isInvertedPlanOrbit,
  isNearlyVerticalOrbit,
  enforcePlanAlignedOrbit,
  MIN_PLAN_POLAR,
  PLAN_ALIGN_POLAR,
  editorOverviewCamera,
  editorRoomCamera,
  resolveEditorCamera,
} from "./scene-3d";

export { aggregateStoreyResults } from "./storey-results";
export type { StoreyResultsAggregate } from "./storey-results";

export {
  DEFAULT_NEW_ROOM_MAINTENANCE_FACTOR,
  DEFAULT_NEW_ROOM_REFLECTANCE,
  DEFAULT_NEW_ROOM_WORKPLANE_HEIGHT_M,
  appendOfficialNewRoom,
  officialAppendDrawnRoom,
  defaultNewRoomCalc,
  officialNewRoom,
} from "./new-room-defaults";

export {
  DEFAULT_NEW_ROOM_HEIGHT_M,
  DEFAULT_NEW_ROOM_HEIGHT_MM,
  MIN_ROOM_HEIGHT_M,
  applyOfficialRoomHeightMm,
  resolveOfficialNewRoomHeightM,
} from "./official-room-height";

export { officialTranslateRoom, officialTranslateStorey, translatePlanPoint } from "./official-room-translate";

export {
  VERTEX_DELETE_NO_TARGET_STATUS,
  VERTEX_DELETE_REFUSE_STATUS,
  VERTEX_STRETCH_REVERT_STATUS,
  canDeleteRoomVertex,
  canInsertRoomVertex,
  commitDeletedRoomPolygon,
  commitStretchedRoomPolygon,
  deleteRoomVertex,
  insertRoomVertex,
  moveRoomVertex,
  officialClosestPointOnSegment,
  officialDeleteRoomVertex,
  officialInsertRoomVertex,
  officialRoomEdges,
  officialRoomPolygonSelfIntersects,
  officialRoomRingVertices,
  officialSegmentsIntersect,
  officialSetRoomPolygon,
  officialStretchRoomVertex,
  resolveOfficialEdgeInsert,
  validateStretchedRoomPolygon,
} from "./official-room-vertex";
export type {
  CommitStretchedRoomPolygonResult,
  OfficialEdgeInsert,
  OfficialRoomEdge,
  VertexStretchRejectReason,
  VertexStretchValidation,
} from "./official-room-vertex";

export {
  UNION_ROOMS_CANCELLED_STATUS,
  UNION_ROOMS_PICK_FIRST_STATUS,
  UNION_ROOMS_PICK_SECOND_STATUS,
  UNION_ROOMS_REFUSE_AREA_STATUS,
  UNION_ROOMS_REFUSE_CROSS_STATUS,
  UNION_ROOMS_REFUSE_DISJOINT_STATUS,
  UNION_ROOMS_REFUSE_HOLE_STATUS,
  UNION_ROOMS_REFUSE_INVALID_STATUS,
  UNION_ROOMS_REFUSE_MISSING_STATUS,
  UNION_ROOMS_REFUSE_SAME_STATUS,
  UNION_ROOMS_REFUSE_STOREY_STATUS,
  UNION_ROOMS_REFUSE_VERTICES_STATUS,
  formatUnionRoomsSuccessStatus,
  officialPointInPolygonInclusive,
  officialPointOnSegment,
  officialPointStrictlyInsidePolygon,
  officialPolygonsOverlapOrShareEdge,
  officialSharedBoundaryLengthM,
  officialUnionRooms,
  unionOfficialRoomPolygons,
} from "./official-room-union";
export type {
  OfficialPolygonUnionResult,
  OfficialUnionRoomsReason,
  OfficialUnionRoomsResult,
} from "./official-room-union";

export {
  SUBTRACT_ROOMS_CANCELLED_STATUS,
  SUBTRACT_ROOMS_PICK_FIRST_STATUS,
  SUBTRACT_ROOMS_PICK_SECOND_STATUS,
  SUBTRACT_ROOMS_REFUSE_AREA_STATUS,
  SUBTRACT_ROOMS_REFUSE_CROSS_STATUS,
  SUBTRACT_ROOMS_REFUSE_DISJOINT_STATUS,
  SUBTRACT_ROOMS_REFUSE_EMPTY_STATUS,
  SUBTRACT_ROOMS_REFUSE_HOLE_STATUS,
  SUBTRACT_ROOMS_REFUSE_INVALID_STATUS,
  SUBTRACT_ROOMS_REFUSE_MISSING_STATUS,
  SUBTRACT_ROOMS_REFUSE_SAME_STATUS,
  SUBTRACT_ROOMS_REFUSE_SPLIT_STATUS,
  SUBTRACT_ROOMS_REFUSE_STOREY_STATUS,
  SUBTRACT_ROOMS_REFUSE_VERTICES_STATUS,
  formatSubtractRoomsSuccessStatus,
  officialPointInSubtractInclusive,
  officialSubtractRooms,
  subtractOfficialRoomPolygons,
} from "./official-room-subtract";
export type {
  OfficialPolygonSubtractResult,
  OfficialSubtractRoomsReason,
  OfficialSubtractRoomsResult,
} from "./official-room-subtract";

export {
  DEFAULT_STOREY_HEIGHT_M,
  MIN_STOREY_HEIGHT_M,
  STOREY_METRICS_EXPLANATION,
  applyOfficialStoreyMetrics,
  officialAppendStorey,
  officialNewStorey,
  officialNextStoreyElevationM,
} from "./official-storey-metrics";

export {
  buildWallChains,
  calculateRoomWalls,
  inwardNormal,
  locateOnPolyline,
  sampleWallGrid,
  sampleWallLux,
  signedPolygonArea,
  wallGridAxes,
} from "./wall-surfaces";
