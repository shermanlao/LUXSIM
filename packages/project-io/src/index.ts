export type {
  SceneJson,
  SceneLuminaire,
  LuxsimProjectFile,
  LuxsimEmbeddedAsset,
  LuxsimLuminaireLibraryEntry,
  ProjectSceneV2,
  ResultsV2,
  CalcResults,
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
  OfficialDxfLayer,
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
  LUXSIM_PROJECT_EXTENSION,
  LUXSIM_LEGACY_PROJECT_EXTENSIONS,
  LUXSIM_PROJECT_FILE_ACCEPT,
  LUXSIM_PROJECT_MIME,
  isLuxsimProjectFilename,
  sanitizeProjectFilename,
  luxsimProjectDownloadName,
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
  base64ToBytes,
  bytesToBase64,
  collectReferencedAssetIds,
  decodeLuxsimAssetContent,
  embedLuxsimAsset,
  luxsimAssetUsesTextEncoding,
  missingLuxsimAssetWarning,
  remapSceneAssetIds,
  unrestoredLuxsimAssetWarning,
} from "./luxsim-assets";
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
  DRAFT_CLOSE_SNAP_CSS_PX,
  draftCloseSnapM,
  pointerPrefersDraftClose,
} from "./geometry";
export { mmToM, mToMm, parseLengthToM } from "./units";
export { roomToCalcOptions, clipResultsToPolygon, roomSpecFromV2 } from "./room-adapter";
export { ugrObserverPositionsInRoom, polygonCentroid, interiorTarget } from "./ugr-observers";
export {
  parseDxfEntities,
  parseDxfInsUnits,
  officialMetersPerUnitFromInsUnits,
  DXF_INSUNITS_METERS_PER_UNIT,
  isDxfLayoutBlockName,
  dxfBounds,
  DXF_CURVE_SEGMENTS_PER_TURN,
  dxfCurveSegmentCount,
  dxfCcwSweepRad,
  tessellateDxfBulgeIntermediates,
  tessellateCircularArc,
  tessellateCircularArcIntermediates,
} from "./dxf";
export {
  officialDxfMtextRotationDeg,
  officialDxfTextInsertionPoint,
  officialDxfTextLabelsToWorld,
  officialIsDxfTextLabelList,
  officialStripDxfText,
  officialVisibleDxfTextLabels,
  parseDxfTextLabels,
} from "./official-dxf-text";
export type { OfficialDxfTextKind, OfficialDxfTextLabel } from "./official-dxf-text";
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
  officialDxfDropContainingRings,
  officialDxfHasNetworkFace,
  officialDxfNetworkFaceRings,
  officialDxfNetworkSegments,
  officialDxfPointOnSegment,
  officialDxfRingFullyContains,
  officialDxfRingsMatch,
} from "./official-dxf-network-rooms";
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
export { buildFullReportPdf, buildFullReportPdfAsync, officialProductSheetColumns, officialTableCellLines, officialTableRowHeight, REPORT_TABLE_LINE_H, REPORT_TABLE_ROW_MIN_H } from "./report";
export { reportPdfPlainText, reportPdfPageText } from "./report-text-log";
export { TYPE, REPORT_FONT, loadReportFontsSync, registerReportFonts, reportFontFamily } from "./report-style";
export { qrMatrixForUrl, drawQrCode } from "./qr-code";
export type { ReportInput } from "./report";
export { gridToFalseColorJpegDataUrl, gridToFalseColorJpegDataUrlAsync, gridToFalseColorPngDataUrl, gridToFalseColorPngDataUrlAsync, workplaneFalseColorRgb, FALSE_COLOR_JPEG_MAX_EDGE, FALSE_COLOR_JPEG_QUALITY, FALSE_COLOR_JPEG_MIN_SAMPLES, FALSE_COLOR_JPEG_YIELD_ROWS, FALSE_COLOR_PNG_YIELD_ROWS, FALSE_COLOR_PNG_MAX_EDGE, FALSE_COLOR_PNG_MIN_SAMPLES, sampleWorkplaneLuxBilinear, falseColorJpegPixelSize, falseColorPngPixelSize } from "./false-color-snapshot";
export {
  luxToRgb,
  luxToGrey,
  GREYSCALE_SRGB_MIN,
  GREYSCALE_SRGB_MAX,
  luxToRgbLinear,
  srgbToLinearChannel,
  rgbCss,
  legendStopsForRange,
  legendStopsForScale,
  isoluxLevels,
  buildIsoluxModel,
  DIALUX_LUX_STOPS,
  OFFICIAL_FALSE_COLOR_SCALE,
  normalizeFalseColorScale,
  isFalseColorScale,
  formatPointLux,
  isoluxPxToWorld,
  sampleLuxAtWorld,
  isoluxFieldScreenRect,
} from "./isolux-map";
export type { IsoluxMode, IsoluxPalette, IsoluxModel, IsoluxWorldFrame, IsoluxPoint, FalseColorScale } from "./isolux-map";
export {
  hasCalcGrid,
  ISOLUX_DISPLAY_WALL_ZONE_M,
  officialIsoluxModelForRoom,
  officialIsoluxModelsByRoom,
  renderIsoluxModelPngDataUrl,
  isoluxFieldPngDataUrl,
  collectOfficialIsoluxSnapshots,
  collectOfficialIsoluxSnapshotsAsync,
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
  officialDwgHasConvertedLinework,
  officialHasParsedCadLinework,
  OFFICIAL_DWG_IMPORTED_STATUS,
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
  INTERSECT_ROOMS_CANCELLED_STATUS,
  INTERSECT_ROOMS_PICK_FIRST_STATUS,
  INTERSECT_ROOMS_PICK_SECOND_STATUS,
  INTERSECT_ROOMS_REFUSE_AREA_STATUS,
  INTERSECT_ROOMS_REFUSE_CROSS_STATUS,
  INTERSECT_ROOMS_REFUSE_DISJOINT_STATUS,
  INTERSECT_ROOMS_REFUSE_EMPTY_STATUS,
  INTERSECT_ROOMS_REFUSE_HOLE_STATUS,
  INTERSECT_ROOMS_REFUSE_INVALID_STATUS,
  INTERSECT_ROOMS_REFUSE_MISSING_STATUS,
  INTERSECT_ROOMS_REFUSE_SAME_STATUS,
  INTERSECT_ROOMS_REFUSE_SPLIT_STATUS,
  INTERSECT_ROOMS_REFUSE_STOREY_STATUS,
  INTERSECT_ROOMS_REFUSE_VERTICES_STATUS,
  formatIntersectRoomsSuccessStatus,
  officialPointInIntersectInclusive,
  officialIntersectRooms,
  intersectOfficialRoomPolygons,
} from "./official-room-intersect";
export type {
  OfficialPolygonIntersectResult,
  OfficialIntersectRoomsReason,
  OfficialIntersectRoomsResult,
} from "./official-room-intersect";

export {
  XOR_ROOMS_CANCELLED_STATUS,
  XOR_ROOMS_PICK_FIRST_STATUS,
  XOR_ROOMS_PICK_SECOND_STATUS,
  XOR_ROOMS_REFUSE_AREA_STATUS,
  XOR_ROOMS_REFUSE_CROSS_STATUS,
  XOR_ROOMS_REFUSE_DISJOINT_STATUS,
  XOR_ROOMS_REFUSE_EMPTY_STATUS,
  XOR_ROOMS_REFUSE_HOLE_STATUS,
  XOR_ROOMS_REFUSE_INVALID_STATUS,
  XOR_ROOMS_REFUSE_MISSING_STATUS,
  XOR_ROOMS_REFUSE_SAME_STATUS,
  XOR_ROOMS_REFUSE_SPLIT_STATUS,
  XOR_ROOMS_REFUSE_STOREY_STATUS,
  XOR_ROOMS_REFUSE_VERTICES_STATUS,
  formatXorRoomsSuccessStatus,
  officialPointInXorInclusive,
  officialXorRooms,
  xorOfficialRoomPolygons,
} from "./official-room-xor";
export type {
  OfficialPolygonXorResult,
  OfficialXorRoomsReason,
  OfficialXorRoomsResult,
} from "./official-room-xor";

export {
  ALIGN_ROOMS_CANCELLED_STATUS,
  ALIGN_ROOMS_EPS_M,
  ALIGN_ROOMS_PICK_FIRST_STATUS,
  ALIGN_ROOMS_PICK_SECOND_STATUS,
  ALIGN_ROOMS_REFUSE_AREA_STATUS,
  ALIGN_ROOMS_REFUSE_CROSS_STATUS,
  ALIGN_ROOMS_REFUSE_INVALID_STATUS,
  ALIGN_ROOMS_REFUSE_MISSING_STATUS,
  ALIGN_ROOMS_REFUSE_NOOP_STATUS,
  ALIGN_ROOMS_REFUSE_SAME_STATUS,
  ALIGN_ROOMS_REFUSE_STOREY_STATUS,
  ALIGN_ROOMS_REFUSE_VERTICES_STATUS,
  DEFAULT_OFFICIAL_ROOM_ALIGN_AXIS,
  OFFICIAL_ROOM_ALIGN_AXES,
  OFFICIAL_ROOM_ALIGN_AXIS_LABELS,
  formatAlignRoomsSuccessStatus,
  officialAlignRooms,
  officialAlignTranslation,
  officialPolygonBounds,
  officialRoomAlignAxisLabel,
  officialRoomAlignAxisPhrase,
} from "./official-room-align";
export type {
  OfficialAlignRoomsReason,
  OfficialAlignRoomsResult,
  OfficialPolygonBounds,
  OfficialRoomAlignAxis,
} from "./official-room-align";

export {
  DEFAULT_OFFICIAL_ROOM_DISTRIBUTE_AXIS,
  DISTRIBUTE_ROOMS_CANCELLED_STATUS,
  DISTRIBUTE_ROOMS_EPS_M,
  DISTRIBUTE_ROOMS_MIN_COUNT,
  DISTRIBUTE_ROOMS_PICK_MORE_STATUS,
  DISTRIBUTE_ROOMS_PICK_READY_STATUS,
  DISTRIBUTE_ROOMS_PICK_STATUS,
  DISTRIBUTE_ROOMS_REFUSE_AREA_STATUS,
  DISTRIBUTE_ROOMS_REFUSE_COUNT_STATUS,
  DISTRIBUTE_ROOMS_REFUSE_CROSS_STATUS,
  DISTRIBUTE_ROOMS_REFUSE_INVALID_STATUS,
  DISTRIBUTE_ROOMS_REFUSE_MISSING_STATUS,
  DISTRIBUTE_ROOMS_REFUSE_NOOP_STATUS,
  DISTRIBUTE_ROOMS_REFUSE_SAME_STATUS,
  DISTRIBUTE_ROOMS_REFUSE_STOREY_STATUS,
  DISTRIBUTE_ROOMS_REFUSE_VERTICES_STATUS,
  OFFICIAL_ROOM_DISTRIBUTE_AXES,
  OFFICIAL_ROOM_DISTRIBUTE_AXIS_LABELS,
  formatDistributeRoomsSuccessStatus,
  officialDistributeRooms,
  officialDistributeTranslations,
  officialRoomDistributeAxisLabel,
  officialRoomDistributeAxisPhrase,
} from "./official-room-distribute";
export type {
  OfficialDistributeMove,
  OfficialDistributeRoomsReason,
  OfficialDistributeRoomsResult,
  OfficialRoomDistributeAxis,
} from "./official-room-distribute";


export {
  FILLET_ALL_CORNERS_CANCELLED_STATUS,
  FILLET_ALL_CORNERS_PICK_ROOM_STATUS,
  FILLET_ALL_CORNERS_REFUSE_AREA_STATUS,
  FILLET_ALL_CORNERS_REFUSE_CROSS_STATUS,
  FILLET_ALL_CORNERS_REFUSE_INVALID_STATUS,
  FILLET_ALL_CORNERS_REFUSE_MISSING_STATUS,
  FILLET_ALL_CORNERS_REFUSE_RADIUS_STATUS,
  FILLET_ALL_CORNERS_REFUSE_STRAIGHT_STATUS,
  FILLET_ALL_CORNERS_REFUSE_STOREY_STATUS,
  FILLET_ALL_CORNERS_REFUSE_TOO_LARGE_STATUS,
  FILLET_ALL_CORNERS_REFUSE_VERTICES_STATUS,
  FILLET_CORNER_CANCELLED_STATUS,
  FILLET_CORNER_PICK_CORNER_STATUS,
  FILLET_CORNER_PICK_ROOM_STATUS,
  FILLET_CORNER_REFUSE_AREA_STATUS,
  FILLET_CORNER_REFUSE_CORNER_STATUS,
  FILLET_CORNER_REFUSE_CROSS_STATUS,
  FILLET_CORNER_REFUSE_INVALID_STATUS,
  FILLET_CORNER_REFUSE_MISSING_STATUS,
  FILLET_CORNER_REFUSE_RADIUS_STATUS,
  FILLET_CORNER_REFUSE_STRAIGHT_STATUS,
  FILLET_CORNER_REFUSE_STOREY_STATUS,
  FILLET_CORNER_REFUSE_TOO_LARGE_STATUS,
  FILLET_CORNER_REFUSE_VERTICES_STATUS,
  FILLET_STRAIGHT_EPS_RAD,
  filletOfficialRoomAllCorners,
  filletOfficialRoomCorner,
  formatFilletAllCornersSuccessStatus,
  formatFilletCornerSuccessStatus,
  officialFilletRoomAllCorners,
  officialFilletRoomCorner,
  officialShortSweepRad,
} from "./official-room-fillet";
export type {
  OfficialFilletAllCornersReason,
  OfficialFilletCornerReason,
  OfficialFilletRoomAllCornersResult,
  OfficialFilletRoomCornerResult,
  OfficialPolygonFilletAllResult,
  OfficialPolygonFilletResult,
} from "./official-room-fillet";

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
  STOREY_OUTLINE_CREATED_STATUS,
  STOREY_OUTLINE_REFUSE_AREA_STATUS,
  STOREY_OUTLINE_REFUSE_CROSS_STATUS,
  STOREY_OUTLINE_REFUSE_MISSING_STATUS,
  STOREY_OUTLINE_REFUSE_VERTICES_STATUS,
  STOREY_OUTLINE_REPLACED_STATUS,
  officialSetStoreyOutline,
  officialValidateSimplePolygon,
} from "./official-storey-outline";
export type {
  OfficialSetStoreyOutlineResult,
  OfficialStoreyOutlineReason,
} from "./official-storey-outline";

export {
  OFFICIAL_DXF_DEFAULT_LAYER,
  officialCadLayerNames,
  officialDxfLayerName,
  officialEntityLayer,
  officialExtractVisibleCadEntities,
  officialInsertExplodedLayer,
  parseDxfLayers,
} from "./official-dxf-layers";

export {
  OFFICIAL_CAD_COMPRESS_TOL_M,
  officialCadEntityPointCount,
  officialCompressCadEntities,
} from "./official-cad-compress";

export {
  officialMetersPerUnitFromAssetMeta,
  officialRecoverCadMetersPerUnit,
} from "./official-underlay-units";
export type { OfficialAssetUnitMeta } from "./official-underlay-units";

export {
  COPY_STOREY_ELEVATION_EPS_M,
  COPY_STOREY_REFUSE_BUILDING_STATUS,
  COPY_STOREY_REFUSE_INVALID_STATUS,
  COPY_STOREY_REFUSE_MISSING_STATUS,
  formatCopyStoreySuccessStatus,
  officialCopyStorey,
  officialCopyStoreyElevationM,
  officialCopyStoreyName,
} from "./official-copy-storey";
export type {
  OfficialCopyStoreyInput,
  OfficialCopyStoreyReason,
  OfficialCopyStoreyResult,
} from "./official-copy-storey";


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
