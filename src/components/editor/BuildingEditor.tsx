"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { flushSync } from "react-dom";
import type { PhotometricData } from "@luxsim/photometry";
import {
  buildFullReportPdfAsync,
  gridToFalseColorJpegDataUrlAsync,
  collectOfficialIsoluxSnapshotsAsync,
  defaultDisplay3d,
  findRoomAt,
  fitOverviewCamera,
  applyUnderlayCalibration,
  isDisplayableRasterUnderlay,
  officialImportedUnderlay,
  OFFICIAL_DWG_IMPORTED_STATUS,
  officialDrawRoomAllowed,
  officialDrawRoomBlockedReason,
  officialAppendDrawnRoom,
  officialApplyFromPlanGeometry,
  officialCanCreateRoomsFromDxf,
  officialEnsureActiveStoreyForPlanBuild,
  formatOfficialFromPlanStatus,
  officialHasParsedCadLinework,
  officialTranslateRoom,
  officialTranslateStorey,
  officialSetRoomPolygon,
  officialUnionRooms,
  officialSubtractRooms,
  officialIntersectRooms,
  officialXorRooms,
  UNION_ROOMS_CANCELLED_STATUS,
  UNION_ROOMS_PICK_FIRST_STATUS,
  UNION_ROOMS_PICK_SECOND_STATUS,
  SUBTRACT_ROOMS_CANCELLED_STATUS,
  SUBTRACT_ROOMS_PICK_FIRST_STATUS,
  SUBTRACT_ROOMS_PICK_SECOND_STATUS,
  INTERSECT_ROOMS_CANCELLED_STATUS,
  INTERSECT_ROOMS_PICK_FIRST_STATUS,
  INTERSECT_ROOMS_PICK_SECOND_STATUS,
  XOR_ROOMS_CANCELLED_STATUS,
  XOR_ROOMS_PICK_FIRST_STATUS,
  XOR_ROOMS_PICK_SECOND_STATUS,
  officialAlignRooms,
  ALIGN_ROOMS_CANCELLED_STATUS,
  ALIGN_ROOMS_PICK_FIRST_STATUS,
  ALIGN_ROOMS_PICK_SECOND_STATUS,
  DEFAULT_OFFICIAL_ROOM_ALIGN_AXIS,
  OFFICIAL_ROOM_ALIGN_AXES,
  officialRoomAlignAxisLabel,
  type OfficialRoomAlignAxis,
  officialDistributeRooms,
  officialFilletRoomAllCorners,
  officialFilletRoomCorner,
  DISTRIBUTE_ROOMS_CANCELLED_STATUS,
  FILLET_ALL_CORNERS_CANCELLED_STATUS,
  FILLET_ALL_CORNERS_PICK_ROOM_STATUS,
  FILLET_ALL_CORNERS_REFUSE_RADIUS_STATUS,
  FILLET_CORNER_CANCELLED_STATUS,
  FILLET_CORNER_REFUSE_RADIUS_STATUS,
  DEFAULT_OFFICIAL_ROOM_DISTRIBUTE_AXIS,
  OFFICIAL_ROOM_DISTRIBUTE_AXES,
  officialRoomDistributeAxisLabel,
  type OfficialRoomDistributeAxis,
  applyOfficialRoomHeightMm,
  resolveOfficialNewRoomHeightM,
  DEFAULT_NEW_ROOM_HEIGHT_M,
  DEFAULT_NEW_ROOM_HEIGHT_MM,
  officialAppendStorey,
  officialSetStoreyOutline,
  officialValidateSimplePolygon,
  officialCadLayerNames,
  officialCadLayerMetaIncomplete,
  officialCadEntitiesLackLayerNames,
  officialCadAssetMetaJsonWithoutSourceEntities,
  officialHasCadLayerTable,
  officialCompressCadEntities,
  officialExtractVisibleCadEntities,
  officialMetersPerUnitFromAssetMeta,
  officialRecoverCadMetersPerUnit,
  type OfficialDxfLayer,
  officialCopyStorey,
  applyOfficialStoreyMetrics,
  UNCALIBRATED_DRAW_ROOM_STATUS,
  legacyScaleToMetersPerPixel,
  mToMm,
  parseLengthToM,
  OFFICIAL_FALSE_COLOR_SCALE,
  rectPolygon,
  roomAreaM2,
  roomBounds,
  underlayWorldSize,
  collectReferencedAssetIds,
  type Camera3dView,
  type Display3dMode,
  type DxfEntity,
  type OfficialDxfTextLabel,
  type OfficialFromPlanAiFailReason,
  type FalseColorScale,
  type ProjectSceneV2,
  type ResultsV2,
  type Vec2,
  type ViewMode,
  EN12464_TEMPLATES,
  enAssistPendingStatus,
  evaluateEn12464,
  clampMf,
  clampGridSpacingM,
  clampWorkplaneHeightM,
  clampReflectance,
  GRID_SPACING_MIN_M,
  GRID_SPACING_MAX_M,
  WORKPLANE_CLEARANCE_M,
  resolveMaintenanceFactor,
  aggregateStoreyResults,
  presentMfBreakdown,
  applyOverallMaintenanceFactor,
  applyMfComponentEdit,
  WORKFLOW_MODES,
  getDialuxPackWarnings,
  type EditorWorkflowMode,
} from "@luxsim/project-io";
import {
  buildLuxsimProject,
  exportDialuxPack,
  exportLuxsimFile,
} from "@/lib/exports-client";
import {
  collectOfficialExportSources,
  missingExportSourceStatus,
  officialExportLuminaireIds,
  type LuminaireExportPayload,
} from "@/lib/export-source-files";
import {
  collectOfficialExportAssets,
  fetchProjectAssetFile,
  fetchProjectAssetMeta,
  missingExportAssetStatus,
  type ExportAssetMeta,
} from "@/lib/export-underlay-assets";
import { takeImportLuxsimWarnings } from "@/lib/import-luxsim-warnings";
import { runSolverClient } from "@/lib/run-solver";
import { prefixedId } from "@/lib/random-id";
import { planFixtureArray } from "@/lib/arrange-array";
import type { ArrayParams } from "@/lib/arrange-array";
import { EMPTY_LINE_PICK, type LinePickState } from "@/lib/line-array-pick";
import { EMPTY_CIRCLE_PICK, type CirclePickState } from "@/lib/circle-array-pick";
import { EMPTY_POLYGON_PATH_PICK, type PolygonPathPickState } from "@/lib/polygon-array-pick";
import {
  EMPTY_OFFICIAL_TWO_ROOM_PICK,
  applyOfficialRoomIntersectPick,
  applyOfficialRoomSubtractPick,
  applyOfficialRoomUnionPick,
  applyOfficialRoomAlignPick,
  applyOfficialRoomXorPick,
  startOfficialRoomAlignPick,
  startOfficialRoomIntersectPick,
  startOfficialRoomSubtractPick,
  startOfficialRoomUnionPick,
  startOfficialRoomXorPick,
  type OfficialTwoRoomPickKind,
  type OfficialTwoRoomPickState,
} from "@/lib/room-union-pick";
import {
  EMPTY_ROOM_DISTRIBUTE_PICK,
  applyOfficialRoomDistributeCommit,
  applyOfficialRoomDistributePick,
  distributeRoomsPickHint,
  startOfficialRoomDistributePick,
  type RoomDistributePickState,
} from "@/lib/room-distribute-pick";
import {
  EMPTY_ROOM_FILLET_ALL_PICK,
  EMPTY_ROOM_FILLET_PICK,
  applyOfficialRoomFilletAllPick,
  applyOfficialRoomFilletCornerPick,
  applyOfficialRoomFilletPick,
  filletAllCornersPickHint,
  filletCornerPickHint,
  startOfficialRoomFilletAllPick,
  startOfficialRoomFilletPick,
  type RoomFilletAllPickState,
  type RoomFilletPickState,
} from "@/lib/room-fillet-pick";
import {
  formatArrayApplyStatus,
  prepareFixtureArrayApply,
} from "@/lib/array-occupied";
import {
  automaticPlacementInputFromParams,
  formatAutomaticPlacementRefusal,
  planAutomaticPlacement,
} from "@/lib/automatic-placement";
import {
  formatAreaM2,
  formatMetresXy,
  formatOriginMetres,
  shouldShowBoundingMin,
} from "@/lib/room-props-format";
import {
  clearResultsForRooms,
  writeFixtureInstances,
  type WriteInstancesCalcDeps,
} from "@/lib/write-instances";
import { decideFixtureChange } from "@/lib/discard-results-confirm";
import { commitAcceptedRcpProposals, planRcpCommit } from "@/lib/rcp-commit";
import {
  commitScheduleImport,
  planScheduleCommit,
  scheduleCommitBlockedReason,
  type ScheduleImportRow,
} from "@/lib/schedule-csv";
import {
  PLAN_CODE_REFUSE_NO_PLAN,
  commitPlanCodePlacements,
  planCodeCommitBlockedReason,
  planPlanCodeCommit,
  scanPlanCodeLabels,
  type PlanCodePlaceRow,
} from "@/lib/plan-code-place";
import {
  focusActiveRoomAfterPlacement,
  postPlaceCalcStatusSuffix,
} from "@/lib/post-place-calc";
import {
  patchProjectMinimal,
  persistableScene,
  projectPatchDiff,
  snapshotProject,
  type ProjectSnapshot,
} from "@/lib/project-autosave";
import { officialWriteCachedProjectOpen } from "@/lib/official-project-open-cache";
import { useEditorPerformanceMonitor } from "@/lib/editor-display-quality";
import { saveReminderDue, startSaveReminderEpoch } from "@/lib/save-reminder";
import { useAccountSettings } from "@/components/AccountSettingsProvider";
import {
  calcStatusTone,
  formatCalcBusyStatus,
  formatCalcEmptyError,
  planCalcRooms,
  type CalcScope,
} from "@/lib/editor-calc-rooms";
import { runOfficialClientCalc } from "@/lib/official-client-calc";
import {
  createUndoStack,
  editorUndoKeyAction,
  isTypingField,
} from "@/lib/editor-undo";
import { FalseColorLegend } from "./FalseColorLegend";
import { FalseColorScaleApplyPrompt } from "./FalseColorScaleApplyPrompt";
import { EditorResultsStrip } from "./EditorResultsStrip";
import { EditorChromeToggle } from "./EditorChromeToggle";
import {
  DEFAULT_EDITOR_CHROME_MINIMIZED,
  readEditorChromeMinimized,
  writeEditorChromeMinimized,
  patchEditorChromeMinimized,
  editorChromeBodyClassName,
  type EditorChromeMinimized,
  type EditorChromePanel,
} from "@/lib/editor-chrome-minimize";
import { RcpDetectPanel } from "./RcpDetectPanel";
import { PlanCodePlacePanel } from "./PlanCodePlacePanel";
import { FixtureArrayPanel } from "./FixtureArrayPanel";
import { ScheduleImportPanel } from "./ScheduleImportPanel";
import { FixtureCodeMapPanel } from "./FixtureCodeMapPanel";
import { Display3dToggle } from "./Display3dToggle";
import { IsolineLevelsControls } from "./IsolineLevelsControls";
import { PlanIsoluxToggle } from "./PlanIsoluxToggle";
import {
  planIsoluxControlState,
  planShowFalseColorFromUi,
  planShowIsolinesFromUi,
} from "@/lib/plan-isolux-display";
import {
  isolineSettingsEqual,
  isolineSettingsFromUi,
  isolineSettingsToUi,
  type IsolineLevelSettings,
} from "@luxsim/project-io";
import { showWorkplaneFromUi } from "@/lib/workplane-display";
import { captureOfficialReport3dViewsAsync } from "@/lib/official-pdf-3d-capture";
import { renderAllReport3dViewsAsync, webglCaptureAvailable } from "@/lib/render-scene-3d";
import { TopView2D } from "./TopView2D";
import { PlanLayerPanel } from "./PlanLayerPanel";
import { ElevationView2D } from "./ElevationView2D";
import { editorWorkflowRailPlacement } from "@/lib/editor-workflow-panels";
import { officialShouldPromptBuildBefore3d } from "@/lib/official-needs-build-before-3d";
import { BuildModelFirstDialog } from "./BuildModelFirstDialog";
import { AskBuildAfterPlanDialog } from "./AskBuildAfterPlanDialog";
import { officialShouldAskBuildAfterPlanImport } from "@/lib/official-ask-build-after-plan";
import { DiscardResultsDialog } from "./DiscardResultsDialog";
import { SaveReminderDialog } from "./SaveReminderDialog";
import { FixtureLightConePreview } from "./FixtureLightConePreview";
import { PolarPreview } from "@/components/PolarPreview";
import { PhotometricColorQuality } from "@/components/PhotometricColorQuality";
import { GenerateLdtDialog } from "./GenerateLdtDialog";
import { OfficialWaitDialog } from "@/components/OfficialWaitDialog";
import { useOfficialWaitDialog } from "@/components/useOfficialWaitDialog";
import { ProjectSharePanel } from "@/components/editor/ProjectSharePanel";
import { OFFICIAL_WAIT_COPY, officialWaitAfterPaint, officialWaitBeforeWork, officialWaitYield } from "@/lib/official-wait-dialog";
import { officialSaveBlob, OFFICIAL_SAVE_TYPES } from "@/lib/official-save-file";
import { officialFormatPlanUploadAt } from "@/lib/official-plan-upload-label";
import { officialPlanAssetFileUrl } from "@/lib/official-content-disposition";
import { OfficialMaybeInput, OfficialMaybeSelect } from "@/components/editor/OfficialViewField";
import { officialViewSwitchReady, shouldWaitForOfficialViewSwitch } from "@/lib/official-view-switch";
import { falseColorScalesEqual, shouldApplyViewFalseColorScale } from "@/lib/false-color-scale-commit";
import { HelpTip } from "@/components/HelpTip";
import { libraryConeLabel, luminaireListLabel } from "@/lib/luminaire-origin";
import {
  IconCalibrate,
  IconDrawRoom,
  IconRect,
  IconSelect,
  IconModeCalculation,
  IconModeConstruction,
  IconModeExport,
  IconModeLight,
  IconView3d,
  IconViewElevation,
  IconViewTop,
} from "./EditorGlyphs";

const BuildingScene3D = dynamic(
  () => import("./BuildingScene3D").then((m) => m.BuildingScene3D),
  {
    ssr: false,
    loading: () => <OfficialWaitDialog {...OFFICIAL_WAIT_COPY.loading3d} />,
  }
);

type LumRow = {
  id: string;
  name: string;
  sourceFormat?: string;
  originalName?: string;
  watts: number | null;
  lumens: number | null;
  origin?: string | null;
  libraryFamily?: string | null;
  libraryBeamDeg?: number | null;
};

type AssetRow = {
  id: string;
  kind: string;
  fileName: string;
  metaJson: string;
  createdAt?: string;
};

function nid(prefix: string) {
  return prefixedId(prefix);
}

function assetRowWithoutCadSourceEntities(row: AssetRow): AssetRow {
  return {
    ...row,
    metaJson: officialCadAssetMetaJsonWithoutSourceEntities(row.metaJson),
  };
}

/** Read native pixel size so plan underlays keep the import aspect ratio. */
function readImagePixelSize(file: File): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith("image/") && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
    return Promise.resolve(null);
  }
  const url = URL.createObjectURL(file);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      URL.revokeObjectURL(url);
      resolve(width > 0 && height > 0 ? { width, height } : null);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

type Props = {
  projectId: string;
  initialName: string;
  initialScene: ProjectSceneV2;
  initialResults: ResultsV2;
  initialAssets?: AssetRow[];
  initialLibrary?: LumRow[];
  initialPhotometry?: Record<string, PhotometricData>;
  /** When set, the editor is browse-only: no save, calc, or scene edits. */
  readOnly?: boolean;
  /** Prefix for underlay/asset fetches, e.g. /api/share/<token>. */
  shareBasePath?: string;
  /** Server updatedAt of the snapshot this editor was opened from. */
  initialUpdatedAt?: string;
  /** Signed-in user, used to write the recent-project open cache after a save. */
  cacheUserId?: string;
};

export function BuildingEditor({
  projectId,
  initialName,
  initialScene,
  initialResults,
  initialAssets = [],
  initialLibrary = [],
  initialPhotometry = {},
  readOnly = false,
  shareBasePath,
  cacheUserId,
}: Props) {
  const [name, setName] = useState(initialName);
  const [scene, setScene] = useState<ProjectSceneV2>(initialScene);
  const [results, setResults] = useState<ResultsV2>(initialResults);
  const [library, setLibrary] = useState<LumRow[]>(initialLibrary);
  const [assets, setAssets] = useState<AssetRow[]>(initialAssets);
  const [photoCache, setPhotoCache] = useState<Record<string, PhotometricData>>(initialPhotometry);
  const [sourceCache, setSourceCache] = useState<
    Record<string, { filename: string; text: string }>
  >({});
  const photoCacheRef = useRef(photoCache);
  const sourceCacheRef = useRef(sourceCache);
  photoCacheRef.current = photoCache;
  sourceCacheRef.current = sourceCache;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const officialWait = useOfficialWaitDialog();
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingDiscardRoomIds, setPendingDiscardRoomIds] = useState<string[] | null>(null);
  const pendingFixtureApplyRef = useRef<(() => void) | null>(null);
  const [saveReminderOpen, setSaveReminderOpen] = useState(false);
  const [buildModelFirstOpen, setBuildModelFirstOpen] = useState(false);
  const [askBuildAfterPlanOpen, setAskBuildAfterPlanOpen] = useState(false);
  const reminderEpochRef = useRef<number | null>(null);
  const [reminderGeneration, setReminderGeneration] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [generateLdtOpen, setGenerateLdtOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [chromeMin, setChromeMin] = useState<EditorChromeMinimized>(
    DEFAULT_EDITOR_CHROME_MINIMIZED,
  );
  useEffect(() => {
    setChromeMin(readEditorChromeMinimized());
  }, []);
  function setChromePanelMinimized(panel: EditorChromePanel, minimized: boolean) {
    setChromeMin((prev) => {
      const next = patchEditorChromeMinimized(prev, panel, minimized);
      writeEditorChromeMinimized(next);
      return next;
    });
  }
  const [calcAfterPlace, setCalcAfterPlace] = useState(false);
  const [arrayPreview, setArrayPreview] = useState<{ x: number; y: number; rotationDeg: number }[] | null>(
    null
  );
  const [arrayApplying, setArrayApplying] = useState(false);
  const [linePick, setLinePick] = useState<LinePickState>(EMPTY_LINE_PICK);
  const [linePickActive, setLinePickActive] = useState(false);
  const [circlePick, setCirclePick] = useState<CirclePickState>(EMPTY_CIRCLE_PICK);
  const [circlePickActive, setCirclePickActive] = useState(false);
  const [polygonPick, setPolygonPick] = useState<PolygonPathPickState>(EMPTY_POLYGON_PATH_PICK);
  const [polygonPickActive, setPolygonPickActive] = useState(false);
  const [booleanPick, setBooleanPick] = useState<OfficialTwoRoomPickState>(
    EMPTY_OFFICIAL_TWO_ROOM_PICK
  );
  const [distributePick, setDistributePick] = useState<RoomDistributePickState>(
    EMPTY_ROOM_DISTRIBUTE_PICK
  );
  const unionPickActive = booleanPick.active || distributePick.active;
  const unionPickMode = distributePick.active
    ? "distribute"
    : booleanPick.active
      ? booleanPick.kind
      : undefined;
  const [alignAxis, setAlignAxis] = useState<OfficialRoomAlignAxis>(
    DEFAULT_OFFICIAL_ROOM_ALIGN_AXIS
  );
  const [distributeAxis, setDistributeAxis] = useState<OfficialRoomDistributeAxis>(
    DEFAULT_OFFICIAL_ROOM_DISTRIBUTE_AXIS
  );
  const [filletPick, setFilletPick] = useState<RoomFilletPickState>(EMPTY_ROOM_FILLET_PICK);
  const [filletAllPick, setFilletAllPick] = useState<RoomFilletAllPickState>(EMPTY_ROOM_FILLET_ALL_PICK);
  const [filletRadiusMm, setFilletRadiusMm] = useState("500");
  const [scheduleRows, setScheduleRows] = useState<ScheduleImportRow[]>([]);
  const [scheduleParseErrors, setScheduleParseErrors] = useState<string[]>([]);
  const [scheduleCommitting, setScheduleCommitting] = useState(false);
  const [calcAfterSchedule, setCalcAfterSchedule] = useState(false);
  const [planCodeRows, setPlanCodeRows] = useState<PlanCodePlaceRow[]>([]);
  const [planCodeScanning, setPlanCodeScanning] = useState(false);
  const [planCodeCommitting, setPlanCodeCommitting] = useState(false);
  const [calcAfterPlanCode, setCalcAfterPlanCode] = useState(false);
  const [replacePlanCodeFixtures, setReplacePlanCodeFixtures] = useState(false);
  const [rcpDetecting, setRcpDetecting] = useState(false);
  const [rcpCommitting, setRcpCommitting] = useState(false);
  const [rcpWarnings, setRcpWarnings] = useState<string[]>([]);
  const [showRcpOverlay, setShowRcpOverlay] = useState(true);
  const [selectedRcpId, setSelectedRcpId] = useState<string | null>(null);
  const [calibDist, setCalibDist] = useState("5");
  const [rectLenMm, setRectLenMm] = useState("6000");
  const [rectWidMm, setRectWidMm] = useState("4000");
  const [roomHeightMm, setRoomHeightMm] = useState(() => {
    const first = initialScene.rooms.find((r) => r.id === initialScene.ui.activeRoomId)
      ?? initialScene.rooms[0];
    return first ? String(Math.round(mToMm(first.heightM))) : DEFAULT_NEW_ROOM_HEIGHT_MM;
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const planRef = useRef<HTMLInputElement>(null);
  const cadLayerBackfillAttemptedRef = useRef<Set<string>>(new Set());
  const cadSourceEntitiesByAssetRef = useRef<Map<string, DxfEntity[]>>(new Map());
  /** Live 3D orbit; flushed into scene.ui.camera3d on save */
  const camera3dRef = useRef<Camera3dView | null>(initialScene.ui.camera3d ?? null);
  const lastSavedRef = useRef<ProjectSnapshot>(
    snapshotProject(initialName, initialScene, initialResults)
  );
  const latestRef = useRef({ name: initialName, scene: initialScene, results: initialResults });
  const saveInFlight = useRef(false);
  const saveQueued = useRef(false);

  const { autosaveMs, loaded: accountLoaded } = useAccountSettings();
  const [calcTarget, setCalcTarget] = useState<CalcScope | null>(null);
  const undoStackRef = useRef(
    createUndoStack<{ name: string; scene: ProjectSceneV2; results: ResultsV2 }>(50)
  );
  const [undoRevision, setUndoRevision] = useState(0);
  const bumpUndoUi = () => setUndoRevision((n) => n + 1);
  const canUndo = !readOnly && undoStackRef.current.canUndo();
  const canRedo = !readOnly && undoStackRef.current.canRedo();
  void undoRevision;
  const coalesceRef = useRef<string | null>(null);
  const [layerDraftHidden, setLayerDraftHidden] = useState<string[] | null>(null);


  const selected = scene.instances.find((l) => l.instanceId === selectedId) ?? null;
  const activeRoom = scene.rooms.find((r) => r.id === scene.ui.activeRoomId) ?? null;
  const activeStorey = scene.storeys.find((st) => st.id === scene.ui.activeStoreyId) ?? null;
  const storeyAggregate = useMemo(
    () =>
      activeRoom
        ? null
        : aggregateStoreyResults(scene.rooms, results, scene.ui.activeStoreyId),
    [activeRoom, scene.rooms, results, scene.ui.activeStoreyId]
  );
  const activeResults = activeRoom ? results.byRoomId[activeRoom.id] ?? null : null;
  const stripResults = activeResults ?? storeyAggregate?.results ?? null;
  const en12464Check = useMemo(() => {
    if (!activeRoom || !activeResults) return null;
    return evaluateEn12464({
      templateId: activeRoom.calc.en12464TemplateId,
      maintenanceFactor: activeRoom.calc.maintenanceFactor,
      mfBreakdown: activeRoom.calc.mfBreakdown,
      taskResults: activeResults,
    });
  }, [activeRoom, activeResults]);
  const mfResolved = activeRoom
    ? resolveMaintenanceFactor({
        maintenanceFactor: activeRoom.calc.maintenanceFactor,
        mfBreakdown: activeRoom.calc.mfBreakdown,
      })
    : null;
  const activeMfBreakdown = activeRoom
    ? presentMfBreakdown({
        maintenanceFactor: activeRoom.calc.maintenanceFactor,
        mfBreakdown: activeRoom.calc.mfBreakdown,
      })
    : undefined;

  const underlay = scene.underlays.find((u) => u.storeyId === scene.ui.activeStoreyId);
  const underlayDisplayAssetId =
    underlay && isDisplayableRasterUnderlay(underlay)
      ? (underlay.pageRasterAssetId ?? underlay.assetId)
      : null;
  const assetApiBase = shareBasePath ?? `/api/projects/${projectId}`;
  const underlayUrl = underlayDisplayAssetId
    ? `${assetApiBase}/assets/${underlayDisplayAssetId}/file`
    : null;
  const dxfEntities: DxfEntity[] = underlay?.dxfEntities ?? [];

  useEffect(() => {
    const warnings = takeImportLuxsimWarnings(projectId);
    if (warnings.length) setStatus(warnings.join(" "));
  }, [projectId]);

  useEffect(() => {
    if (scene.ui.tool !== "drawRoom") return;
    const blocked = officialDrawRoomBlockedReason(underlay);
    if (!blocked) return;
    patchSceneUi((s) =>
      s.ui.tool === "drawRoom" ? { ...s, ui: { ...s.ui, tool: "select" } } : s
    );
    setStatus(blocked);
  }, [underlay, scene.ui.tool]);

  const loadLibrary = useCallback(async () => {
    if (readOnly) {
      if (initialLibrary.length) setLibrary(initialLibrary);
      return;
    }
    const res = await fetch("/api/luminaires");
    if (res.ok) setLibrary(await res.json());
  }, [readOnly, initialLibrary]);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  useEffect(() => {
    setPlanCodeRows([]);
  }, [scene.ui.activeStoreyId]);

  useEffect(() => {
    if (!assets.length) return;
    setScene((s) => {
      let changed = false;
      const underlays = s.underlays.map((u) => {
        if (u.kind !== "dxf" && u.kind !== "dwg") return u;
        const planAsset = assets.find((a) => a.id === u.assetId);
        if (!planAsset) return u;
        let meta: { metersPerUnit?: number; insunits?: number | null } = {};
        try {
          meta = JSON.parse(planAsset.metaJson || "{}") as typeof meta;
        } catch {
          return u;
        }
        const recovered = officialRecoverCadMetersPerUnit(u.metersPerUnit, meta);
        if (recovered == null) return u;
        changed = true;
        return { ...u, metersPerUnit: recovered };
      });
      return changed ? { ...s, underlays } : s;
    });
  }, [assets]);

  // One-time: undo previous mistaken X-handedness pass if present.
  useEffect(() => {
    setScene((s) => {
      const undoX = new Map<string, (x: number) => number>();
      let changed = false;
      const underlays = s.underlays.map((u) => {
        if (u.orientationMigrated) return u;
        const legacy = u as typeof u & { topHandednessCorrected?: boolean };
        const size = underlayWorldSize(u);
        if (legacy.topHandednessCorrected && !size && u.kind === "image") {
          return u;
        }
        changed = true;
        if (legacy.topHandednessCorrected && size) {
          const midX = u.offsetX + size.widthM / 2;
          undoX.set(u.storeyId, (x) => 2 * midX - x);
        }
        const flipXn = undoX.get(u.storeyId);
        return {
          ...u,
          flipX: false,
          flipY: false,
          orientationMigrated: true,
          dxfEntities: flipXn
            ? u.dxfEntities?.map((e) => ({
                ...e,
                points: e.points.map((p) => ({ x: flipXn(p.x), y: p.y })),
              }))
            : u.dxfEntities,
        };
      });
      if (!changed) return s;
      if (undoX.size === 0) return { ...s, underlays };

      return {
        ...s,
        underlays,
        rooms: s.rooms.map((r) => {
          const flip = undoX.get(r.storeyId);
          if (!flip) return r;
          return {
            ...r,
            polygon: r.polygon.map((p) => ({ x: flip(p.x), y: p.y })),
          };
        }),
        instances: s.instances.map((i) => {
          const flip = undoX.get(i.storeyId);
          if (!flip) return i;
          return {
            ...i,
            position: { ...i.position, x: flip(i.position.x) },
          };
        }),
      };
    });
  }, [scene.underlays]);

  async function fetchLuminaireExport(id: string): Promise<LuminaireExportPayload> {
    const listed = library.find((row) => row.id === id);
    const listedMeta = {
      origin: listed?.origin,
      libraryFamily: listed?.libraryFamily,
      libraryBeamDeg: listed?.libraryBeamDeg,
    };
    const res = await fetch(`/api/luminaires/${id}`);
    if (!res.ok) {
      return {
        photometric: photoCacheRef.current[id] ?? null,
        source: sourceCacheRef.current[id] ?? null,
        ...listedMeta,
      };
    }
    const data = await res.json();
    const photometric = (data.photometric ?? null) as PhotometricData | null;
    const source =
      typeof data.sourceText === "string" && data.sourceText.length
        ? { filename: String(data.originalName || `${id}.ies`), text: data.sourceText as string }
        : null;
    if (photometric) {
      photoCacheRef.current = { ...photoCacheRef.current, [id]: photometric };
      setPhotoCache((c) => ({ ...c, [id]: photometric }));
    }
    if (source) {
      sourceCacheRef.current = { ...sourceCacheRef.current, [id]: source };
      setSourceCache((c) => ({ ...c, [id]: source }));
    }
    return {
      photometric,
      source,
      origin: typeof data.origin === "string" ? data.origin : listedMeta.origin,
      libraryFamily:
        data.libraryFamily === null || typeof data.libraryFamily === "string"
          ? data.libraryFamily
          : listedMeta.libraryFamily,
      libraryBeamDeg:
        data.libraryBeamDeg === null || typeof data.libraryBeamDeg === "number"
          ? data.libraryBeamDeg
          : listedMeta.libraryBeamDeg,
    };
  }

  async function ensurePhotometry(id: string) {
    if (photoCacheRef.current[id]) return photoCacheRef.current[id]!;
    const loaded = await fetchLuminaireExport(id);
    return loaded.photometric;
  }

  async function loadOfficialExportAssetMeta(ids: string[]): Promise<ExportAssetMeta[]> {
    const byId = new Map<string, ExportAssetMeta>();
    for (const row of assets) {
      byId.set(row.id, {
        id: row.id,
        fileName: row.fileName,
        kind: row.kind,
        metaJson: row.metaJson,
      });
    }
    if (ids.some((id) => !byId.has(id))) {
      for (const row of await fetchProjectAssetMeta(projectId)) {
        byId.set(row.id, row);
      }
    }
    return ids.map((id) => byId.get(id)).filter((row): row is ExportAssetMeta => Boolean(row));
  }

  async function saveOfficialLuxFile() {
    await officialWait.run(OFFICIAL_WAIT_COPY.savingProjectFile, async () => {
      const toExport = sceneWithView(scene);
      const names: Record<string, string> = {};
      for (const l of library) names[l.id] = l.name;
      const collected = await collectSourcesForOfficialExport(
        officialExportLuminaireIds(toExport)
      );
      const assetIds = collectReferencedAssetIds(toExport);
      const assetMeta = await loadOfficialExportAssetMeta(assetIds);
      const assetNames: Record<string, string> = {};
      for (const row of assetMeta) assetNames[row.id] = row.fileName;
      const packedAssets = await collectOfficialExportAssets({
        assetIds,
        assetMeta,
        loadAssetFile: (id, meta) => fetchProjectAssetFile(projectId, id, meta?.kind),
      });
      exportLuxsimFile(
        buildLuxsimProject({
          name,
          scene: toExport as never,
          results: results as never,
          photometry: collected.photometry,
          sourceFiles: collected.sourceFiles,
          assets: packedAssets.assets,
          luminaireLibrary: collected.luminaireLibrary,
        })
      );
      const messages: string[] = [];
      if (collected.missingSourceIds.length) {
        messages.push(missingExportSourceStatus("luxsim", collected.missingSourceIds, names));
      }
      if (packedAssets.missingAssetIds.length) {
        messages.push(missingExportAssetStatus(packedAssets.missingAssetIds, assetNames));
      }
      if (messages.length) setStatus(messages.join(" "));
    });
  }

  async function collectSourcesForOfficialExport(ids: string[]) {
    const libraryCache: Record<
      string,
      { origin?: string | null; libraryFamily?: string | null; libraryBeamDeg?: number | null }
    > = {};
    for (const row of library) {
      libraryCache[row.id] = {
        origin: row.origin,
        libraryFamily: row.libraryFamily,
        libraryBeamDeg: row.libraryBeamDeg,
      };
    }
    return collectOfficialExportSources({
      luminaireIds: ids,
      photoCache: photoCacheRef.current,
      sourceCache: sourceCacheRef.current,
      libraryCache,
      loadLuminaire: fetchLuminaireExport,
    });
  }

  const writeCalcDeps = useCallback((): WriteInstancesCalcDeps => {
    return {
      ensurePhotometry,
      getWatts: (luminaireId) => library.find((l) => l.id === luminaireId)?.watts,
      runSolver: runSolverClient,
    };
  }, [library, photoCache]);

  const luminaireNameMap = useCallback((): Record<string, string> => {
    const names: Record<string, string> = {};
    for (const l of library) names[l.id] = l.name;
    return names;
  }, [library]);

  useEffect(() => {
    for (const id of scene.fixtureLibraryIds) {
      if (!photoCache[id]) void ensurePhotometry(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.fixtureLibraryIds]);

  function sceneWithView(nextScene: ProjectSceneV2): ProjectSceneV2 {
    return {
      ...nextScene,
      ui: {
        ...nextScene.ui,
        camera3d: camera3dRef.current ?? nextScene.ui.camera3d ?? null,
      },
    };
  }

  latestRef.current = { name, scene, results };

  function snapshotNow() {
    const latest = latestRef.current;
    return {
      name: latest.name,
      scene: structuredClone(latest.scene),
      results: structuredClone(latest.results),
    };
  }

  function recordUndoFromLatest() {
    undoStackRef.current.push(snapshotNow());
    bumpUndoUi();
  }

  function applyEditorSnapshot(snap: {
    name: string;
    scene: ProjectSceneV2;
    results: ResultsV2;
  }) {
    latestRef.current = snap;
    setName(snap.name);
    setScene(snap.scene);
    setResults(snap.results);
  }

  function undoEdit() {
    if (readOnly) return;
    const next = undoStackRef.current.undo(snapshotNow());
    if (!next) return;
    coalesceRef.current = null;
    applyEditorSnapshot(next);
    bumpUndoUi();
    setStatus("Undid");
  }

  function redoEdit() {
    if (readOnly) return;
    const next = undoStackRef.current.redo(snapshotNow());
    if (!next) return;
    coalesceRef.current = null;
    applyEditorSnapshot(next);
    bumpUndoUi();
    setStatus("Redid");
  }

  function beginCoalesce(key: string) {
    if (coalesceRef.current === key) return;
    recordUndoFromLatest();
    coalesceRef.current = key;
  }

  function endCoalesce() {
    coalesceRef.current = null;
  }


  async function save(nextScene = scene, nextResults = results, nextName = name) {
    if (readOnly) return;
    if (saveInFlight.current) {
      saveQueued.current = true;
      return;
    }
    const toSave = sceneWithView(nextScene);
    const current = snapshotProject(nextName, toSave, nextResults);
    const body = projectPatchDiff(current, lastSavedRef.current, toSave, nextResults);
    if (!body) return;

    saveInFlight.current = true;
    setSaving(true);
    setScene(toSave);
    try {
      await officialWait.run(OFFICIAL_WAIT_COPY.saving, async () => {
        const { ok, updatedAt } = await patchProjectMinimal(projectId, body);
        if (ok) {
          lastSavedRef.current = current;
          reminderEpochRef.current = null;
          setSaveReminderOpen(false);
          setStatus("Saved");
          if (updatedAt && cacheUserId) {
            void officialWriteCachedProjectOpen({
              userId: cacheUserId,
              projectId,
              name: nextName,
              updatedAt,
              scene: persistableScene(toSave),
              results: nextResults,
              assets: assets.map((asset) => ({
                id: asset.id,
                kind: asset.kind,
                fileName: asset.fileName,
                metaJson: asset.metaJson,
                createdAt: asset.createdAt ?? "",
              })),
            });
          }
        } else {
          setStatus("Save failed");
        }
      });
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
    if (saveQueued.current) {
      saveQueued.current = false;
      const latest = latestRef.current;
      void save(latest.scene, latest.results, latest.name);
    }
  }

  useEffect(() => {
    if (readOnly) return;
    if (!accountLoaded) return;
    const toSave = sceneWithView(scene);
    const current = snapshotProject(name, toSave, results);
    const dirty = Boolean(projectPatchDiff(current, lastSavedRef.current, toSave, results));
    const epoch = startSaveReminderEpoch(dirty, reminderEpochRef.current, Date.now());
    reminderEpochRef.current = epoch;
    const due = saveReminderDue({
      dirty,
      intervalMs: autosaveMs,
      epochMs: epoch,
      nowMs: Date.now(),
    });
    if (!dirty || autosaveMs === 0) {
      setSaveReminderOpen(false);
      return;
    }
    if (due.due) {
      setSaveReminderOpen(true);
      return;
    }
    const timer = window.setTimeout(() => setSaveReminderOpen(true), due.remainingMs);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reminder interval on persistable data
  }, [name, scene, results, autosaveMs, accountLoaded, reminderGeneration]);

  function deferSaveReminder() {
    setSaveReminderOpen(false);
    reminderEpochRef.current = Date.now();
    setReminderGeneration((n) => n + 1);
  }

  function saveFromReminder() {
    const latest = latestRef.current;
    void save(latest.scene, latest.results, latest.name);
  }

  useEffect(() => {
    if (!activeRoom) return;
    setRoomHeightMm(String(Math.round(mToMm(activeRoom.heightM))));
  }, [activeRoom?.id, activeRoom?.heightM]);

  function patchScene(
    updater: (s: ProjectSceneV2) => ProjectSceneV2,
    opts?: { recordUndo?: boolean; coalesce?: string; viewOnlySafe?: boolean }
  ) {
    if (readOnly && !opts?.viewOnlySafe) return;
    if (opts?.recordUndo !== false) {
      if (opts?.coalesce) beginCoalesce(opts.coalesce);
      else if (coalesceRef.current !== "drag") {
        recordUndoFromLatest();
        coalesceRef.current = null;
      }
    }
    setScene((s) => updater(s));
  }

  function patchSceneUi(updater: (s: ProjectSceneV2) => ProjectSceneV2) {
    patchScene(updater, { recordUndo: false, viewOnlySafe: true });
  }


  function addStorey() {
    if (readOnly) return;
    const id = nid("storey");
    patchScene((s) => officialAppendStorey(s, { id }));
  }

  function copyStorey() {
    if (readOnly) return;
    endCoalesce();
    const result = officialCopyStorey(scene, {
      storeyId: nid("storey"),
      nextRoomId: () => nid("room"),
      nextInstanceId: () => nid("fix"),
    });
    setStatus(result.status);
    if (result.ok) {
      patchScene(() => result.scene);
    }
  }

  function applyStoreyMetrics(patch: { elevationM?: number; heightM?: number }) {
    if (readOnly) return;
    const storeyId = activeStorey?.id;
    if (!storeyId) return;
    patchScene((s) => applyOfficialStoreyMetrics(s, storeyId, patch));
  }

  function applyRoomHeightMm(raw: string) {
    if (readOnly) return;
    setRoomHeightMm(raw);
    const selectedId = activeRoom?.id ?? null;
    if (!selectedId) return;
    patchScene((s) => applyOfficialRoomHeightMm(s, raw, selectedId).scene);
  }

  function resolveNewRoomHeightM(): number {
    const storey = scene.storeys.find((st) => st.id === scene.ui.activeStoreyId);
    return resolveOfficialNewRoomHeightM(
      roomHeightMm,
      storey?.heightM ?? DEFAULT_NEW_ROOM_HEIGHT_M
    );
  }

  function refuseUncalibratedDrawRoom(): boolean {
    const blocked = officialDrawRoomBlockedReason(underlay);
    if (!blocked) return false;
    setStatus(blocked);
    return true;
  }

  function selectEditorTool(tool: ProjectSceneV2["ui"]["tool"]) {
    if (readOnly && tool !== "select") return;
    if ((tool === "drawRoom" || tool === "drawStoreyContour") && refuseUncalibratedDrawRoom()) return;
    if (booleanPick.active && tool !== "select") {
      setBooleanPick(EMPTY_OFFICIAL_TWO_ROOM_PICK);
    }
    if (distributePick.active && tool !== "select") {
      setDistributePick(EMPTY_ROOM_DISTRIBUTE_PICK);
    }
    if (filletPick.active && tool !== "select") {
      setFilletPick(EMPTY_ROOM_FILLET_PICK);
    }
    if (filletAllPick.active && tool !== "select") {
      setFilletAllPick(EMPTY_ROOM_FILLET_ALL_PICK);
    }
    patchSceneUi((s) => ({ ...s, ui: { ...s.ui, tool } }));
  }

  function drawRoomPolygon(points: Vec2[]) {
    if (refuseUncalibratedDrawRoom()) return;
    const valid = officialValidateSimplePolygon(points);
    if (!valid.ok) {
      setStatus(
        valid.reason === "self-crossing"
          ? "Room refused: the outline would cross itself."
          : valid.reason === "area"
            ? "Room refused: the area would be below 0.01 m²."
            : "Need at least 3 unique corners to close a room"
      );
      return;
    }
    const id = nid("room");
    const heightM = resolveNewRoomHeightM();
    const preview = officialAppendDrawnRoom(scene, { id, polygon: points, heightM });
    setStatus(preview.status);
    if (!preview.created) return;
    patchScene((s) => officialAppendDrawnRoom(s, { id, polygon: points, heightM }).scene);
  }

  function drawStoreyContour(points: Vec2[]) {
    if (refuseUncalibratedDrawRoom()) return;
    const preview = officialSetStoreyOutline(scene, scene.ui.activeStoreyId, points);
    setStatus(preview.status);
    if (!preview.ok) return;
    patchScene((s) => officialSetStoreyOutline(s, s.ui.activeStoreyId, points).scene);
  }

  function createRectRoom() {
    if (readOnly) return;
    if (refuseUncalibratedDrawRoom()) return;
    const lengthM = parseLengthToM(rectLenMm);
    const widthM = parseLengthToM(rectWidMm);
    if (!(lengthM && lengthM >= 0.05) || !(widthM && widthM >= 0.05)) {
      setStatus("Enter length and width in mm (or with m / cm suffix)");
      return;
    }
    drawRoomPolygon(rectPolygon(0, 0, lengthM, widthM));
  }

  async function runOfficialBuildFromPlan() {
    const heightM = resolveNewRoomHeightM();
    await officialWait.run(OFFICIAL_WAIT_COPY.creatingRoomsFromDxf, async () => {
      const prepared = officialEnsureActiveStoreyForPlanBuild(scene, () => nid("storey"));
      const storeyId = prepared.ui.activeStoreyId;
      const underlay = prepared.underlays.find((u) => u.storeyId === storeyId) ?? null;
      const storey = prepared.storeys.find((s) => s.id === storeyId);
      const existingOutline =
        storey && Array.isArray(storey.outline) && storey.outline.length >= 3
          ? storey.outline
          : null;

      const res = await fetch(`/api/projects/${projectId}/build-from-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: underlay?.assetId ?? null,
          hiddenLayers: underlay?.hiddenLayers ?? [],
          underlay: underlay
            ? {
                kind: underlay.kind,
                dxfEntities: underlay.dxfEntities ?? [],
                metersPerUnit: underlay.metersPerUnit,
                offsetX: underlay.offsetX,
                offsetY: underlay.offsetY,
              }
            : null,
          replaceExistingOutline: true,
        }),
      });
      const local = (await res.json().catch(() => ({}))) as {
        error?: string;
        outline?: { x: number; y: number }[] | null;
        outlineCreated?: boolean;
        outlineExisting?: boolean;
        outlineFailed?: boolean;
        layoutFound?: boolean;
        rooms?: { x: number; y: number }[][];
        analysis?: unknown;
        sourceUsed?: "full" | "visible-fallback";
        shouldAnalyseLeftover?: boolean;
        architecturalLayersHidden?: boolean;
      };
      if (!res.ok) {
        setStatus(local.error || "Could not build the storey and rooms from the plan.");
        return;
      }

      let next = prepared;
      let created = 0;
      let outlineCreated = false;
      let outlineReplaced = false;
      const apply = (outline: { x: number; y: number }[] | null | undefined, rooms: { x: number; y: number }[][]) => {
        const applied = officialApplyFromPlanGeometry(next, {
          outline: outline ?? null,
          rooms,
          heightM,
          nextRoomId: () => nid("room"),
          keepExistingOutline: false,
        });
        next = applied.scene;
        created += applied.created;
        outlineCreated = outlineCreated || applied.outlineCreated;
        outlineReplaced = outlineReplaced || applied.outlineReplaced;
      };

      const usedFullSource = local.sourceUsed === "full";
      const architecturalLayersHidden = Boolean(local.architecturalLayersHidden);
      const contourStatus = () => ({
        outlineCreated,
        outlineExisting: Boolean(existingOutline) && !outlineReplaced && !outlineCreated,
        outlineReplaced,
        outlineFailed: Boolean(local.outlineFailed),
        usedFullSource,
        architecturalLayersHidden,
      });
      const aiFailReasonOf = (reason: OfficialFromPlanAiFailReason | undefined) =>
        reason === "timeout" ||
        reason === "model-unavailable" ||
        reason === "provider-error" ||
        reason === "invalid-response"
          ? reason
          : undefined;

      const localRooms = local.layoutFound ? (local.rooms ?? []) : [];
      if (local.outline && !local.outlineFailed) {
        apply(local.outline, localRooms);
      }

      const layoutCreated = created;
      const shouldAnalyse =
        Boolean(local.outline && !local.outlineFailed) &&
        (local.shouldAnalyseLeftover === true || (!local.layoutFound && Boolean(local.outline && !local.outlineFailed)));

      if (shouldAnalyse) {
        officialWait.updateCopy(OFFICIAL_WAIT_COPY.analysingRooms);
        await officialWaitBeforeWork();
        const aiRes = await fetch(`/api/projects/${projectId}/analyse-rooms`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            analysis: local.analysis,
            outline: local.outline,
          }),
        });
        const ai = (await aiRes.json().catch(() => ({}))) as {
          configured?: boolean;
          failed?: boolean;
          failReason?: OfficialFromPlanAiFailReason;
          rooms?: { x: number; y: number }[][];
          error?: string;
        };
        if (!aiRes.ok) {
          setStatus(
            formatOfficialFromPlanStatus({
              ...contourStatus(),
              created: layoutCreated,
              layoutCreated,
              aiCreated: 0,
              aiLeftoverAttempted: layoutCreated > 0,
              roomSource: layoutCreated > 0 ? "layout" : "none",
              aiFailed: true,
              aiFailReason: aiRes.status === 408 ? "timeout" : undefined,
            })
          );
        } else if (!ai.configured) {
          setStatus(
            formatOfficialFromPlanStatus({
              ...contourStatus(),
              created: layoutCreated,
              layoutCreated,
              aiCreated: 0,
              aiLeftoverAttempted: layoutCreated > 0,
              roomSource: layoutCreated > 0 ? "layout" : "none",
              aiConfigured: false,
            })
          );
        } else {
          const beforeAi = created;
          apply(null, ai.rooms ?? []);
          const aiCreated = created - beforeAi;
          setStatus(
            formatOfficialFromPlanStatus({
              ...contourStatus(),
              created,
              layoutCreated,
              aiCreated,
              aiLeftoverAttempted: layoutCreated > 0,
              roomSource:
                layoutCreated > 0 ? "layout" : ai.failed && aiCreated === 0 ? "none" : "ai",
              aiConfigured: true,
              aiFailed: Boolean(ai.failed) && aiCreated === 0,
              aiFailReason: aiFailReasonOf(ai.failReason),
            })
          );
        }
      } else if (layoutCreated > 0) {
        setStatus(
          formatOfficialFromPlanStatus({
            ...contourStatus(),
            created: layoutCreated,
            layoutCreated,
            roomSource: "layout",
          })
        );
      } else {
        setStatus(
          formatOfficialFromPlanStatus({
            ...contourStatus(),
            created: 0,
            roomSource: "none",
          })
        );
      }

      const changed =
        created > 0 ||
        outlineCreated ||
        outlineReplaced ||
        next.storeys.length !== scene.storeys.length ||
        next.ui.activeStoreyId !== scene.ui.activeStoreyId;
      if (changed) {
        patchScene(() => next);
      }
    });
  }

  async function createRoomsFromDxf() {
    await runOfficialBuildFromPlan();
  }

  async function createStoreyAndRoomsFromPlan() {
    setAskBuildAfterPlanOpen(false);
    await runOfficialBuildFromPlan();
  }

  function currentStoreyRoomIds(): string[] {
    const storeyId = scene.ui.activeStoreyId;
    return scene.rooms.filter((room) => room.storeyId === storeyId).map((room) => room.id);
  }

  function startUnionRooms() {
    if (distributePick.active) {
      setDistributePick(EMPTY_ROOM_DISTRIBUTE_PICK);
    }
    if (filletPick.active) {
      setFilletPick(EMPTY_ROOM_FILLET_PICK);
    }
    if (filletAllPick.active) {
      setFilletAllPick(EMPTY_ROOM_FILLET_ALL_PICK);
    }
    if (booleanPick.active && booleanPick.kind === "union") {
      setBooleanPick(EMPTY_OFFICIAL_TWO_ROOM_PICK);
      setStatus(UNION_ROOMS_CANCELLED_STATUS);
      return;
    }
    selectEditorTool("select");
    const next = startOfficialRoomUnionPick(scene.ui.activeRoomId, currentStoreyRoomIds());
    setBooleanPick({ ...next, kind: "union" });
    setStatus(
      next.firstRoomId ? UNION_ROOMS_PICK_SECOND_STATUS : UNION_ROOMS_PICK_FIRST_STATUS
    );
  }

  function startSubtractRooms() {
    if (distributePick.active) {
      setDistributePick(EMPTY_ROOM_DISTRIBUTE_PICK);
    }
    if (filletPick.active) {
      setFilletPick(EMPTY_ROOM_FILLET_PICK);
    }
    if (filletAllPick.active) {
      setFilletAllPick(EMPTY_ROOM_FILLET_ALL_PICK);
    }
    if (booleanPick.active && booleanPick.kind === "subtract") {
      setBooleanPick(EMPTY_OFFICIAL_TWO_ROOM_PICK);
      setStatus(SUBTRACT_ROOMS_CANCELLED_STATUS);
      return;
    }
    selectEditorTool("select");
    const next = startOfficialRoomSubtractPick(scene.ui.activeRoomId, currentStoreyRoomIds());
    setBooleanPick({ ...next, kind: "subtract" });
    setStatus(
      next.firstRoomId ? SUBTRACT_ROOMS_PICK_SECOND_STATUS : SUBTRACT_ROOMS_PICK_FIRST_STATUS
    );
  }

  function startIntersectRooms() {
    if (distributePick.active) {
      setDistributePick(EMPTY_ROOM_DISTRIBUTE_PICK);
    }
    if (filletPick.active) {
      setFilletPick(EMPTY_ROOM_FILLET_PICK);
    }
    if (filletAllPick.active) {
      setFilletAllPick(EMPTY_ROOM_FILLET_ALL_PICK);
    }
    if (booleanPick.active && booleanPick.kind === "intersect") {
      setBooleanPick(EMPTY_OFFICIAL_TWO_ROOM_PICK);
      setStatus(INTERSECT_ROOMS_CANCELLED_STATUS);
      return;
    }
    selectEditorTool("select");
    const next = startOfficialRoomIntersectPick(scene.ui.activeRoomId, currentStoreyRoomIds());
    setBooleanPick({ ...next, kind: "intersect" });
    setStatus(
      next.firstRoomId ? INTERSECT_ROOMS_PICK_SECOND_STATUS : INTERSECT_ROOMS_PICK_FIRST_STATUS
    );
  }

  function startXorRooms() {
    if (distributePick.active) {
      setDistributePick(EMPTY_ROOM_DISTRIBUTE_PICK);
    }
    if (filletPick.active) {
      setFilletPick(EMPTY_ROOM_FILLET_PICK);
    }
    if (filletAllPick.active) {
      setFilletAllPick(EMPTY_ROOM_FILLET_ALL_PICK);
    }
    if (booleanPick.active && booleanPick.kind === "xor") {
      setBooleanPick(EMPTY_OFFICIAL_TWO_ROOM_PICK);
      setStatus(XOR_ROOMS_CANCELLED_STATUS);
      return;
    }
    selectEditorTool("select");
    const next = startOfficialRoomXorPick(scene.ui.activeRoomId, currentStoreyRoomIds());
    setBooleanPick({ ...next, kind: "xor" });
    setStatus(
      next.firstRoomId ? XOR_ROOMS_PICK_SECOND_STATUS : XOR_ROOMS_PICK_FIRST_STATUS
    );
  }

  function startAlignRooms() {
    if (distributePick.active) {
      setDistributePick(EMPTY_ROOM_DISTRIBUTE_PICK);
    }
    if (filletPick.active) {
      setFilletPick(EMPTY_ROOM_FILLET_PICK);
    }
    if (filletAllPick.active) {
      setFilletAllPick(EMPTY_ROOM_FILLET_ALL_PICK);
    }
    if (booleanPick.active && booleanPick.kind === "align") {
      setBooleanPick(EMPTY_OFFICIAL_TWO_ROOM_PICK);
      setStatus(ALIGN_ROOMS_CANCELLED_STATUS);
      return;
    }
    selectEditorTool("select");
    const next = startOfficialRoomAlignPick(scene.ui.activeRoomId, currentStoreyRoomIds());
    setBooleanPick({ ...next, kind: "align" });
    setStatus(
      next.firstRoomId ? ALIGN_ROOMS_PICK_SECOND_STATUS : ALIGN_ROOMS_PICK_FIRST_STATUS
    );
  }

  function startDistributeRooms() {
    if (distributePick.active) {
      setDistributePick(EMPTY_ROOM_DISTRIBUTE_PICK);
      setStatus(DISTRIBUTE_ROOMS_CANCELLED_STATUS);
      return;
    }
    selectEditorTool("select");
    setBooleanPick(EMPTY_OFFICIAL_TWO_ROOM_PICK);
    setFilletPick(EMPTY_ROOM_FILLET_PICK);
    setFilletAllPick(EMPTY_ROOM_FILLET_ALL_PICK);
    const next = startOfficialRoomDistributePick(scene.ui.activeRoomId, currentStoreyRoomIds());
    setDistributePick(next);
    setStatus(distributeRoomsPickHint(next));
  }

  function startFilletCorner() {
    if (filletPick.active) {
      setFilletPick(EMPTY_ROOM_FILLET_PICK);
      setStatus(FILLET_CORNER_CANCELLED_STATUS);
      return;
    }
    selectEditorTool("select");
    setBooleanPick(EMPTY_OFFICIAL_TWO_ROOM_PICK);
    setDistributePick(EMPTY_ROOM_DISTRIBUTE_PICK);
    setFilletAllPick(EMPTY_ROOM_FILLET_ALL_PICK);
    const next = startOfficialRoomFilletPick(scene.ui.activeRoomId, currentStoreyRoomIds());
    setFilletPick(next);
    setStatus(filletCornerPickHint(next));
  }

  function startFilletAllCorners() {
    if (filletAllPick.active) {
      setFilletAllPick(EMPTY_ROOM_FILLET_ALL_PICK);
      setStatus(FILLET_ALL_CORNERS_CANCELLED_STATUS);
      return;
    }
    selectEditorTool("select");
    setBooleanPick(EMPTY_OFFICIAL_TWO_ROOM_PICK);
    setDistributePick(EMPTY_ROOM_DISTRIBUTE_PICK);
    setFilletPick(EMPTY_ROOM_FILLET_PICK);
    const started = startOfficialRoomFilletAllPick(scene.ui.activeRoomId, currentStoreyRoomIds());
    if (started.kind === "apply") {
      applyFilletAllCorners(started.roomId);
      return;
    }
    setFilletAllPick(started.state);
    setStatus(started.status);
  }

  function booleanPickCancelledStatus(kind: OfficialTwoRoomPickKind): string {
    if (kind === "subtract") return SUBTRACT_ROOMS_CANCELLED_STATUS;
    if (kind === "intersect") return INTERSECT_ROOMS_CANCELLED_STATUS;
    if (kind === "xor") return XOR_ROOMS_CANCELLED_STATUS;
    if (kind === "align") return ALIGN_ROOMS_CANCELLED_STATUS;
    return UNION_ROOMS_CANCELLED_STATUS;
  }

  function booleanPickFirstStatus(kind: OfficialTwoRoomPickKind): string {
    if (kind === "subtract") return SUBTRACT_ROOMS_PICK_FIRST_STATUS;
    if (kind === "intersect") return INTERSECT_ROOMS_PICK_FIRST_STATUS;
    if (kind === "xor") return XOR_ROOMS_PICK_FIRST_STATUS;
    if (kind === "align") return ALIGN_ROOMS_PICK_FIRST_STATUS;
    return UNION_ROOMS_PICK_FIRST_STATUS;
  }

  function cancelUnionRoomsPick() {
    if (distributePick.active) {
      setDistributePick(EMPTY_ROOM_DISTRIBUTE_PICK);
      setStatus(DISTRIBUTE_ROOMS_CANCELLED_STATUS);
      return;
    }
    if (!booleanPick.active) return;
    const cancelled = booleanPickCancelledStatus(booleanPick.kind);
    setBooleanPick(EMPTY_OFFICIAL_TWO_ROOM_PICK);
    setStatus(cancelled);
  }

  function onDistributeApply() {
    const picked = applyOfficialRoomDistributeCommit(distributePick);
    if (picked.kind !== "distribute") {
      setStatus(picked.status);
      return;
    }
    endCoalesce();
    const result = officialDistributeRooms(scene, picked.roomIds, distributeAxis);
    setStatus(result.status);
    if (result.ok) {
      setDistributePick(EMPTY_ROOM_DISTRIBUTE_PICK);
      patchScene(() => result.scene);
    }
  }

  function cancelFilletCornerPick() {
    if (!filletPick.active) return;
    setFilletPick(EMPTY_ROOM_FILLET_PICK);
    setStatus(FILLET_CORNER_CANCELLED_STATUS);
  }

  function cancelFilletAllCornersPick() {
    if (!filletAllPick.active) return;
    setFilletAllPick(EMPTY_ROOM_FILLET_ALL_PICK);
    setStatus(FILLET_ALL_CORNERS_CANCELLED_STATUS);
  }

  function onFilletAllPickRoom(roomId: string) {
    const room = scene.rooms.find((r) => r.id === roomId);
    if (!room) {
      setStatus(filletAllCornersPickHint(filletAllPick) || FILLET_ALL_CORNERS_PICK_ROOM_STATUS);
      return;
    }
    const picked = applyOfficialRoomFilletAllPick(
      filletAllPick,
      room.id,
      room.storeyId,
      scene.ui.activeStoreyId
    );
    if (picked.kind !== "apply") {
      setStatus(picked.status);
      return;
    }
    applyFilletAllCorners(picked.roomId);
  }

  function onFilletPickRoom(roomId: string) {
    const room = scene.rooms.find((r) => r.id === roomId);
    if (!room) {
      setStatus(filletCornerPickHint(filletPick));
      return;
    }
    const picked = applyOfficialRoomFilletPick(
      filletPick,
      room.id,
      room.storeyId,
      scene.ui.activeStoreyId
    );
    if (picked.kind === "status" && picked.selectRoomId) {
      patchSceneUi((s) => ({
        ...s,
        ui: { ...s.ui, activeRoomId: picked.selectRoomId ?? null },
      }));
    }
    setFilletPick(picked.state);
    setStatus(picked.status);
  }

  function onFilletCornerPick(roomId: string, vertexIndex: number) {
    if (filletPick.roomId && filletPick.roomId !== roomId) {
      onFilletPickRoom(roomId);
      return;
    }
    if (!filletPick.roomId) {
      const room = scene.rooms.find((r) => r.id === roomId);
      if (!room) {
        setStatus(filletCornerPickHint(filletPick));
        return;
      }
      const pickedRoom = applyOfficialRoomFilletPick(
        filletPick,
        room.id,
        room.storeyId,
        scene.ui.activeStoreyId
      );
      if (pickedRoom.kind !== "status" || !pickedRoom.state.roomId) {
        setFilletPick(pickedRoom.state);
        setStatus(pickedRoom.status);
        return;
      }
      if (pickedRoom.selectRoomId) {
        patchSceneUi((s) => ({
          ...s,
          ui: { ...s.ui, activeRoomId: pickedRoom.selectRoomId ?? null },
        }));
      }
      setFilletPick(pickedRoom.state);
      const picked = applyOfficialRoomFilletCornerPick(pickedRoom.state, vertexIndex);
      if (picked.kind !== "fillet") {
        setStatus(picked.status);
        return;
      }
      applyFilletCorner(picked.roomId, picked.vertexIndex);
      return;
    }
    const picked = applyOfficialRoomFilletCornerPick(filletPick, vertexIndex);
    if (picked.kind !== "fillet") {
      setStatus(picked.status);
      return;
    }
    applyFilletCorner(picked.roomId, picked.vertexIndex);
  }

  function applyFilletCorner(roomId: string, vertexIndex: number) {
    const radiusM = parseLengthToM(filletRadiusMm);
    if (!(radiusM && radiusM > 0)) {
      setStatus(FILLET_CORNER_REFUSE_RADIUS_STATUS);
      return;
    }
    endCoalesce();
    const result = officialFilletRoomCorner(scene, roomId, vertexIndex, radiusM);
    setStatus(result.status);
    if (result.ok) {
      setFilletPick(EMPTY_ROOM_FILLET_PICK);
      patchScene(() => result.scene);
    }
  }

  function applyFilletAllCorners(roomId: string) {
    const radiusM = parseLengthToM(filletRadiusMm);
    if (!(radiusM && radiusM > 0)) {
      setStatus(FILLET_ALL_CORNERS_REFUSE_RADIUS_STATUS);
      return;
    }
    endCoalesce();
    const result = officialFilletRoomAllCorners(scene, roomId, radiusM);
    setStatus(result.status);
    if (result.ok) {
      setFilletAllPick(EMPTY_ROOM_FILLET_ALL_PICK);
      patchScene(() => result.scene);
    }
  }

  function onUnionRoomPick(roomId: string) {
    const room = scene.rooms.find((r) => r.id === roomId);
    if (!room) {
      if (distributePick.active) {
        setStatus(distributeRoomsPickHint(distributePick));
        return;
      }
      setStatus(booleanPickFirstStatus(booleanPick.kind));
      return;
    }
    if (distributePick.active) {
      const picked = applyOfficialRoomDistributePick(
        distributePick,
        room.id,
        room.storeyId,
        scene.ui.activeStoreyId
      );
      if (picked.selectRoomId) {
        patchSceneUi((s) => ({
          ...s,
          ui: { ...s.ui, activeRoomId: picked.selectRoomId ?? null },
        }));
      }
      setDistributePick(picked.state);
      setStatus(picked.status);
      return;
    }
    if (booleanPick.kind === "align") {
      const picked = applyOfficialRoomAlignPick(
        booleanPick,
        room.id,
        room.storeyId,
        scene.ui.activeStoreyId
      );
      if (picked.selectRoomId) {
        patchSceneUi((s) => ({
          ...s,
          ui: { ...s.ui, activeRoomId: picked.selectRoomId ?? null },
        }));
      }
      if (picked.kind !== "align") {
        setBooleanPick({ ...picked.state, kind: "align" });
        setStatus(picked.status);
        return;
      }
      endCoalesce();
      const result = officialAlignRooms(scene, picked.referenceId, picked.movingId, alignAxis);
      setStatus(result.status);
      if (result.ok) {
        setBooleanPick(EMPTY_OFFICIAL_TWO_ROOM_PICK);
        patchScene(() => result.scene);
        return;
      }
      setBooleanPick({ ...picked.state, kind: "align" });
      return;
    }
    if (booleanPick.kind === "xor") {
      const picked = applyOfficialRoomXorPick(
        booleanPick,
        room.id,
        room.storeyId,
        scene.ui.activeStoreyId
      );
      if (picked.selectRoomId) {
        patchSceneUi((s) => ({
          ...s,
          ui: { ...s.ui, activeRoomId: picked.selectRoomId ?? null },
        }));
      }
      if (picked.kind !== "xor") {
        setBooleanPick({ ...picked.state, kind: "xor" });
        setStatus(picked.status);
        return;
      }
      endCoalesce();
      const result = officialXorRooms(scene, picked.keepId, picked.removeId);
      setStatus(result.status);
      if (result.ok) {
        setBooleanPick(EMPTY_OFFICIAL_TWO_ROOM_PICK);
        patchScene(() => result.scene);
        return;
      }
      setBooleanPick({ ...picked.state, kind: "xor" });
      return;
    }
    if (booleanPick.kind === "intersect") {
      const picked = applyOfficialRoomIntersectPick(
        booleanPick,
        room.id,
        room.storeyId,
        scene.ui.activeStoreyId
      );
      if (picked.selectRoomId) {
        patchSceneUi((s) => ({
          ...s,
          ui: { ...s.ui, activeRoomId: picked.selectRoomId ?? null },
        }));
      }
      if (picked.kind !== "intersect") {
        setBooleanPick({ ...picked.state, kind: "intersect" });
        setStatus(picked.status);
        return;
      }
      endCoalesce();
      const result = officialIntersectRooms(scene, picked.keepId, picked.removeId);
      setStatus(result.status);
      if (result.ok) {
        setBooleanPick(EMPTY_OFFICIAL_TWO_ROOM_PICK);
        patchScene(() => result.scene);
        return;
      }
      setBooleanPick({ ...picked.state, kind: "intersect" });
      return;
    }
    if (booleanPick.kind === "subtract") {
      const picked = applyOfficialRoomSubtractPick(
        booleanPick,
        room.id,
        room.storeyId,
        scene.ui.activeStoreyId
      );
      if (picked.selectRoomId) {
        patchSceneUi((s) => ({
          ...s,
          ui: { ...s.ui, activeRoomId: picked.selectRoomId ?? null },
        }));
      }
      if (picked.kind !== "subtract") {
        setBooleanPick({ ...picked.state, kind: "subtract" });
        setStatus(picked.status);
        return;
      }
      endCoalesce();
      const result = officialSubtractRooms(scene, picked.keepId, picked.cutterId);
      setStatus(result.status);
      if (result.ok) {
        setBooleanPick(EMPTY_OFFICIAL_TWO_ROOM_PICK);
        patchScene(() => result.scene);
        return;
      }
      setBooleanPick({ ...picked.state, kind: "subtract" });
      return;
    }
    const picked = applyOfficialRoomUnionPick(
      booleanPick,
      room.id,
      room.storeyId,
      scene.ui.activeStoreyId
    );
    if (picked.selectRoomId) {
      patchSceneUi((s) => ({
        ...s,
        ui: { ...s.ui, activeRoomId: picked.selectRoomId ?? null },
      }));
    }
    if (picked.kind !== "union") {
      setBooleanPick({ ...picked.state, kind: "union" });
      setStatus(picked.status);
      return;
    }
    endCoalesce();
    const result = officialUnionRooms(scene, picked.keepId, picked.removeId);
    setStatus(result.status);
    if (result.ok) {
      setBooleanPick(EMPTY_OFFICIAL_TWO_ROOM_PICK);
      patchScene(() => result.scene);
      return;
    }
    setBooleanPick({ ...picked.state, kind: "union" });
  }

  async function onUploadPhotometry(file: File | null) {
    if (!file) return;
    setUploading(true);
    setStatus(null);
    try {
      await officialWait.run(OFFICIAL_WAIT_COPY.importingPhotometry, async () => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/luminaires", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error || "Upload failed");
        return;
      }
      const imported = (Array.isArray(data.luminaires) && data.luminaires.length
        ? data.luminaires
        : data.luminaire
          ? [data.luminaire]
          : []) as LumRow[];
      if (imported.length === 0) {
        setStatus(data.error || "Upload failed");
        return;
      }
      await loadLibrary();
      for (const lum of imported) {
        await ensurePhotometry(lum.id);
      }
      const ids = imported.map((lum) => lum.id);
      patchScene((s) => ({
        ...s,
        fixtureLibraryIds: [
          ...s.fixtureLibraryIds,
          ...ids.filter((id) => !s.fixtureLibraryIds.includes(id)),
        ],
      }));
      const first = imported[0]!;
      setStatus(
        imported.length === 1
          ? `Imported “${first.name}” to project fixture list (not placed)`
          : `Imported ${imported.length} luminaires to project fixture list (not placed)`,
      );
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function addFromLibrary(luminaireId: string) {
    if (readOnly) return;
    if (!luminaireId) return;
    patchScene((s) => ({
      ...s,
      fixtureLibraryIds: s.fixtureLibraryIds.includes(luminaireId)
        ? s.fixtureLibraryIds
        : [...s.fixtureLibraryIds, luminaireId],
    }));
    void ensurePhotometry(luminaireId);
    setStatus("Added to project fixture list");
  }

  function placeAt(luminaireId: string, x: number, y: number, z?: number) {
    if (readOnly) return;
    const room = findRoomAt(scene.rooms, scene.ui.activeStoreyId, { x, y });
    if (!room) {
      setStatus("Drop inside a room outline");
      return;
    }
    const lib = library.find((l) => l.id === luminaireId);
    const photo = photoCache[luminaireId];
    const mountZ = z ?? room.heightM - 0.1;
    requestFixtureWrite([room.id], () => {
    void (async () => {
      try {
        const latest = latestRef.current;
        const out = await writeFixtureInstances(
          {
            scene: latest.scene,
            results: latest.results,
            drafts: [
              {
                luminaireId,
                storeyId: latest.scene.ui.activeStoreyId,
                roomId: room.id,
                name: lib?.name ?? photo?.description ?? "Fixture",
                position: { x, y, z: mountZ },
                rotationDeg: 0,
              },
            ],
            options: {
              runCalc: calcAfterPlace,
              calcScope: "room",
            },
          },
          writeCalcDeps()
        );
        const nextScene = focusActiveRoomAfterPlacement(out.scene, out.affectedRoomIds);
        recordUndoFromLatest();
        setScene(nextScene);
        setResults(out.results);
        setSelectedId(out.instanceIds[0] ?? null);
        const calcNote = postPlaceCalcStatusSuffix(
          {
            results: out.results,
            calcFailed: out.calcFailed ?? false,
            missingLuminaireIds: out.missingLuminaireIds ?? [],
            errorMessage: out.calcErrorMessage,
          },
          calcAfterPlace
        );
        setStatus(`Placed in ${room.name}${calcNote}`);
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "Placement failed");
      }
    })();
    });
  }

  function requestFixtureWrite(roomIds: string[], apply: () => void) {
    if (readOnly) return;
    const decision = decideFixtureChange(latestRef.current.results, roomIds);
    if (decision.action === "apply") {
      apply();
      return;
    }
    pendingFixtureApplyRef.current = apply;
    setPendingDiscardRoomIds(decision.roomIdsToClear);
  }

  function confirmDiscardResults() {
    if (readOnly) return;
    const roomIds = pendingDiscardRoomIds;
    const apply = pendingFixtureApplyRef.current;
    pendingFixtureApplyRef.current = null;
    setPendingDiscardRoomIds(null);
    if (!roomIds) return;
    setResults((r) => clearResultsForRooms(r, roomIds));
    apply?.();
  }

  function cancelDiscardResults() {
    pendingFixtureApplyRef.current = null;
    setPendingDiscardRoomIds(null);
  }

  function beginMoveInstance(instanceId: string): boolean {
    if (readOnly) return false;
    const inst = latestRef.current.scene.instances.find((i) => i.instanceId === instanceId);
    const roomIds = inst?.roomId ? [inst.roomId] : [];
    const decision = decideFixtureChange(latestRef.current.results, roomIds);
    if (decision.action === "apply") return true;
    pendingFixtureApplyRef.current = null;
    setPendingDiscardRoomIds(decision.roomIdsToClear);
    return false;
  }

  function updateInstanceRotation(instanceId: string, rotationDeg: number) {
    if (readOnly) return;
    const inst = latestRef.current.scene.instances.find((i) => i.instanceId === instanceId);
    requestFixtureWrite(inst?.roomId ? [inst.roomId] : [], () => {
      patchScene((s) => ({
        ...s,
        instances: s.instances.map((i) =>
          i.instanceId === instanceId ? { ...i, rotationDeg } : i
        ),
      }));
    });
  }

  function updateInstancePosition(instanceId: string, axis: "x" | "y" | "z", value: number) {
    if (readOnly) return;
    const inst = latestRef.current.scene.instances.find((i) => i.instanceId === instanceId);
    requestFixtureWrite(inst?.roomId ? [inst.roomId] : [], () => {
      patchScene((s) => ({
        ...s,
        instances: s.instances.map((i) =>
          i.instanceId === instanceId
            ? { ...i, position: { ...i.position, [axis]: value } }
            : i
        ),
      }));
    });
  }

  function removeInstance(instanceId: string) {
    if (readOnly) return;
    const inst = latestRef.current.scene.instances.find((i) => i.instanceId === instanceId);
    requestFixtureWrite(inst?.roomId ? [inst.roomId] : [], () => {
      patchScene((s) => ({
        ...s,
        instances: s.instances.filter((i) => i.instanceId !== instanceId),
      }));
      setSelectedId((id) => (id === instanceId ? null : id));
    });
  }

  function moveRoom(roomId: string, dx: number, dy: number) {
    if (readOnly) return;
    if (dx === 0 && dy === 0) return;
    if (coalesceRef.current !== "drag") {
      beginCoalesce("drag");
      const end = () => {
        if (coalesceRef.current === "drag") coalesceRef.current = null;
        window.removeEventListener("mouseup", end);
      };
      window.addEventListener("mouseup", end);
    }
    patchScene((s) => officialTranslateRoom(s, roomId, dx, dy));
  }

  function setRoomPolygon(
    roomId: string,
    polygon: { x: number; y: number }[],
    opts?: { discrete?: boolean }
  ) {
    if (opts?.discrete) {
      endCoalesce();
      patchScene((s) => officialSetRoomPolygon(s, roomId, polygon));
      return;
    }
    if (coalesceRef.current !== "drag") {
      beginCoalesce("drag");
      const end = () => {
        if (coalesceRef.current === "drag") coalesceRef.current = null;
        window.removeEventListener("mouseup", end);
      };
      window.addEventListener("mouseup", end);
    }
    patchScene((s) => officialSetRoomPolygon(s, roomId, polygon));
  }

  function moveStorey(storeyId: string, dx: number, dy: number) {
    if (readOnly) return;
    if (dx === 0 && dy === 0) return;
    if (coalesceRef.current !== "drag") {
      beginCoalesce("drag");
      const end = () => {
        if (coalesceRef.current === "drag") coalesceRef.current = null;
        window.removeEventListener("mouseup", end);
      };
      window.addEventListener("mouseup", end);
    }
    patchScene((s) => officialTranslateStorey(s, storeyId, dx, dy));
  }

  function moveInstance(instanceId: string, x: number, y: number, z?: number) {
    if (readOnly) return;
    if (coalesceRef.current !== "drag") {
      beginCoalesce("drag");
      const end = () => {
        if (coalesceRef.current === "drag") coalesceRef.current = null;
        window.removeEventListener("mouseup", end);
      };
      window.addEventListener("mouseup", end);
    }
    const currentScene = latestRef.current.scene;
    const current = currentScene.instances.find((i) => i.instanceId === instanceId);
    const room =
      findRoomAt(currentScene.rooms, currentScene.ui.activeStoreyId, { x, y }) ??
      currentScene.rooms.find((r) => r.id === current?.roomId) ??
      null;
    const clearIds = [current?.roomId, room?.id].filter((id): id is string => Boolean(id));
    if (clearIds.length) {
      setResults((r) => clearResultsForRooms(r, clearIds));
    }
    patchScene((s) => ({
      ...s,
      instances: s.instances.map((i) => {
        if (i.instanceId !== instanceId) return i;
        const nextRoom =
          findRoomAt(s.rooms, s.ui.activeStoreyId, { x, y }) ??
          s.rooms.find((r) => r.id === i.roomId) ??
          null;
        return {
          ...i,
          position: {
            x,
            y,
            z: z ?? i.position.z,
          },
          roomId: nextRoom?.id ?? i.roomId,
        };
      }),
    }));
  }

  async function importPlan(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      await officialWait.run(OFFICIAL_WAIT_COPY.importingPlan, async () => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/projects/${projectId}/assets`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error || "Import failed");
        return;
      }
      if (data.warnings?.length) setStatus(data.warnings.join(" "));

      if (data.ifcScene) {
        // Merge IFC storeys/rooms, keep fixture library
        recordUndoFromLatest();
        setScene((s) => ({
          ...data.ifcScene,
          fixtureLibraryIds: s.fixtureLibraryIds,
          instances: s.instances,
          version: 2 as const,
        }));
        setAssets((a) => [data.asset, ...a]);
        setStatus("IFC imported — storeys/spaces loaded");
        return;
      }

      const asset = data.asset as AssetRow;
      const rasterAsset = data.rasterAsset as AssetRow | null | undefined;
      const raster = data.raster as
        | {
            widthPx: number;
            heightPx: number;
            rasterDpi: number;
            pageCount: number;
            pageIndex: number;
          }
        | null
        | undefined;
      const meta = JSON.parse(asset.metaJson || "{}") as {
        entities?: DxfEntity[];
        layers?: OfficialDxfLayer[];
        widthPx?: number;
        heightPx?: number;
        pageCount?: number;
        metersPerUnit?: number;
        insunits?: number | null;
      };
      if (Array.isArray(meta.entities) && meta.entities.length) {
        cadSourceEntitiesByAssetRef.current.set(asset.id, meta.entities);
      }
      setAssets((a) => [
        ...(rasterAsset ? [assetRowWithoutCadSourceEntities(rasterAsset)] : []),
        assetRowWithoutCadSourceEntities(asset),
        ...a,
      ]);
      const pixelSize =
        asset.kind === "image" ? await readImagePixelSize(file) : null;
      let sourceWidthPx = pixelSize?.width ?? raster?.widthPx ?? meta.widthPx;
      let sourceHeightPx = pixelSize?.height ?? raster?.heightPx ?? meta.heightPx;
      const underlayId = nid("underlay");
      patchScene((s) => ({
        ...s,
        underlays: [
          ...s.underlays.filter((u) => u.storeyId !== s.ui.activeStoreyId),
          officialImportedUnderlay({
            id: underlayId,
            storeyId: s.ui.activeStoreyId,
            assetId: asset.id,
            assetKind: asset.kind,
            sourceWidthPx,
            sourceHeightPx,
            dxfEntities: meta.entities
              ? officialCompressCadEntities(
                  officialExtractVisibleCadEntities(meta.entities, [])
                )
              : meta.entities,
            metersPerUnit: officialMetersPerUnitFromAssetMeta(meta) ?? meta.metersPerUnit,
            hiddenLayers: [],
            dxfLayers: meta.layers,
            pageIndex: raster?.pageIndex ?? 0,
            pageRasterAssetId: rasterAsset?.id,
            rasterDpi: raster?.rasterDpi,
            pdfPageCount: raster?.pageCount ?? meta.pageCount,
          }),
        ],
      }));
      setLayerDraftHidden(null);
      if (asset.kind === "dwg") {
        setStatus(OFFICIAL_DWG_IMPORTED_STATUS);
      } else if (asset.kind === "pdf") {
        const tip = data.warnings?.includes("PDF rasterized for display")
          ? "PDF rasterized for display — use calibrate tool for scale"
          : "PDF imported — use calibrate tool for scale";
        setStatus(
          data.warnings?.filter((w: string) => w !== "PDF rasterized for display").length
            ? `${tip} (${data.warnings.filter((w: string) => w !== "PDF rasterized for display").join("; ")})`
            : tip
        );
      } else if (asset.kind === "image" && !(sourceWidthPx && sourceHeightPx)) {
        setStatus("Plan imported, but image size could not be read — re-import if distorted.");
      } else {
        setStatus(`Plan imported (${asset.kind}). Use calibrate tool to set scale.`);
      }
      if (officialShouldAskBuildAfterPlanImport(scene, asset.kind, readOnly)) {
        setAskBuildAfterPlanOpen(true);
      }
      });
    } finally {
      setUploading(false);
      if (planRef.current) planRef.current.value = "";
    }
  }

  function cadSourceEntitiesFromAsset(assetId?: string | null): DxfEntity[] {
    if (!assetId) return [];
    const cached = cadSourceEntitiesByAssetRef.current.get(assetId);
    if (cached && cached.length) return cached;
    const planAsset = assets.find((a) => a.id === assetId);
    if (!planAsset) return [];
    try {
      const meta = JSON.parse(planAsset.metaJson || "{}") as { entities?: DxfEntity[] };
      if (Array.isArray(meta.entities) && meta.entities.length) {
        cadSourceEntitiesByAssetRef.current.set(assetId, meta.entities);
        return meta.entities;
      }
    } catch {
      /* fall through */
    }
    return [];
  }

  function cadSourceEntities(target = underlay): DxfEntity[] {
    if (!target) return [];
    const fromAsset = cadSourceEntitiesFromAsset(target.assetId);
    if (fromAsset.length) return fromAsset;
    return target.dxfEntities ?? [];
  }

  function planLayerTable(target = underlay): OfficialDxfLayer[] | undefined {
    if (!target) return undefined;
    if (officialHasCadLayerTable(target.dxfLayers)) return target.dxfLayers;
    const planAsset = assets.find((a) => a.id === target.assetId);
    if (!planAsset) return target.dxfLayers;
    try {
      const meta = JSON.parse(planAsset.metaJson || "{}") as { layers?: OfficialDxfLayer[] };
      if (officialHasCadLayerTable(meta.layers)) return meta.layers;
    } catch {
      /* use the underlay table */
    }
    return target.dxfLayers;
  }

  async function ensureCadSourceEntities(target = underlay): Promise<DxfEntity[]> {
    if (!target) return [];
    const local = cadSourceEntitiesFromAsset(target.assetId);
    if (local.length) return local;
    if (readOnly || shareBasePath || !target.assetId) {
      return target.dxfEntities ?? [];
    }
    const res = await fetch(
      `/api/projects/${projectId}/assets/${target.assetId}/cad-source-entities`
    );
    let data: { entities?: DxfEntity[]; error?: string } = {};
    try {
      data = (await res.json()) as { entities?: DxfEntity[]; error?: string };
    } catch {
      /* use the status below */
    }
    if (!res.ok || !Array.isArray(data.entities) || !data.entities.length) {
      throw new Error(data.error || "Could not update plan layers");
    }
    cadSourceEntitiesByAssetRef.current.set(target.assetId, data.entities);
    return data.entities;
  }

  function renderCurrentPlanFile() {
    if (!underlay) return null;
    const planAsset = assets.find((a) => a.id === underlay.assetId);
    if (!planAsset) return null;
    const uploaded = officialFormatPlanUploadAt(planAsset.createdAt);
    return (
      <div className="text-[10px] text-[var(--muted)] leading-snug space-y-1">
        <p className="truncate" title={planAsset.fileName}>
          {planAsset.fileName}
        </p>
        {uploaded ? <p>Uploaded {uploaded}</p> : null}
        <a
          className="btn btn-secondary !text-xs"
          href={officialPlanAssetFileUrl(assetApiBase, planAsset.id, { download: true })}
          download={planAsset.fileName}
        >
          Download
        </a>
      </div>
    );
  }

  async function backfillPlanCadLayers(assetId: string, underlayId: string) {
    if (readOnly || shareBasePath) return;
    setUploading(true);
    try {
      await officialWait.run(OFFICIAL_WAIT_COPY.backfillingPlanLayers, async () => {
        const res = await fetch(`/api/projects/${projectId}/assets/${assetId}/cad-layers`, {
          method: "POST",
        });
        let data: { asset?: AssetRow; error?: string } = {};
        try {
          data = (await res.json()) as { asset?: AssetRow; error?: string };
        } catch {
          /* use the fallback status below */
        }
        if (!res.ok || !data.asset) {
          setStatus(data.error || "Could not update plan layers");
          return;
        }
        const asset = data.asset;
        let nextMeta: { entities?: DxfEntity[]; layers?: OfficialDxfLayer[] } = {};
        try {
          nextMeta = JSON.parse(asset.metaJson || "{}") as typeof nextMeta;
        } catch {
          nextMeta = {};
        }
        if (Array.isArray(nextMeta.entities) && nextMeta.entities.length) {
          cadSourceEntitiesByAssetRef.current.set(asset.id, nextMeta.entities);
        }
        setAssets((rows) =>
          rows.map((row) => (row.id === asset.id ? assetRowWithoutCadSourceEntities(asset) : row))
        );
        patchScene(
          (s) => ({
            ...s,
            underlays: s.underlays.map((u) => {
              if (u.id !== underlayId) return u;
              const patched = {
                ...u,
                dxfLayers: Array.isArray(nextMeta.layers) ? nextMeta.layers : u.dxfLayers,
              };
              if (
                officialCadEntitiesLackLayerNames(u.dxfEntities) &&
                Array.isArray(nextMeta.entities)
              ) {
                patched.dxfEntities = officialCompressCadEntities(
                  officialExtractVisibleCadEntities(
                    nextMeta.entities,
                    u.hiddenLayers ?? []
                  )
                );
              }
              return patched;
            }),
          }),
          { recordUndo: false }
        );
      });
    } finally {
      setUploading(false);
    }
  }

  async function applyPlanLayers() {
    if (readOnly || !underlay || !officialHasParsedCadLinework(underlay)) return;
    const hidden = layerDraftHidden ?? underlay.hiddenLayers ?? [];
    setUploading(true);
    try {
      await officialWait.run(OFFICIAL_WAIT_COPY.applyingPlanLayers, async () => {
        let source: DxfEntity[];
        try {
          source = await ensureCadSourceEntities(underlay);
        } catch (error) {
          setStatus(error instanceof Error ? error.message : "Could not update plan layers");
          return;
        }
        if (!source.length) {
          setStatus("Could not update plan layers");
          return;
        }
        const extracted = officialExtractVisibleCadEntities(source, hidden);
        const compressed = officialCompressCadEntities(extracted);
        patchScene((s) => ({
          ...s,
          underlays: s.underlays.map((u) =>
            u.id === underlay.id
              ? { ...u, dxfEntities: compressed, hiddenLayers: hidden }
              : u
          ),
        }));
        setLayerDraftHidden(null);
        setStatus("Plan layers updated");
      });
    } finally {
      setUploading(false);
    }
  }

  function onCalibrate(
    a: { x: number; y: number },
    b: { x: number; y: number }
  ) {
    const distM = Math.hypot(b.x - a.x, b.y - a.y);
    const real = Number(calibDist);
    if (!(real > 0) || !(distM > 1e-6) || !underlay) return;
    // Uniform meters-per-pixel scale — preserves import aspect ratio on both axes.
    const next = applyUnderlayCalibration(underlay, a, b, real);
    if (!next) return;
    patchScene((s) => ({
      ...s,
      underlays: s.underlays.map((u) => (u.id === underlay.id ? next : u)),
      ui: { ...s.ui, tool: "select" },
    }));
    setStatus(`Calibrated: ${real} m across selection`);
  }

  async function setPdfUnderlayPage(pageIndex: number) {
    if (!underlay || underlay.kind !== "pdf") return;
    setUploading(true);
    setStatus(null);
    try {
      await officialWait.run(OFFICIAL_WAIT_COPY.rasterizingPdf, async () => {
      const res = await fetch(
        `/api/projects/${projectId}/assets/${underlay.assetId}/pdf-raster`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageIndex }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error || "PDF page raster failed");
        return;
      }
      const rasterAsset = data.rasterAsset as AssetRow;
      const raster = data.raster as {
        widthPx: number;
        heightPx: number;
        rasterDpi: number;
        pageCount: number;
        pageIndex: number;
      };
      setAssets((a) => [rasterAsset, ...a.filter((x) => x.id !== rasterAsset.id)]);
      patchScene((s) => ({
        ...s,
        underlays: s.underlays.map((u) =>
          u.id === underlay.id
            ? {
                ...u,
                pageIndex: raster.pageIndex,
                pageRasterAssetId: rasterAsset.id,
                rasterDpi: raster.rasterDpi,
                pdfPageCount: raster.pageCount,
                sourceWidthPx: raster.widthPx,
                sourceHeightPx: raster.heightPx,
              }
            : u
        ),
      }));
      const extra = (data.warnings as string[] | undefined)?.join("; ");
      setStatus(
        extra
          ? `PDF page ${raster.pageIndex + 1} rasterized — ${extra}`
          : `PDF page ${raster.pageIndex + 1} rasterized for display`
      );
      });
    } finally {
      setUploading(false);
    }
  }

  const persistUnderlaySourceSize = useCallback(
    (widthPx: number, heightPx: number) => {
      if (!(widthPx > 0 && heightPx > 0)) return;
      setScene((s) => {
        const active = s.underlays.find((u) => u.storeyId === s.ui.activeStoreyId);
        if (!active) return s;
        if (
          active.sourceWidthPx === widthPx &&
          active.sourceHeightPx === heightPx
        ) {
          return s;
        }
        const needsLegacyScale =
          !(
            typeof active.sourceWidthPx === "number" &&
            active.sourceWidthPx > 0 &&
            typeof active.sourceHeightPx === "number" &&
            active.sourceHeightPx > 0
          );
        return {
          ...s,
          underlays: s.underlays.map((u) =>
            u.id === active.id
              ? {
                  ...u,
                  sourceWidthPx: widthPx,
                  sourceHeightPx: heightPx,
                  metersPerUnit: needsLegacyScale
                    ? legacyScaleToMetersPerPixel(u.metersPerUnit, widthPx)
                    : u.metersPerUnit,
                }
              : u
          ),
        };
      });
    },
    []
  );

  async function runCalc(scope: CalcScope) {
    if (readOnly) return;
    const plan = planCalcRooms(scene, scope);
    if (!plan.ok) {
      setStatus(formatCalcEmptyError(plan));
      return;
    }
    setCalcTarget(scope);
    setCalculating(true);
    setStatus(formatCalcBusyStatus(scope));
    try {
      await officialWait.run(OFFICIAL_WAIT_COPY.calculating, async () => {
      const calc = await runOfficialClientCalc(
        scene,
        results,
        scope,
        writeCalcDeps(),
        { luminaireNames: luminaireNameMap(), bilingual: true }
      );
      if (!calc.ok) {
        setStatus(calc.status);
        return;
      }
      recordUndoFromLatest();
      setResults(calc.results);
      setStatus(calc.status);
      });
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Calculation failed");
    } finally {
      setCalculating(false);
      setCalcTarget(null);
    }
  }

  async function runRcpDetect() {
    if (!underlay?.pageRasterAssetId && underlay?.kind !== "image") {
      setStatus("Import a rasterized PDF or image plan first");
      return;
    }
    if (!underlay?.sourceWidthPx || !underlay.sourceHeightPx) {
      setStatus("Plan raster size unknown — re-import the underlay");
      return;
    }
    setRcpDetecting(true);
    setRcpWarnings([]);
    setStatus("Detecting fixture codes (local OCR)…");
    try {
      await officialWait.run(OFFICIAL_WAIT_COPY.detectingCodes, async () => {
      const res = await fetch(`/api/projects/${projectId}/rcp-detect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ underlayId: underlay.id, allowCloud: false }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error || "Detect failed");
        return;
      }
      patchScene((s) => ({ ...s, rcpProposals: data.proposals ?? [] }));
      setRcpWarnings(data.warnings ?? []);
      setShowRcpOverlay(true);
      const n = (data.proposals as unknown[])?.length ?? 0;
      setStatus(n ? `Detected ${n} code proposal(s) (local OCR)` : "No codes detected — see warnings");
      });
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Detect failed");
    } finally {
      setRcpDetecting(false);
    }
  }

  async function runRcpCommit(options: {
    replaceExistingFromDetect: boolean;
    calcAfterCommit: boolean;
  }) {
    const latest = latestRef.current;
    const plan = planRcpCommit({
      proposals: latest.scene.rcpProposals ?? [],
      rules: latest.scene.fixtureCodeMap ?? [],
      rooms: latest.scene.rooms,
      storeyId: latest.scene.ui.activeStoreyId,
      luminaireNames: codeMapLuminaireNames,
      scene: latest.scene,
    });
    const roomIds = plan.drafts.map((d) => d.roomId);
    if (options.replaceExistingFromDetect) {
      for (const inst of latest.scene.instances) {
        if (inst.rcpProposalId && inst.storeyId === latest.scene.ui.activeStoreyId && inst.roomId) {
          roomIds.push(inst.roomId);
        }
      }
    }
    requestFixtureWrite(roomIds, () => {
      void runRcpCommitNow(options);
    });
  }

  async function runRcpCommitNow(options: {
    replaceExistingFromDetect: boolean;
    calcAfterCommit: boolean;
  }) {
    setRcpCommitting(true);
    try {
      await officialWait.run(OFFICIAL_WAIT_COPY.committingRcp, async () => {
      const latest = latestRef.current;
      const out = await commitAcceptedRcpProposals(
        {
          scene: latest.scene,
          results: latest.results,
          proposals: latest.scene.rcpProposals ?? [],
          rules: latest.scene.fixtureCodeMap ?? [],
          luminaireNames: codeMapLuminaireNames,
          options: {
            replaceExistingFromDetect: options.replaceExistingFromDetect,
            runCalc: options.calcAfterCommit,
            calcScope: "room",
          },
        },
        writeCalcDeps()
      );
      recordUndoFromLatest();
      setScene(out.scene);
      setResults(out.results);
      if (out.instanceIds.length === 0) {
        setStatus(
          out.skippedOutside.length
            ? `No fixtures placed — ${out.skippedOutside.length} outside room`
            : "Nothing to commit"
        );
        return;
      }
      let msg = `Committed ${out.instanceIds.length} fixture(s) from RCP / 已提交 ${out.instanceIds.length} 個燈具`;
      if (out.skippedOutside.length) {
        msg += ` · skipped ${out.skippedOutside.length} outside room`;
      }
      if (options.calcAfterCommit && out.calcFailed) {
        msg += out.calcErrorMessage
          ? ` · ${out.calcErrorMessage}`
          : " · calc failed (fixtures kept) / 計算失敗（燈具已保留）";
      } else if (options.calcAfterCommit) {
        msg += " · calculated / 已計算";
      }
      setStatus(msg);
      setSelectedId(out.instanceIds[out.instanceIds.length - 1] ?? null);
      });
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Commit failed");
    } finally {
      setRcpCommitting(false);
    }
  }

  async function runScheduleCommit(options: { calcAfterCommit: boolean }) {
    const latest = latestRef.current;
    const blockedReason = scheduleCommitBlockedReason(scheduleRows);
    if (blockedReason) {
      setStatus(blockedReason);
      return;
    }
    const plan = planScheduleCommit(scheduleRows, latest.scene, luminaireNameMap());
    requestFixtureWrite(
      plan.drafts.map((d) => d.roomId),
      () => {
        void runScheduleCommitNow(options);
      }
    );
  }

  async function runScheduleCommitNow(options: { calcAfterCommit: boolean }) {
    setScheduleCommitting(true);
    try {
      await officialWait.run(OFFICIAL_WAIT_COPY.importingSchedule, async () => {
      const latest = latestRef.current;
      const out = await commitScheduleImport(
        {
          scene: latest.scene,
          results: latest.results,
          rows: scheduleRows,
          luminaireNames: luminaireNameMap(),
          runCalc: options.calcAfterCommit,
        },
        writeCalcDeps()
      );
      if (out.blockedReason) {
        setStatus(out.blockedReason);
        return;
      }
      recordUndoFromLatest();
      setScene(out.scene);
      setResults(out.results);
      if (out.instanceIds.length === 0) {
        setStatus(
          out.skippedOutside.length
            ? `No fixtures placed — ${out.skippedOutside.length} outside room`
            : "Nothing to commit"
        );
        return;
      }
      let msg = `Schedule import: ${out.instanceIds.length} fixture(s) / 已匯入 ${out.instanceIds.length} 個燈具`;
      if (out.skippedOutside.length) {
        msg += ` · skipped ${out.skippedOutside.length} outside`;
      }
      if (options.calcAfterCommit && out.calcFailed) {
        msg += out.calcErrorMessage
          ? ` · ${out.calcErrorMessage}`
          : " · calc failed (fixtures kept) / 計算失敗（燈具已保留）";
      } else if (options.calcAfterCommit) {
        msg += " · calculated / 已計算";
      }
      setStatus(msg);
      setSelectedId(out.instanceIds[out.instanceIds.length - 1] ?? null);
      });
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Schedule commit failed");
    } finally {
      setScheduleCommitting(false);
    }
  }

  async function runPlanCodeScan() {
    if (readOnly) return;
    if (!underlay || !officialHasParsedCadLinework(underlay)) {
      setPlanCodeRows([]);
      setStatus(PLAN_CODE_REFUSE_NO_PLAN);
      return;
    }
    setPlanCodeScanning(true);
    try {
      await officialWait.run(OFFICIAL_WAIT_COPY.scanningPlanCodes, async () => {
        const res = await fetch(
          `/api/projects/${projectId}/assets/${underlay.assetId}/plan-text-labels`
        );
        const data = (await res.json()) as { error?: string; labels?: OfficialDxfTextLabel[] };
        if (!res.ok) {
          setPlanCodeRows([]);
          setStatus(data.error || PLAN_CODE_REFUSE_NO_PLAN);
          return;
        }
        const scanned = scanPlanCodeLabels({
          labels: Array.isArray(data.labels) ? data.labels : [],
          underlay,
          hiddenLayers: underlay.hiddenLayers ?? [],
          rules: latestRef.current.scene.fixtureCodeMap ?? [],
          rooms: latestRef.current.scene.rooms,
          storeyId: latestRef.current.scene.ui.activeStoreyId,
        });
        if (!scanned.ok) {
          setPlanCodeRows([]);
          setStatus(scanned.reason);
          return;
        }
        setPlanCodeRows(scanned.rows);
        setStatus(
          scanned.outsideSkipped
            ? `Found ${scanned.rows.length} plan code(s) · ${scanned.outsideSkipped} outside room / 找到 ${scanned.rows.length} 個燈碼 · ${scanned.outsideSkipped} 個在房外`
            : `Found ${scanned.rows.length} plan code(s) / 找到 ${scanned.rows.length} 個燈碼`
        );
      });
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setPlanCodeScanning(false);
    }
  }

  async function runPlanCodeCommit(options: {
    calcAfterCommit: boolean;
    replaceExistingFromPlanCodes: boolean;
  }) {
    if (readOnly) return;
    const latest = latestRef.current;
    const blockedReason = planCodeCommitBlockedReason(planCodeRows);
    if (blockedReason) {
      setStatus(blockedReason);
      return;
    }
    const plan = planPlanCodeCommit(planCodeRows, latest.scene, luminaireNameMap());
    const roomIds = plan.drafts.map((d) => d.roomId);
    if (options.replaceExistingFromPlanCodes) {
      for (const inst of latest.scene.instances) {
        if (inst.planCodeId && inst.storeyId === latest.scene.ui.activeStoreyId && inst.roomId) {
          roomIds.push(inst.roomId);
        }
      }
    }
    requestFixtureWrite(roomIds, () => {
      void runPlanCodeCommitNow(options);
    });
  }

  async function runPlanCodeCommitNow(options: {
    calcAfterCommit: boolean;
    replaceExistingFromPlanCodes: boolean;
  }) {
    setPlanCodeCommitting(true);
    try {
      await officialWait.run(OFFICIAL_WAIT_COPY.committingPlanCodes, async () => {
        const latest = latestRef.current;
        const out = await commitPlanCodePlacements(
          {
            scene: latest.scene,
            results: latest.results,
            rows: planCodeRows,
            luminaireNames: luminaireNameMap(),
            options: {
              replaceExistingFromPlanCodes: options.replaceExistingFromPlanCodes,
              runCalc: options.calcAfterCommit,
            },
          },
          writeCalcDeps()
        );
        if (out.blockedReason) {
          setStatus(out.blockedReason);
          return;
        }
        recordUndoFromLatest();
        setScene(out.scene);
        setResults(out.results);
        if (out.instanceIds.length === 0) {
          setStatus(
            out.skippedOutside.length
              ? `No fixtures placed — ${out.skippedOutside.length} outside room`
              : "Nothing to commit"
          );
          return;
        }
        let msg = `Placed ${out.instanceIds.length} fixture(s) from plan codes / 已按圖則燈碼放置 ${out.instanceIds.length} 個燈具`;
        if (out.skippedOutside.length) {
          msg += ` · skipped ${out.skippedOutside.length} outside room`;
        }
        if (options.calcAfterCommit && out.calcFailed) {
          msg += out.calcErrorMessage
            ? ` · ${out.calcErrorMessage}`
            : " · calc failed (fixtures kept) / 計算失敗（燈具已保留）";
        } else if (options.calcAfterCommit) {
          msg += " · calculated / 已計算";
        }
        setStatus(msg);
        setSelectedId(out.instanceIds[out.instanceIds.length - 1] ?? null);
      });
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Commit failed");
    } finally {
      setPlanCodeCommitting(false);
    }
  }

  async function applyFixtureArray(params: ArrayParams, luminaireId: string) {
    if (readOnly) return;
    if (!activeRoom) {
      setStatus("Select a room for the array / 請先選擇房間");
      return;
    }
    if (params.automaticPlacement) {
      await applyAutomaticPlacement(params, luminaireId, activeRoom);
      return;
    }
    const plan = planFixtureArray(activeRoom, params);
    if (!plan.inside.length) {
      setStatus("No array points inside room — adjust spacing or wall offset");
      return;
    }
    const decision = prepareFixtureArrayApply(
      plan,
      latestRef.current.scene.instances,
      activeRoom.id
    );
    if (decision.confirmMessage) {
      const ok = window.confirm(decision.confirmMessage);
      if (!ok) return;
    }
    if (!decision.placeable.length) {
      setArrayPreview(null);
      setLinePick(EMPTY_LINE_PICK);
      setCirclePick(EMPTY_CIRCLE_PICK);
      setPolygonPick(EMPTY_POLYGON_PATH_PICK);
      setStatus(
        formatArrayApplyStatus({
          placed: 0,
          skippedOccupied: decision.skippedOccupied.length,
          roomName: activeRoom.name,
        })
      );
      return;
    }

    requestFixtureWrite([activeRoom.id], () => {
      void applyFixtureArrayNow(params, luminaireId, decision, activeRoom);
    });
  }

  async function applyAutomaticPlacement(
    params: ArrayParams,
    luminaireId: string,
    room: NonNullable<typeof activeRoom>
  ) {
    const input = automaticPlacementInputFromParams(params);
    if (!input) {
      const reason =
        !params.luminousFluxLm || params.luminousFluxLm <= 0
          ? "no-flux"
          : !params.targetEmMaintainedLx || params.targetEmMaintainedLx <= 0
            ? "invalid-target"
            : !params.maxSpacingToHm || params.maxSpacingToHm <= 0
              ? "invalid-max-s-over-hm"
              : "cannot-place";
      setStatus(formatAutomaticPlacementRefusal(reason));
      return;
    }
    try {
      const out = await officialWait.run(OFFICIAL_WAIT_COPY.planningAutomaticPlacement, () =>
        planAutomaticPlacement(room, input)
      );
      if (!out.ok) {
        setArrayPreview(null);
        setStatus(formatAutomaticPlacementRefusal(out.reason));
        return;
      }
      const decision = prepareFixtureArrayApply(
        out.plan,
        latestRef.current.scene.instances,
        room.id
      );
      if (!decision.placeable.length) {
        setArrayPreview(null);
        setStatus(formatAutomaticPlacementRefusal("all-occupied"));
        return;
      }
      requestFixtureWrite([room.id], () => {
        void applyFixtureArrayNow(params, luminaireId, decision, room);
      });
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Automatic placement failed");
    }
  }

  async function applyFixtureArrayNow(
    params: ArrayParams,
    luminaireId: string,
    decision: {
      placeable: { x: number; y: number; rotationDeg: number }[];
      skippedOccupied: unknown[];
    },
    room: NonNullable<typeof activeRoom>
  ) {
    const lib = library.find((l) => l.id === luminaireId);
    const photo = photoCache[luminaireId];
    const mountZ = room.heightM - 0.1;
    const drafts = decision.placeable.map((p) => ({
      luminaireId,
      storeyId: scene.ui.activeStoreyId,
      roomId: room.id,
      name: lib?.name ?? photo?.description ?? "Fixture",
      position: { x: p.x, y: p.y, z: mountZ },
      rotationDeg: p.rotationDeg,
    }));

    setArrayApplying(true);
    try {
      await officialWait.run(
        params.automaticPlacement
          ? OFFICIAL_WAIT_COPY.planningAutomaticPlacement
          : OFFICIAL_WAIT_COPY.placingFixtures,
        async () => {
      const latest = latestRef.current;
      const out = await writeFixtureInstances(
        {
          scene: latest.scene,
          results: latest.results,
          drafts,
          options: {
            runCalc: calcAfterPlace,
            calcScope: "room",
          },
        },
        writeCalcDeps()
      );
      const nextScene = focusActiveRoomAfterPlacement(out.scene, out.affectedRoomIds);
      setScene(nextScene);
      setResults(out.results);
      setArrayPreview(null);
      setLinePick(EMPTY_LINE_PICK);
      setCirclePick(EMPTY_CIRCLE_PICK);
      setPolygonPick(EMPTY_POLYGON_PATH_PICK);
      setSelectedId(out.instanceIds[out.instanceIds.length - 1] ?? null);
      const calcNote = postPlaceCalcStatusSuffix(
        {
          results: out.results,
          calcFailed: out.calcFailed ?? false,
          missingLuminaireIds: out.missingLuminaireIds ?? [],
          errorMessage: out.calcErrorMessage,
        },
        calcAfterPlace
      );
      const estimateNote = params.estimateByTargetEm
        ? " · Estimate only — run Calc for final Ēm / 估算 — 請用 Calc 確認"
        : "";
      setStatus(
        formatArrayApplyStatus({
          placed: out.instanceIds.length,
          skippedOccupied: decision.skippedOccupied.length,
          roomName: room.name,
          suffix: `${calcNote}${estimateNote}`,
        })
      );
      });
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Array apply failed");
    } finally {
      setArrayApplying(false);
    }
  }

  async function exportFullPdf() {
    await officialWait.run(OFFICIAL_WAIT_COPY.exportingPdf, async () => {
    const photometry: Record<string, PhotometricData> = {};
    for (const id of scene.fixtureLibraryIds) {
      const p = await ensurePhotometry(id);
      if (p) photometry[id] = p;
    }
    const wattsById: Record<string, number | null | undefined> = {};
    for (const l of library) wattsById[l.id] = l.watts;
    const falseColorSnapshots: Record<string, string> = {};
    for (const room of scene.rooms) {
      const res = results.byRoomId[room.id];
      if (!res) continue;
      const snap = await gridToFalseColorJpegDataUrlAsync(room, res, {
        yieldTo: officialWaitYield,
        colorScale: scale,
      });
      if (snap) falseColorSnapshots[room.id] = snap;
      await officialWaitYield();
    }
    const isoluxSnapshots = await collectOfficialIsoluxSnapshotsAsync(
      scene,
      results,
      undefined,
      officialWaitYield
    );
    const captured3d = await captureOfficialReport3dViewsAsync({
      captureAvailable: webglCaptureAvailable,
      render: () =>
        renderAllReport3dViewsAsync(
          {
            scene,
            results,
            photometry,
            overviewCamera: fitOverviewCamera(scene),
            falseColorScale: scale,
          },
          officialWaitYield
        ),
    });
    if (captured3d.status) setStatus(captured3d.status);
    const {
      projectPerspectiveGreyscale,
      projectPerspectiveFalseColor,
      projectPerspectiveIsolines,
      persp3dGreyscale,
      persp3dFalseColor,
      persp3dIsolines,
    } = captured3d.views;
    let website: string | undefined;
    try {
      const siteRes = await fetch("/api/site");
      if (siteRes.ok) {
        const site = (await siteRes.json()) as { reportWebsite?: string };
        const trimmed = site.reportWebsite?.trim();
        if (trimmed) website = trimmed;
      }
    } catch {
      // Export still succeeds if the public site info cannot be loaded.
    }
    let shareUrl: string | undefined;
    if (!readOnly) {
      try {
        const shareRes = await fetch(`/api/projects/${projectId}/share`);
        if (shareRes.ok) {
          const share = (await shareRes.json()) as { public?: boolean; url?: string | null };
          if (share.public && share.url) {
            const url = new URL(share.url, window.location.origin);
            shareUrl = url.toString();
          }
        }
      } catch {
        // Cover QR is omitted when the share link cannot be loaded.
      }
    }
    const doc = await buildFullReportPdfAsync(
      {
        projectName: name,
        scene,
        results,
        photometry,
        wattsById,
        falseColorSnapshots,
        colorScale: scale,
        isoluxSnapshots,
        projectPerspectiveGreyscale,
        projectPerspectiveFalseColor,
        projectPerspectiveIsolines,
        persp3dGreyscale,
        persp3dFalseColor,
        persp3dIsolines,
        luxsimVersion: "0.1.0",
        website,
        shareUrl,
      },
      officialWaitYield
    );
    await officialWaitYield();
    const reportName = `${name.replace(/[^\w\-]+/g, "_")}-report.pdf`;
    await officialSaveBlob(doc.output("blob"), {
      suggestedName: reportName,
      types: [OFFICIAL_SAVE_TYPES.pdf],
    });
    });
  }

  const projectFixtures = useMemo(
    () => library.filter((l) => scene.fixtureLibraryIds.includes(l.id)),
    [library, scene.fixtureLibraryIds]
  );

  const arrayLuminaireOptions = useMemo(
    () =>
      projectFixtures.map((l) => ({
        id: l.id,
        name: l.name,
        fluxLm: l.lumens ?? photoCache[l.id]?.luminousFlux ?? null,
      })),
    [projectFixtures, photoCache]
  );

  const codeMapLuminaires = useMemo(() => {
    return library
      .filter((l) => scene.fixtureLibraryIds.includes(l.id))
      .map((l) => ({
        id: l.id,
        name: l.name,
        originalName: l.originalName ?? null,
        catalogNumber: photoCache[l.id]?.catalogNumber ?? null,
      }));
  }, [library, scene.fixtureLibraryIds, photoCache]);

  const codeMapLuminaireNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const l of codeMapLuminaires) names[l.id] = l.name;
    return names;
  }, [codeMapLuminaires]);

  async function onExportDialuxVerification() {
    const toExport = sceneWithView(scene);
    const warnings = getDialuxPackWarnings(toExport, results);
    const blocking = warnings.filter((w) => w.code === "no_rooms" || w.code === "open_contour");
    if (blocking.length) {
      setStatus(blocking.map((w) => w.message).join(" "));
      return;
    }
    const names: Record<string, string> = {};
    for (const l of library) names[l.id] = l.name;
    await officialWait.run(OFFICIAL_WAIT_COPY.exportingVerification, async () => {
      const collected = await collectSourcesForOfficialExport(officialExportLuminaireIds(toExport));
      await exportDialuxPack({
        projectName: name,
        scene: toExport,
        results,
        sourceFiles: collected.sourceFiles,
        luminaireNames: names,
      });
      if (collected.missingSourceIds.length) {
        setStatus(missingExportSourceStatus("dialux", collected.missingSourceIds, names));
        return;
      }
      const soft = warnings.filter((w) => w.code !== "dialux_general").map((w) => w.message);
      setStatus(
        soft.length
          ? `Verification zip downloaded. Note: ${soft[0]}`
          : "Verification pack downloaded — see README.txt in the zip."
      );
    });
  }

  const workflow: EditorWorkflowMode = scene.ui.workflowMode ?? "construction";
  const workflowMeta = WORKFLOW_MODES.find((m) => m.id === workflow)!;

  useEffect(() => {
    if (readOnly || shareBasePath) return;
    if (workflow !== "construction") return;
    if (!underlay || (underlay.kind !== "dxf" && underlay.kind !== "dwg")) return;
    const underlayId = underlay.id;
    const assetId = underlay.assetId;
    const planAsset = assets.find((row) => row.id === assetId);
    if (!planAsset) return;
    let meta: unknown = {};
    try {
      meta = JSON.parse(planAsset.metaJson || "{}");
    } catch {
      meta = {};
    }
    if (!officialCadLayerMetaIncomplete(meta)) return;
    if (cadLayerBackfillAttemptedRef.current.has(assetId)) return;
    cadLayerBackfillAttemptedRef.current.add(assetId);
    void backfillPlanCadLayers(assetId, underlayId);
  }, [readOnly, shareBasePath, workflow, underlay?.id, underlay?.kind, underlay?.assetId, assets, projectId]);

  useEffect(() => {
    setLinePick(EMPTY_LINE_PICK);
    setCirclePick(EMPTY_CIRCLE_PICK);
    setPolygonPick(EMPTY_POLYGON_PATH_PICK);
  }, [activeRoom?.id]);

  useEffect(() => {
    if (workflow !== "light") {
      setLinePick(EMPTY_LINE_PICK);
      setCirclePick(EMPTY_CIRCLE_PICK);
      setPolygonPick(EMPTY_POLYGON_PATH_PICK);
      setLinePickActive(false);
      setCirclePickActive(false);
      setPolygonPickActive(false);
      setGenerateLdtOpen(false);
    }
    if (workflow !== "construction") {
      setBooleanPick(EMPTY_OFFICIAL_TWO_ROOM_PICK);
    }
  }, [workflow]);

  function setWorkflowMode(mode: EditorWorkflowMode) {
    patchSceneUi((s) => {
      let ui = { ...s.ui, workflowMode: mode };
      if (mode === "light" && !s.ui.activeRoomId) {
        const first = s.rooms.find((r) => r.storeyId === s.ui.activeStoreyId);
        if (first) ui = { ...ui, activeRoomId: first.id };
      }
      if (mode === "light" || mode === "calculation" || mode === "export") {
        ui = { ...ui, tool: "select" };
      }
      return { ...s, ui };
    });
    if (mode === "light" && !activeRoom) {
      setStatus("Light mode: select a room in the building tree (space view) to place fixtures.");
    }
  }

  const modeIcons: Record<EditorWorkflowMode, ReactElement> = {
    construction: <IconModeConstruction className="w-4 h-4" />,
    light: <IconModeLight className="w-4 h-4" />,
    calculation: <IconModeCalculation className="w-4 h-4" />,
    export: <IconModeExport className="w-4 h-4" />,
  };

  const viewMode = scene.ui.viewMode === "bottom" ? "top" : scene.ui.viewMode;

  const viewTabs: { mode: ViewMode; label: string; icon: ReactElement }[] = [
    { mode: "top", label: "Top", icon: <IconViewTop /> },
    { mode: "front", label: "Front", icon: <IconViewElevation /> },
    { mode: "side", label: "Side", icon: <IconViewElevation /> },
    { mode: "persp3d", label: "3D", icon: <IconView3d /> },
  ];

  useEffect(() => {
    if (scene.ui.viewMode !== "bottom") return;
    patchSceneUi((s) => ({
      ...s,
      ui: { ...s.ui, viewMode: "top" },
    }));
  }, [scene.ui.viewMode]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [fullscreen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = editorUndoKeyAction(e, isTypingField(e.target));
      if (!action) return;
      e.preventDefault();
      if (action === "undo") undoEdit();
      else redoEdit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);


  const display3d: Display3dMode = defaultDisplay3d(results, scene.ui.display3d);
  const showWorkplane = showWorkplaneFromUi(scene.ui);
  const planShowFalseColor = planShowFalseColorFromUi(scene.ui);
  const planShowIsolines = planShowIsolinesFromUi(scene.ui);
  const planValueLabels = scene.ui.planValueLabels === true;
  const isolineSettings = isolineSettingsFromUi(scene.ui);
  const planIsoluxControls = planIsoluxControlState(results, currentStoreyRoomIds());
  const autoScale = OFFICIAL_FALSE_COLOR_SCALE;
  const [scale, setScale] = useState<FalseColorScale>(autoScale);
  const [pendingScale, setPendingScale] = useState<FalseColorScale>(autoScale);
  const [scalePinned, setScalePinned] = useState(false);
  useEditorPerformanceMonitor();
  const viewScaleRef = useRef(scale);
  viewScaleRef.current = scale;
  useEffect(() => {
    if (!scalePinned) setScale(autoScale);
  }, [autoScale, scalePinned]);

  const scaleDirty = shouldApplyViewFalseColorScale(scale, pendingScale);
  const scaleApplyPalette =
    viewMode === "persp3d" && display3d === "greyscale" ? "greyscale" : "falsecolor";
  const showScaleApplyPrompt =
    scaleDirty &&
    ((viewMode === "top" && planShowFalseColor && Boolean(results)) ||
      (viewMode === "persp3d" && (display3d === "falsecolor" || display3d === "greyscale")));

  function setPendingViewFalseColorScale(next: FalseColorScale) {
    setPendingScale((prev) => (falseColorScalesEqual(prev, next) ? prev : next));
  }

  function commitViewFalseColorScale(next: FalseColorScale, pinned: boolean) {
    setPendingScale(next);
    setScalePinned(pinned);
    if (!shouldApplyViewFalseColorScale(viewScaleRef.current, next)) return;
    setScale(next);
    void officialWait.run(OFFICIAL_WAIT_COPY.updatingScale, async () => {});
  }

  function applyViewFalseColorScale() {
    const next = pendingScale;
    commitViewFalseColorScale(next, !falseColorScalesEqual(next, autoScale));
  }

  function commitIsolineSettings(next: IsolineLevelSettings) {
    if (readOnly) return;
    if (isolineSettingsEqual(isolineSettings, next)) return;
    patchScene((s) => ({
      ...s,
      ui: { ...s.ui, ...isolineSettingsToUi(next) },
    }));
    if (planShowIsolines) {
      void officialWait.run(OFFICIAL_WAIT_COPY.updatingIsolines, async () => {});
    }
  }

  const viewReadyResolverRef = useRef<(() => void) | null>(null);

  function markOfficialViewReady() {
    const resolve = viewReadyResolverRef.current;
    viewReadyResolverRef.current = null;
    resolve?.();
  }

  function switchOfficialView(mode: ViewMode) {
    if (!shouldWaitForOfficialViewSwitch(viewMode, mode)) return;
    if (officialShouldPromptBuildBefore3d(viewMode, mode, scene)) {
      setBuildModelFirstOpen(true);
      return;
    }
    const ready = new Promise<void>((resolve) => {
      viewReadyResolverRef.current = resolve;
    });
    void officialWait.run(OFFICIAL_WAIT_COPY.loadingView, async () => {
      flushSync(() => {
        patchSceneUi((s) => ({
          ...s,
          ui: {
            ...s.ui,
            viewMode: mode,
            camera3d: camera3dRef.current ?? s.ui.camera3d ?? null,
          },
        }));
      });
      await officialWaitYield();
      await officialWaitAfterPaint();
      if (mode === "persp3d") {
        await officialViewSwitchReady(ready);
      } else {
        markOfficialViewReady();
      }
    });
  }

  const showConstructionPlan = workflow === "construction";
  const showConstructionEditors = workflow === "construction";
  const showConstructionTools = workflow === "construction" && !readOnly;
  const showRightConstructionRoom = workflow === "construction" && !selected && !!activeRoom;
  const showRightCalculationRoom = workflow === "calculation" && !!activeRoom;
  const showRightFixtureProps = workflow === "light" && !!selected;
  const showRightFixtureLibrary = workflow === "light";
  const showRightIsolines = workflow === "calculation";
  const { showLeftRail, showLeftBuilding, showLeftDocumentation, showRightRail } =
    editorWorkflowRailPlacement({
      workflow,
      hasRightContent:
        showRightConstructionRoom ||
        showRightCalculationRoom ||
        showRightFixtureProps ||
        showRightFixtureLibrary ||
        showRightIsolines,
    });
  const showFixturesTable = workflow === "light";
  const showResultsStrip = workflow === "calculation";

  const viewport = (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-[100] bg-[#0f1c24] flex flex-col"
          : "panel relative overflow-hidden flex-1 min-h-0 bg-[#0a1218] border-[#2a3842] flex flex-col"
      }
    >
      <div className="editor-view-cluster">
        <div className="editor-viewbar" role="toolbar" aria-label="View and fullscreen">
          {viewTabs.map(({ mode, label, icon }) => (
            <button
              key={mode}
              type="button"
              className={`view-tab ${viewMode === mode ? "is-active" : ""}`}
              onClick={() => switchOfficialView(mode)}
            >
              {icon}
              {label}
            </button>
          ))}
          <button
            type="button"
            className="btn btn-secondary !py-1.5 !px-3 !text-xs editor-viewbar__fullscreen"
            onClick={() => setFullscreen((v) => !v)}
          >
            {fullscreen ? "Exit fullscreen" : "Fullscreen"}
          </button>
        </div>
        {viewMode === "persp3d" && (
          <Display3dToggle
            value={display3d}
            onChange={(mode) =>
              patchSceneUi((s) => ({
                ...s,
                ui: { ...s.ui, display3d: mode === "greyscale" ? "greyscale" : "falsecolor" },
              }))
            }
            showIsolines
            isolinesOn={planShowIsolines}
            isolinesEnabled={planIsoluxControls.enabled}
            isolinesReason={planIsoluxControls.reason}
            onShowIsolinesChange={(show) =>
              patchSceneUi((s) => ({
                ...s,
                ui: {
                  ...s.ui,
                  planShowIsolines: show,
                  planIsoluxMode: show && !planShowFalseColorFromUi(s.ui) ? "isolines" : "falsecolor",
                },
              }))
            }
            showValueLabels={planValueLabels}
            onShowValueLabelsChange={(show) =>
              patchSceneUi((s) => ({
                ...s,
                ui: { ...s.ui, planValueLabels: show },
              }))
            }
            showWorkplane={showWorkplane}
            onShowWorkplaneChange={(show) =>
              patchSceneUi((s) => ({
                ...s,
                ui: { ...s.ui, showWorkplane: show },
              }))
            }
          />
        )}
        {(viewMode === "top") && (
          <PlanIsoluxToggle
            showFalseColor={planShowFalseColor}
            onShowFalseColorChange={(show) =>
              patchSceneUi((s) => ({
                ...s,
                ui: {
                  ...s.ui,
                  planShowFalseColor: show,
                  planIsoluxMode: !show && planShowIsolinesFromUi({ ...s.ui, planShowFalseColor: show })
                    ? "isolines"
                    : "falsecolor",
                },
              }))
            }
            showIsolines={planShowIsolines}
            onShowIsolinesChange={(show) =>
              patchSceneUi((s) => ({
                ...s,
                ui: {
                  ...s.ui,
                  planShowIsolines: show,
                  planIsoluxMode: show && !planShowFalseColorFromUi({ ...s.ui, planShowIsolines: show })
                    ? "isolines"
                    : "falsecolor",
                },
              }))
            }
            showValueLabels={planValueLabels}
            onShowValueLabelsChange={(show) =>
              patchSceneUi((s) => ({
                ...s,
                ui: { ...s.ui, planValueLabels: show },
              }))
            }
            enabled={planIsoluxControls.enabled}
            reason={planIsoluxControls.reason}
          />
        )}
      </div>
      <div className="relative flex-1 min-h-0 bg-[#0a1218]">
      {(viewMode === "top") && (
        <TopView2D
          readOnly={readOnly}
          scene={scene}
          variant="top"
          results={results}
          showFalseColor={planShowFalseColor}
          paintFalseColorField={planShowFalseColor && !scaleDirty}
          showIsolines={planShowIsolines}
          showValueLabels={planValueLabels}
          falseColorScale={scale}
          underlayUrl={underlayUrl}
          dxfEntities={dxfEntities}
          selectedId={selectedId}
          onSelect={setSelectedId}
          photometry={photoCache}
          onDropLuminaire={(id, x, y) => placeAt(id, x, y)}
          onMoveInstance={(id, x, y) => moveInstance(id, x, y)}
          onBeginMoveInstance={beginMoveInstance}
          onDrawRoomPolygon={drawRoomPolygon}
          onDrawStoreyContour={drawStoreyContour}
          onMoveRoom={(roomId, dx, dy) => moveRoom(roomId, dx, dy)}
          onSetRoomPolygon={(roomId, polygon, opts) => setRoomPolygon(roomId, polygon, opts)}
          onVertexStretchStatus={setStatus}
          onMoveStorey={(storeyId, dx, dy) => moveStorey(storeyId, dx, dy)}
          onSelectRoom={(roomId) =>
            patchSceneUi((s) => ({
              ...s,
              ui: { ...s.ui, activeRoomId: roomId },
            }))
          }
          onCalibratePoints={onCalibrate}
          onUnderlaySourceSize={persistUnderlaySourceSize}
          arrayPreview={arrayPreview ?? undefined}
          linePick={linePick}
          linePickActive={linePickActive}
          onLinePickChange={setLinePick}
          circlePick={circlePick}
          circlePickActive={circlePickActive}
          onCirclePickChange={setCirclePick}
          polygonPick={polygonPick}
          polygonPickActive={polygonPickActive}
          onPolygonPickChange={setPolygonPick}
          unionPickActive={unionPickActive}
          unionPickMode={unionPickMode}
          onUnionRoomPick={onUnionRoomPick}
          onUnionPickCancel={cancelUnionRoomsPick}
          onDistributeApply={onDistributeApply}
          filletPickActive={filletPick.active}
          onFilletPickRoom={onFilletPickRoom}
          onFilletCornerPick={onFilletCornerPick}
          onFilletPickCancel={cancelFilletCornerPick}
          filletAllPickActive={filletAllPick.active}
          onFilletAllPickRoom={onFilletAllPickRoom}
          onFilletAllPickCancel={cancelFilletAllCornersPick}
          rcpProposals={scene.rcpProposals ?? []}
          showRcpOverlay={showRcpOverlay && workflow === "light"}
          selectedRcpId={selectedRcpId}
        />
      )}
      {viewMode === "front" && (
        <ElevationView2D
          readOnly={readOnly}
          scene={scene}
          mode="front"
          selectedId={selectedId}
          onSelect={setSelectedId}
          photometry={photoCache}
          onDropLuminaire={(id, a, z) => {
            const room = activeRoom ?? scene.rooms.find((r) => r.storeyId === scene.ui.activeStoreyId);
            if (!room) {
              setStatus("Create/select a room first");
              return;
            }
            const b = room.polygon[0]!;
            placeAt(id, a, (roomBoundsSafe(room).minY + roomBoundsSafe(room).maxY) / 2, z);
            void b;
          }}
          onMoveInstance={(id, a, z) => {
            const inst = scene.instances.find((i) => i.instanceId === id);
            if (!inst) return;
            moveInstance(id, a, inst.position.y, z);
          }}
          onBeginMoveInstance={beginMoveInstance}
        />
      )}
      {viewMode === "side" && (
        <ElevationView2D
          readOnly={readOnly}
          scene={scene}
          mode="side"
          selectedId={selectedId}
          onSelect={setSelectedId}
          photometry={photoCache}
          onDropLuminaire={(id, a, z) => {
            const room = activeRoom ?? scene.rooms.find((r) => r.storeyId === scene.ui.activeStoreyId);
            if (!room) {
              setStatus("Create/select a room first");
              return;
            }
            placeAt(id, (roomBoundsSafe(room).minX + roomBoundsSafe(room).maxX) / 2, a, z);
          }}
          onMoveInstance={(id, a, z) => {
            const inst = scene.instances.find((i) => i.instanceId === id);
            if (!inst) return;
            moveInstance(id, inst.position.x, a, z);
          }}
          onBeginMoveInstance={beginMoveInstance}
        />
      )}
      {viewMode === "persp3d" && (
        <BuildingScene3D
          readOnly={readOnly}
          scene={scene}
          results={results}
          display3d={display3d}
          selectedId={selectedId}
          onSelect={setSelectedId}
          photometry={photoCache}
          onDropLuminaire={(id, x, y, z) => placeAt(id, x, y, z)}
          className="h-full"
          underlayUrl={underlayUrl}
          dxfEntities={dxfEntities}
          onUnderlaySourceSize={persistUnderlaySourceSize}
          viewRef={camera3dRef}
          initialView={scene.ui.camera3d ?? camera3dRef.current}
          falseColorScale={scale}
          showIlluminanceField={!scaleDirty}
          showValueLabels={planValueLabels}
          showIsolines={planShowIsolines}
          showWorkplane={showWorkplane}
          onViewReady={markOfficialViewReady}
        />
      )}
      {showScaleApplyPrompt && (
        <FalseColorScaleApplyPrompt
          palette={scaleApplyPalette}
          onApply={applyViewFalseColorScale}
        />
      )}
      </div>
      {workflow === "calculation" &&
        ((viewMode === "persp3d" && (display3d === "falsecolor" || display3d === "greyscale")) ||
          (viewMode === "top" && planShowFalseColor && results)) && (
        <FalseColorLegend
          emin={autoScale.minLux}
          emax={autoScale.maxLux}
          results={activeResults}
          scale={pendingScale}
          onChange={setPendingViewFalseColorScale}
          onReset={() => setPendingViewFalseColorScale(autoScale)}
          onApply={applyViewFalseColorScale}
          canApply={scaleDirty}
          layout="bar"
          tone="dark"
          palette={scaleApplyPalette}
        />
      )}
    </div>
  );

  return (
    <div className="cad-editor">
      {officialWait.dialog}
      <div className="cad-chrome">
      <header className="cad-file-bar">
        <span className="text-[10px] uppercase tracking-widest text-[#8fa3ad] shrink-0">Project</span>
        <OfficialMaybeInput
          id="projectName"
          className={readOnly ? "cad-project-name official-view-value" : "cad-project-input"}
          value={name}
          readOnly={readOnly}
          onChange={(e) => {
            beginCoalesce("name");
            setName(e.target.value);
          }}
          onBlur={endCoalesce}
          aria-label="Project name"
        />
        <p className="cad-disclaimer hidden lg:block">
          Design assist · not tender-certified
        </p>
      </header>

      <nav className="cad-ribbon" role="tablist" aria-label="Workflow mode">
        {WORKFLOW_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={workflow === m.id}
            className={`cad-ribbon__mode ${workflow === m.id ? "is-active" : ""}`}
            onClick={() => setWorkflowMode(m.id)}
          >
            {modeIcons[m.id]}
            {m.label}
          </button>
        ))}
        <span className="cad-ribbon__hint">{workflowMeta.hint}</span>
        <div className="cad-ribbon__actions">
          {readOnly ? (
            <span className="text-xs text-[#8fa3ad]">View only</span>
          ) : (
            <>
          <button
            type="button"
            className="btn btn-secondary !text-xs"
            disabled={!canUndo}
            onClick={undoEdit}
          >
            Undo
          </button>
          <button
            type="button"
            className="btn btn-secondary !text-xs"
            disabled={!canRedo}
            onClick={redoEdit}
          >
            Redo
          </button>
          <button type="button" className="btn btn-secondary !text-xs" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            className="btn btn-secondary !text-xs"
            disabled={calculating}
            onClick={() => void runCalc("room")}
          >
            {calculating && calcTarget === "room" ? "Calculating…" : "Calc room"}
          </button>
          <button
            type="button"
            className="btn btn-secondary !text-xs"
            disabled={calculating}
            onClick={() => void runCalc("storey")}
            title="Calc storey / 計算樓層"
          >
            {calculating && calcTarget === "storey" ? "Calculating…" : "Calc storey"}
          </button>
          <HelpTip helpKey="calc.storey" />
          <button
            type="button"
            className="btn btn-accent !text-xs"
            disabled={calculating}
            onClick={() => void runCalc("all")}
          >
            {calculating && calcTarget === "all" ? "Calculating…" : "Calc all"}
          </button>
            </>
          )}
          {status && (
            <span
              className={`cad-file-bar__status${calcStatusTone(status, calculating) ? ` is-${calcStatusTone(status, calculating)}` : ""}`}
              role="status"
              aria-live="polite"
            >
              {status}
            </span>
          )}
        </div>
      </nav>
      </div>

      {readOnly && (
        <p className="view-only-banner" role="status">
          View only — you can browse this project, but you cannot edit it.
        </p>
      )}

      {workflow === "light" && !activeRoom && (
        <p className="workflow-banner">Select a room in the building tree — luminaires need a closed space.</p>
      )}

      <div
        className={editorChromeBodyClassName({
          showLeftRail,
          showRightRail,
          minimized: chromeMin,
        })}
      >
        {showLeftRail && (
        <aside
          className="cad-left space-y-1"
          data-cad-left-rail=""
          data-minimized={chromeMin.left ? "true" : undefined}
        >
          <div className="cad-chrome-panel-bar">
            <EditorChromeToggle
              panel="left"
              minimized={chromeMin.left}
              onToggle={() => setChromePanelMinimized("left", !chromeMin.left)}
            />
          </div>
          {!chromeMin.left && (
          <>
          {showLeftDocumentation && (
          <div className="border-t border-[#3d5563] pt-2 space-y-2" data-documentation-export="">
            <p className="cad-section-title">Documentation &amp; export</p>
            {!readOnly && (
              <ProjectSharePanel projectId={projectId} />
            )}
            {!readOnly && (
            <>
            <button className="btn btn-secondary w-full" onClick={() => void exportFullPdf()}>
              Full PDF report
            </button>
            <button
              className="btn btn-secondary w-full"
              onClick={() => void saveOfficialLuxFile()}
            >
              Save .lxm
            </button>
            <button
              className="btn btn-accent w-full"
              data-help-key="export.dialuxVerification"
              onClick={() => void onExportDialuxVerification()}
            >
              Verification pack (zip)
            </button>
            <p className="text-[10px] text-[var(--muted)]">
              Multi-room geometry, IES/LDT, DXF, and results CSV for an independent cross-check.
            </p>
            </>
            )}
          </div>
          )}
          {showLeftBuilding && (
          <>
          {showConstructionPlan && !readOnly && (
          <div className="border-t border-[#3d5563] pt-2 space-y-2">
            <p className="cad-section-title">Import plan</p>
            <input
              ref={planRef}
              className="input text-xs"
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.pdf,.dxf,.dwg,.ifc"
              disabled={uploading}
              onChange={(e) => void importPlan(e.target.files?.[0] ?? null)}
            />
            <p className="text-[10px] text-[var(--muted)]">
              Image / PDF / DXF / DWG / IFC
            </p>
            {renderCurrentPlanFile()}
            {underlay && (
              <div>
                <label className="label">Underlay opacity</label>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={underlay.opacity}
                  onChange={(e) =>
                    patchScene((s) => ({
                      ...s,
                      underlays: s.underlays.map((u) =>
                        u.id === underlay.id
                          ? { ...u, opacity: Number(e.target.value) }
                          : u
                      ),
                    }))
                  }
                />
              </div>
            )}
            {underlay?.kind === "pdf" && (underlay.pdfPageCount ?? 0) > 1 && (
              <div>
                <label className="label">PDF page</label>
                <OfficialMaybeSelect
                  readOnly={readOnly}
                  className="select !text-xs"
                  value={underlay.pageIndex ?? 0}
                  disabled={uploading}
                  onChange={(e) => void setPdfUnderlayPage(Number(e.target.value))}>
                  {Array.from({ length: underlay.pdfPageCount ?? 1 }, (_, i) => (
                    <option key={i} value={i}>
                      Page {i + 1}
                    </option>
                  ))}
                </OfficialMaybeSelect>
              </div>
            )}
            {underlay?.kind === "pdf" && underlay.rasterDpi && (
              <p className="text-[10px] text-[#8fa3ad]">
                Raster {underlay.sourceWidthPx}×{underlay.sourceHeightPx}px @{" "}
                {underlay.rasterDpi} DPI
              </p>
            )}
            {underlay && officialHasParsedCadLinework(underlay) && (
              <PlanLayerPanel
                layerNames={officialCadLayerNames(cadSourceEntities(underlay), planLayerTable(underlay))}
                hiddenLayers={layerDraftHidden ?? underlay.hiddenLayers ?? []}
                disabled={uploading}
                onHiddenLayersChange={setLayerDraftHidden}
                onApply={() => void applyPlanLayers()}
              />
            )}
          </div>
          )}

          {showConstructionPlan && readOnly && underlay ? (
            <div className="border-t border-[#3d5563] pt-2 space-y-2">
              {renderCurrentPlanFile()}
              {officialHasParsedCadLinework(underlay) ? (
                <PlanLayerPanel
                  layerNames={officialCadLayerNames(cadSourceEntities(underlay), planLayerTable(underlay))}
                  hiddenLayers={underlay?.hiddenLayers ?? []}
                  disabled
                  readOnlyList
                />
              ) : null}
            </div>
          ) : null}

          <p className="cad-section-title">Building</p>
          {showConstructionEditors && !readOnly && (
            <>
              <button type="button" className="btn btn-secondary w-full !text-xs" onClick={addStorey}>
                Add storey
              </button>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  data-help-key="tool.copyStorey"
                  className="btn btn-secondary w-full !text-xs"
                  onClick={copyStorey}
                >
                  Copy storey
                </button>
                <HelpTip helpKey="tool.copyStorey" />
              </div>
            </>
          )}
          <ul className="space-y-0.5">
            {scene.storeys.map((st) => (
              <li key={st.id}>
                <button
                  type="button"
                  className={`cad-tree-btn ${
                    st.id === scene.ui.activeStoreyId ? "is-storey-active" : ""
                  }`}
                  onClick={() =>
                    patchSceneUi((s) => ({
                      ...s,
                      ui: { ...s.ui, activeStoreyId: st.id, activeRoomId: null },
                    }))
                  }
                >
                  {st.name}{" "}
                  <span className="text-[#8fa3ad] text-xs">({st.elevationM.toFixed(1)} m)</span>
                </button>
                <ul className="ml-2 border-l border-[#3d5563] pl-1">
                  {scene.rooms
                    .filter((r) => r.storeyId === st.id)
                    .map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          className={`cad-tree-btn text-xs ${
                            r.id === scene.ui.activeRoomId ? "is-room-active" : ""
                          }`}
                          onClick={() =>
                            patchSceneUi((s) => ({
                              ...s,
                              ui: {
                                ...s.ui,
                                activeStoreyId: st.id,
                                activeRoomId: r.id,
                              },
                            }))
                          }
                        >
                          {r.name}
                        </button>
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>

          {showConstructionEditors && activeStorey && (
            <div className="border-t border-[#3d5563] pt-2 space-y-2">
              <p className="text-xs font-semibold text-white/95">{activeStorey.name}</p>
              <label className="label" htmlFor="storeyElevationM">
                Elevation (m)
              </label>
              <OfficialMaybeInput
                  readOnly={readOnly}
                id="storeyElevationM"
                className="input"
                type="number"
                step={0.1}
                value={activeStorey.elevationM}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (!Number.isFinite(next)) return;
                  applyStoreyMetrics({ elevationM: next });
                }}
               />
              <div className="flex items-center justify-between">
                <label className="label mb-0" htmlFor="storeyHeightM">
                  Storey height (m)
                </label>
                <HelpTip helpKey="tool.storeyHeight" />
              </div>
              <OfficialMaybeInput
                  readOnly={readOnly}
                id="storeyHeightM"
                className="input"
                type="number"
                min={0.5}
                step={0.1}
                value={activeStorey.heightM}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (!(next >= 0.5)) return;
                  applyStoreyMetrics({ heightM: next });
                }}
               />
            </div>
          )}

          {showConstructionEditors && (
          <div className="border-t border-[#3d5563] pt-2 space-y-2">
            <div className="flex items-center justify-between">
              <label className="label mb-0" htmlFor="buildingRoomHeightMm">
                Room height (mm)
              </label>
              <HelpTip helpKey="tool.roomHeight" />
            </div>
            <OfficialMaybeInput
                  readOnly={readOnly}
              id="buildingRoomHeightMm"
              className="input"
              type="number"
              min={500}
              step={100}
              data-help-key="tool.roomHeight"
              value={roomHeightMm}
              onChange={(e) => applyRoomHeightMm(e.target.value)}
             />
          </div>
          )}

          {showConstructionTools && (
          <div className="border-t border-[#3d5563] pt-2 space-y-2">
            <h3 className="font-semibold text-sm text-white/95">Tools</h3>
            {(
              [
                ["select", "Select / move", null, IconSelect] as const,
                ["drawRoom", "Draw room", "tool.drawRoom", IconDrawRoom] as const,
                ["drawStoreyContour", "Draw storey contour", "tool.drawStoreyContour", IconDrawRoom] as const,
                ["calibrate", "Calibrate scale", null, IconCalibrate] as const,
              ] as const
            ).map(([tool, label, helpKey, Icon]) => (
              <div key={tool} className="flex items-center gap-1">
                <button
                  type="button"
                  data-help-key={helpKey ?? undefined}
                  className={`btn w-full !text-xs justify-start ${
                    scene.ui.tool === tool ? "btn-accent" : "btn-secondary"
                  }`}
                  onClick={() => selectEditorTool(tool)}
                >
                  <Icon className="w-4 h-4 shrink-0 opacity-90" />
                  {label}
                </button>
                {helpKey && <HelpTip helpKey={helpKey} />}
              </div>
            ))}
            {!officialDrawRoomAllowed(underlay) && (
              <p className="text-[10px] text-[var(--muted)]">
                {UNCALIBRATED_DRAW_ROOM_STATUS}
              </p>
            )}
            {scene.ui.tool === "calibrate" && (
              <div>
                <label className="label">Real distance (m)</label>
                <OfficialMaybeInput
                  readOnly={readOnly}
                  className="input"
                  value={calibDist}
                  onChange={(e) => setCalibDist(e.target.value)}
                 />
                <p className="text-[10px] text-[var(--muted)] mt-1">
                  Click two points on the plan after setting distance.
                </p>
              </div>
            )}
            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Rectangle L×W</h3>
                <HelpTip helpKey="tool.drawRect" />
              </div>
              <label className="label">Length (mm)</label>
              <OfficialMaybeInput
                  readOnly={readOnly}
                className="input"
                value={rectLenMm}
                onChange={(e) => setRectLenMm(e.target.value)}
               />
              <label className="label">Width (mm)</label>
              <OfficialMaybeInput
                  readOnly={readOnly}
                className="input"
                value={rectWidMm}
                onChange={(e) => setRectWidMm(e.target.value)}
               />
              <button
                type="button"
                data-help-key="tool.drawRect"
                className="btn btn-secondary w-full !text-xs justify-start"
                onClick={createRectRoom}
              >
                <IconRect className="w-4 h-4 shrink-0 opacity-90" />
                Create rectangle
              </button>
              <div className="flex items-center gap-1 pt-1">
                <button
                  type="button"
                  data-help-key="tool.createRoomsFromDxf"
                  className="btn btn-secondary w-full !text-xs justify-start"
                  disabled={!officialCanCreateRoomsFromDxf(underlay)}
                  onClick={() => void createRoomsFromDxf()}
                >
                  <IconDrawRoom className="w-4 h-4 shrink-0 opacity-90" />
                  Create rooms from DXF
                </button>
                <HelpTip helpKey="tool.createRoomsFromDxf" />
              </div>
              <div className="flex items-center gap-1 pt-1">
                <button
                  type="button"
                  data-help-key="tool.unionRooms"
                  className={`btn w-full !text-xs justify-start ${
                    booleanPick.active && booleanPick.kind === "union" ? "btn-accent" : "btn-secondary"
                  }`}
                  onClick={startUnionRooms}
                >
                  <IconDrawRoom className="w-4 h-4 shrink-0 opacity-90" />
                  Union rooms
                </button>
                <HelpTip helpKey="tool.unionRooms" />
              </div>
              <div className="flex items-center gap-1 pt-1">
                <button
                  type="button"
                  data-help-key="tool.subtractRooms"
                  className={`btn w-full !text-xs justify-start ${
                    booleanPick.active && booleanPick.kind === "subtract" ? "btn-accent" : "btn-secondary"
                  }`}
                  onClick={startSubtractRooms}
                >
                  <IconDrawRoom className="w-4 h-4 shrink-0 opacity-90" />
                  Subtract rooms
                </button>
                <HelpTip helpKey="tool.subtractRooms" />
              </div>
              <div className="flex items-center gap-1 pt-1">
                <button
                  type="button"
                  data-help-key="tool.intersectRooms"
                  className={`btn w-full !text-xs justify-start ${
                    booleanPick.active && booleanPick.kind === "intersect" ? "btn-accent" : "btn-secondary"
                  }`}
                  onClick={startIntersectRooms}
                >
                  <IconDrawRoom className="w-4 h-4 shrink-0 opacity-90" />
                  Intersect rooms
                </button>
                <HelpTip helpKey="tool.intersectRooms" />
              </div>
              <div className="flex items-center gap-1 pt-1">
                <button
                  type="button"
                  data-help-key="tool.xorRooms"
                  className={`btn w-full !text-xs justify-start ${
                    booleanPick.active && booleanPick.kind === "xor" ? "btn-accent" : "btn-secondary"
                  }`}
                  onClick={startXorRooms}
                >
                  <IconDrawRoom className="w-4 h-4 shrink-0 opacity-90" />
                  XOR rooms
                </button>
                <HelpTip helpKey="tool.xorRooms" />
              </div>
              <div className="flex items-center gap-1 pt-1">
                <button
                  type="button"
                  data-help-key="tool.alignRooms"
                  className={`btn w-full !text-xs justify-start ${
                    booleanPick.active && booleanPick.kind === "align" ? "btn-accent" : "btn-secondary"
                  }`}
                  onClick={startAlignRooms}
                >
                  <IconDrawRoom className="w-4 h-4 shrink-0 opacity-90" />
                  Align rooms
                </button>
                <HelpTip helpKey="tool.alignRooms" />
              </div>
              <div className="grid grid-cols-3 gap-1">
                {OFFICIAL_ROOM_ALIGN_AXES.map((axis) => (
                  <button
                    key={axis}
                    type="button"
                    className={`btn !text-[10px] !px-1 !py-1 ${
                      alignAxis === axis ? "btn-accent" : "btn-secondary"
                    }`}
                    aria-pressed={alignAxis === axis}
                    onClick={() => setAlignAxis(axis)}
                  >
                    {officialRoomAlignAxisLabel(axis)}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 pt-1">
                <button
                  type="button"
                  data-help-key="tool.distributeRooms"
                  className={`btn w-full !text-xs justify-start ${
                    distributePick.active ? "btn-accent" : "btn-secondary"
                  }`}
                  onClick={startDistributeRooms}
                >
                  <IconDrawRoom className="w-4 h-4 shrink-0 opacity-90" />
                  Distribute rooms
                </button>
                <HelpTip helpKey="tool.distributeRooms" />
              </div>
              <div className="grid grid-cols-2 gap-1">
                {OFFICIAL_ROOM_DISTRIBUTE_AXES.map((axis) => (
                  <button
                    key={axis}
                    type="button"
                    className={`btn !text-[10px] !px-1 !py-1 ${
                      distributeAxis === axis ? "btn-accent" : "btn-secondary"
                    }`}
                    aria-pressed={distributeAxis === axis}
                    onClick={() => setDistributeAxis(axis)}
                  >
                    {officialRoomDistributeAxisLabel(axis)}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 pt-1">
                <button
                  type="button"
                  data-help-key="tool.filletCorner"
                  className={`btn w-full !text-xs justify-start ${
                    filletPick.active ? "btn-accent" : "btn-secondary"
                  }`}
                  onClick={startFilletCorner}
                >
                  <IconDrawRoom className="w-4 h-4 shrink-0 opacity-90" />
                  Fillet corner
                </button>
                <HelpTip helpKey="tool.filletCorner" />
              </div>
              <div className="flex items-center gap-1 pt-1">
                <button
                  type="button"
                  data-help-key="tool.filletAllCorners"
                  className={`btn w-full !text-xs justify-start ${
                    filletAllPick.active ? "btn-accent" : "btn-secondary"
                  }`}
                  onClick={startFilletAllCorners}
                >
                  <IconDrawRoom className="w-4 h-4 shrink-0 opacity-90" />
                  Fillet all corners
                </button>
                <HelpTip helpKey="tool.filletAllCorners" />
              </div>
              <label className="label">Radius (mm)</label>
              <OfficialMaybeInput
                  readOnly={readOnly}
                className="input"
                value={filletRadiusMm}
                onChange={(e) => setFilletRadiusMm(e.target.value)}
               />
            </div>
          </div>
          )}

          </>
          )}
          </>
          )}
        </aside>
        )}

        <section className="cad-center">
          <div className="cad-viewport-wrap">
            {viewport}
          </div>

          {showFixturesTable && (
          <div
            className={
              chromeMin.fixtures
                ? "cad-fixtures-panel cad-fixtures-panel--minimized"
                : "cad-fixtures-panel"
            }
            data-fixtures-in-project=""
          >
            <div className="cad-chrome-panel-bar">
              <p className="cad-section-title">Fixtures in project ({scene.instances.length})</p>
              <EditorChromeToggle
                panel="fixtures"
                minimized={chromeMin.fixtures}
                onToggle={() => setChromePanelMinimized("fixtures", !chromeMin.fixtures)}
              />
            </div>
            {!chromeMin.fixtures && (
            <div className="shrink-0 px-2 pb-2 max-h-40 overflow-auto">
            <table className="cad-fixtures-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Room</th>
                  <th>Pos</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {scene.instances.map((inst, idx) => {
                  const room = scene.rooms.find((r) => r.id === inst.roomId);
                  return (
                    <tr
                      key={inst.instanceId}
                      className={`cursor-pointer ${
                        inst.instanceId === selectedId ? "is-selected" : ""
                      }`}
                      onClick={() => setSelectedId(inst.instanceId)}
                    >
                      <td>{idx + 1}</td>
                      <td>{inst.name}</td>
                      <td>{room?.name ?? "—"}</td>
                      <td className="tabular-nums text-[#8fa3ad]">
                        {inst.position.x.toFixed(1)}, {inst.position.y.toFixed(1)},{" "}
                        {inst.position.z.toFixed(1)}
                      </td>
                      <td className="text-right">
                        {!readOnly && (
                          <button
                            type="button"
                            className="text-xs text-[#f5a5a5]"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeInstance(inst.instanceId);
                            }}
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!scene.instances.length && (
                  <tr>
                    <td colSpan={5} className="text-[#8fa3ad] py-2">
                      {readOnly ? "No fixtures in this project." : "Drag fixtures from the library onto a room."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
            )}
          </div>
          )}
        </section>

        {showRightRail && (
        <aside
          className="cad-right space-y-2"
          data-cad-right-rail=""
          data-minimized={chromeMin.right ? "true" : undefined}
        >
          <div className="cad-chrome-panel-bar">
            <EditorChromeToggle
              panel="right"
              minimized={chromeMin.right}
              onToggle={() => setChromePanelMinimized("right", !chromeMin.right)}
            />
          </div>
          {!chromeMin.right && (
          <>
          {showRightIsolines && (
            <details className="cad-props-card isoline-levels-panel" data-isoline-levels-panel="">
              <summary className="cursor-pointer text-xs font-semibold">
                Isoline levels / 等照度線數值
              </summary>
              <IsolineLevelsControls
                className="mt-2"
                settings={isolineSettings}
                enabled
                readOnly={readOnly}
                hideHeading
                onCommit={commitIsolineSettings}
                onInvalid={setStatus}
              />
            </details>
          )}
          {(showRightConstructionRoom || showRightCalculationRoom || showRightFixtureProps) && (
            <p className="cad-section-title">Properties</p>
          )}
          {showRightConstructionRoom && (
            <div className="cad-props-card space-y-2" data-construction-room-props="">
              <p className="text-xs font-semibold">{activeRoom.name}</p>
              <div className="flex items-center justify-between">
                <label className="label mb-0" htmlFor="roomHeightMm">
                  Height (mm)
                </label>
                <HelpTip helpKey="tool.roomHeight" />
              </div>
              <OfficialMaybeInput
                  readOnly={readOnly}
                id="roomHeightMm"
                className="input"
                type="number"
                min={500}
                step={100}
                data-help-key="tool.roomHeight"
                value={roomHeightMm}
                onChange={(e) => applyRoomHeightMm(e.target.value)}
               />
              <p className="label mb-0">Area</p>
              <p className="text-sm tabular-nums">{formatAreaM2(roomAreaM2(activeRoom))}</p>
              <p className="label mb-0">Origin (first corner)</p>
              <p className="text-sm tabular-nums">{formatOriginMetres(activeRoom.polygon[0])}</p>
              {shouldShowBoundingMin(activeRoom.polygon[0], roomBounds(activeRoom)) && (
                <>
                  <p className="label mb-0">Bounding min</p>
                  <p className="text-sm tabular-nums">
                    {formatMetresXy(roomBounds(activeRoom).minX, roomBounds(activeRoom).minY)}
                  </p>
                </>
              )}
              {(["floor", "ceiling", "walls"] as const).map((face) => (
                <div key={face}>
                  <label className="label">ρ {face}</label>
                  <OfficialMaybeInput
                  readOnly={readOnly}
                    className="input"
                    type="number"
                    step={0.05}
                    min={0}
                    max={1}
                    value={activeRoom.reflectance[face]}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (!Number.isFinite(v)) return;
                      const rho = clampReflectance(v);
                      patchScene((s) => ({
                        ...s,
                        rooms: s.rooms.map((r) =>
                          r.id === activeRoom.id
                            ? {
                                ...r,
                                reflectance: { ...r.reflectance, [face]: rho },
                              }
                            : r
                        ),
                      }));
                    }}
                   />
                </div>
              ))}
            </div>
          )}
          {showRightCalculationRoom && (
            <div className="cad-props-card space-y-2" data-calculation-room-props="">
              <p className="text-xs font-semibold">{activeRoom.name}</p>
              <p className="label mb-0">Area</p>
              <p className="text-sm tabular-nums">{formatAreaM2(roomAreaM2(activeRoom))}</p>
              <div className="flex items-center justify-between gap-2">
                <label className="label mb-0">Workplane (m)</label>
                <label className="flex items-center gap-1 text-[11px] text-[var(--muted)]">
                  <input
                    type="checkbox"
                    checked={showWorkplane}
                    onChange={(e) =>
                      patchSceneUi((s) => ({
                        ...s,
                        ui: { ...s.ui, showWorkplane: e.target.checked },
                      }))
                    }
                    data-show-workplane=""
                  />
                  Show
                </label>
              </div>
              <OfficialMaybeInput
                  readOnly={readOnly}
                className="input"
                type="number"
                step={0.05}
                min={0}
                max={Math.max(0, activeRoom.heightM - WORKPLANE_CLEARANCE_M)}
                value={activeRoom.workplaneHeightM}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (!Number.isFinite(next)) return;
                  const heightM = clampWorkplaneHeightM(next, activeRoom.heightM);
                  patchScene((s) => ({
                    ...s,
                    rooms: s.rooms.map((r) =>
                      r.id === activeRoom.id ? { ...r, workplaneHeightM: heightM } : r
                    ),
                  }));
                }}
               />
              <label className="label">Grid spacing (m)</label>
              <OfficialMaybeInput
                  readOnly={readOnly}
                className="input"
                type="number"
                step={0.1}
                min={GRID_SPACING_MIN_M}
                max={GRID_SPACING_MAX_M}
                value={activeRoom.calc.gridSpacing}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isFinite(v)) return;
                  const spacing = clampGridSpacingM(v);
                  patchScene((s) => ({
                    ...s,
                    rooms: s.rooms.map((r) =>
                      r.id === activeRoom.id
                        ? { ...r, calc: { ...r.calc, gridSpacing: spacing } }
                        : r
                    ),
                  }));
                }}
               />
              <div className="flex items-center justify-between gap-1">
                <label className="label mb-0">Maintenance factor (CIE 97)</label>
                <HelpTip helpKey="room.maintenanceFactor" />
              </div>
              {mfResolved?.source === "overall" ? (
                <p className="text-[10px] text-[var(--muted)]">
                  CIE 97 breakdown not active — using overall MF {mfResolved.mf.toFixed(3)}. Edit a component to rebuild the product.
                </p>
              ) : null}
              {(
                [
                  ["llmf", "LLMF (lamp lumen)"],
                  ["lsf", "LSF (luminaire surface)"],
                  ["lmf", "LMF (lamp survival)"],
                  ["rsmf", "RSMF (room surfaces)"],
                ] as const
              ).map(([key, lbl]) => (
                <div key={key}>
                  <label className="label">{lbl}</label>
                  <OfficialMaybeInput
                  readOnly={readOnly}
                    className="input"
                    type="number"
                    step={0.01}
                    min={0.5}
                    max={1}
                    value={activeMfBreakdown ? activeMfBreakdown[key] : ""}
                    placeholder="—"
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (!Number.isFinite(v)) return;
                      patchScene((s) => ({
                        ...s,
                        rooms: s.rooms.map((r) =>
                          r.id !== activeRoom.id
                            ? r
                            : { ...r, calc: applyMfComponentEdit(r.calc, key, v) }
                        ),
                      }));
                    }}
                   />
                </div>
              ))}
              <p className="text-[10px] text-[var(--muted)]">
                Product MF{" "}
                <strong>{mfResolved ? mfResolved.mf.toFixed(3) : "—"}</strong>{" "}
                {mfResolved?.source === "overall"
                  ? "(overall value; CIE 97 breakdown not active)."
                  : "(LLMF×LSF×LMF×RSMF, clamped 0.5–1)."}{" "}
                Used for maintained EN checks only — solver uses initial output.
              </p>
              <details className="text-xs">
                <summary className="cursor-pointer text-[var(--muted)]">Override overall MF</summary>
                <OfficialMaybeInput
                  readOnly={readOnly}
                  className="input mt-1"
                  type="number"
                  step={0.05}
                  min={0.5}
                  max={1}
                  data-help-key="room.maintenanceFactor"
                  value={clampMf(activeRoom.calc.maintenanceFactor)}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isFinite(v)) return;
                    patchScene((s) => ({
                      ...s,
                      rooms: s.rooms.map((r) =>
                        r.id === activeRoom.id
                          ? { ...r, calc: applyOverallMaintenanceFactor(r.calc, v) }
                          : r
                      ),
                    }));
                  }}
                 />
              </details>
              <div className="flex items-center justify-between gap-1">
                <label className="label mb-0">EN 12464-1 assist</label>
                <HelpTip helpKey="room.en12464" />
              </div>
              <OfficialMaybeSelect
                  readOnly={readOnly}
                className="select"
                data-help-key="room.en12464"
                value={activeRoom.calc.en12464TemplateId ?? ""}
                onChange={(e) => {
                  const id = e.target.value;
                  patchScene((s) => ({
                    ...s,
                    rooms: s.rooms.map((r) =>
                      r.id === activeRoom.id
                        ? { ...r, calc: { ...r.calc, en12464TemplateId: id } }
                        : r
                    ),
                  }));
                }}>
                {EN12464_TEMPLATES.map((t) => (
                  <option key={t.id || "none"} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </OfficialMaybeSelect>
              {en12464Check && (
                <div className="text-xs space-y-1 pt-1 border-t border-[var(--line)]">
                  <p className="text-[var(--muted)]">Maintained Ēm {en12464Check.maintainedEave.toFixed(0)} lx</p>
                  <PassRow label="Task Em" check={en12464Check.checks.taskEm} />
                  <PassRow label="Task Uo" check={en12464Check.checks.taskUo} />
                  <PassRow label="Surr. Em" check={en12464Check.checks.surroundingEm} />
                  <PassRow label="Background Em" check={en12464Check.checks.backgroundEm} />
                  <PassRow label="UGR" check={en12464Check.checks.ugr} />
                </div>
              )}
            </div>
          )}

          {showRightFixtureProps && (
            <div
              className="cad-props-card space-y-2"
              data-fixture-properties=""
            >
              <p className="text-xs uppercase text-[var(--muted)]">Selected fixture</p>
              <OfficialMaybeInput
                  readOnly={readOnly}
                className="input"
                value={selected.name}
                onChange={(e) =>
                  patchScene((s) => ({
                    ...s,
                    instances: s.instances.map((i) =>
                      i.instanceId === selected.instanceId
                        ? { ...i, name: e.target.value }
                        : i
                    ),
                  }))
                }
               />
              {(["x", "y", "z"] as const).map((axis) => (
                <div key={axis}>
                  <label className="label">{axis.toUpperCase()} (m)</label>
                  <OfficialMaybeInput
                  readOnly={readOnly}
                    className="input"
                    type="number"
                    step={0.1}
                    value={selected.position[axis]}
                    onChange={(e) =>
                      updateInstancePosition(
                        selected.instanceId,
                        axis,
                        Number(e.target.value)
                      )
                    }
                   />
                </div>
              ))}
              <div>
                <label className="label">Rotation (°)</label>
                <div className="flex gap-2">
                  <OfficialMaybeInput
                  readOnly={readOnly}
                    className="input flex-1"
                    type="number"
                    step={1}
                    value={selected.rotationDeg}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (!Number.isFinite(v)) return;
                      updateInstanceRotation(selected.instanceId, v);
                    }}
                   />
                  {!readOnly && (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary !px-2 !text-xs"
                        onClick={() =>
                          updateInstanceRotation(selected.instanceId, selected.rotationDeg - 90)
                        }
                      >
                        −90°
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary !px-2 !text-xs"
                        onClick={() =>
                          updateInstanceRotation(selected.instanceId, selected.rotationDeg + 90)
                        }
                      >
                        +90°
                      </button>
                    </>
                  )}
                </div>
                <p className="text-[10px] text-[var(--muted)] mt-1">
                  Arrow on Top view shows photometric rotation (IES C0 = +X at 0°).
                </p>
              </div>
              <FixtureLightConePreview
                photo={photoCache[selected.luminaireId]}
                fixtureZ={selected.position.z}
                room={scene.rooms.find((r) => r.id === selected.roomId) ?? null}
              />
            </div>
          )}

          {workflow === "light" && !readOnly && (
            <PlanCodePlacePanel
              disabled={!underlay || !officialHasParsedCadLinework(underlay)}
              rooms={scene.rooms.filter((r) => r.storeyId === scene.ui.activeStoreyId)}
              storeyId={scene.ui.activeStoreyId}
              codeMapRules={scene.fixtureCodeMap ?? []}
              luminaireNames={codeMapLuminaireNames}
              rows={planCodeRows}
              onRowsChange={setPlanCodeRows}
              scanning={planCodeScanning}
              onScan={() => void runPlanCodeScan()}
              calcAfterCommit={calcAfterPlanCode}
              onCalcAfterCommitChange={setCalcAfterPlanCode}
              replaceExisting={replacePlanCodeFixtures}
              onReplaceExistingChange={setReplacePlanCodeFixtures}
              committing={planCodeCommitting}
              onCommit={(opts) => void runPlanCodeCommit(opts)}
            />
          )}

          {workflow === "light" && (
            <RcpDetectPanel
              disabled={!underlay || (!underlay.pageRasterAssetId && underlay.kind !== "image")}
              detecting={rcpDetecting}
              proposals={scene.rcpProposals ?? []}
              codeMapRules={scene.fixtureCodeMap ?? []}
              luminaireNames={codeMapLuminaireNames}
              selectedId={selectedRcpId}
              onSelectId={setSelectedRcpId}
              onProposalsChange={(next) => patchScene((s) => ({ ...s, rcpProposals: next }))}
              showOverlay={showRcpOverlay}
              onShowOverlayChange={setShowRcpOverlay}
              onDetect={() => void runRcpDetect()}
              lastWarnings={rcpWarnings}
              scene={scene}
              committing={rcpCommitting}
              onCommit={(opts) => runRcpCommit(opts)}
            />
          )}

          {workflow === "light" && (
            <ScheduleImportPanel
              room={activeRoom}
              rooms={scene.rooms.filter((r) => r.storeyId === scene.ui.activeStoreyId)}
              storeyId={scene.ui.activeStoreyId}
              codeMapRules={scene.fixtureCodeMap ?? []}
              luminaireNames={codeMapLuminaireNames}
              rows={scheduleRows}
              onRowsChange={setScheduleRows}
              parseErrors={scheduleParseErrors}
              onParseErrorsChange={setScheduleParseErrors}
              calcAfterCommit={calcAfterSchedule}
              onCalcAfterCommitChange={setCalcAfterSchedule}
              committing={scheduleCommitting}
              onCommit={(opts) => void runScheduleCommit(opts)}
            />
          )}

          {workflow === "light" && (
            <FixtureCodeMapPanel
              rules={scene.fixtureCodeMap ?? []}
              luminaires={codeMapLuminaires}
              onChange={(rules) => patchScene((s) => ({ ...s, fixtureCodeMap: rules }))}
            />
          )}

          {workflow === "light" && !readOnly && (
            <FixtureArrayPanel
              room={activeRoom}
              existingInstances={scene.instances}
              luminaires={arrayLuminaireOptions}
              preview={arrayPreview}
              onPreviewChange={setArrayPreview}
              calcAfterPlace={calcAfterPlace}
              onCalcAfterPlaceChange={setCalcAfterPlace}
              applying={arrayApplying}
              onApply={(params, luminaireId) => void applyFixtureArray(params, luminaireId)}
              onCancel={() => {
                setArrayPreview(null);
                setLinePick(EMPTY_LINE_PICK);
                setCirclePick(EMPTY_CIRCLE_PICK);
                setPolygonPick(EMPTY_POLYGON_PATH_PICK);
              }}
              linePick={linePick}
              onLinePickChange={setLinePick}
              onLinePickActiveChange={setLinePickActive}
              circlePick={circlePick}
              onCirclePickChange={setCirclePick}
              onCirclePickActiveChange={setCirclePickActive}
              polygonPick={polygonPick}
              onPolygonPickChange={setPolygonPick}
              onPolygonPickActiveChange={setPolygonPickActive}
              runOfficialWait={officialWait.run}
            />
          )}

          {showRightFixtureLibrary && (
          <div className="border-t border-[#3d5563] pt-2 space-y-2" data-fixture-library="">
            <p className="cad-section-title">Fixture library</p>
{!readOnly && (
            <>
          <div>
            <label className="label">Add from org library</label>
            <OfficialMaybeSelect
                  readOnly={readOnly}
              className="select"
              defaultValue=""
              onChange={(e) => {
                addFromLibrary(e.target.value);
                e.target.value = "";
              }}>
              <option value="">Select…</option>
              {library.map((l) => (
                <option key={l.id} value={l.id}>
                  {luminaireListLabel(l.name, l)}
                </option>
              ))}
            </OfficialMaybeSelect>
          </div>

          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              className="sr-only"
              type="file"
              accept=".ies,.ldt,.gldf"
              disabled={uploading}
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => void onUploadPhotometry(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              className="btn btn-secondary w-full !text-xs"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              Upload IES / LDT / GLDF
            </button>
            <button
              type="button"
              className="btn btn-secondary w-full !text-xs"
              onClick={() => setGenerateLdtOpen(true)}
            >
              Generate LDT
            </button>
            <p className="text-[10px] text-[var(--muted)]">
              Adds to list only — drag to place on the plan.
            </p>
          </div>

            </>
          )}
          <ul className="space-y-2">
            {projectFixtures.map((lum) => (
              <li
                key={lum.id}
                draggable={!readOnly}
                onDragStart={(e) => {
                  if (readOnly) {
                    e.preventDefault();
                    return;
                  }
                  e.dataTransfer.setData("application/x-luxsim-luminaire", lum.id);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                className={`border border-[#3d5563] p-2 bg-[#243540] rounded-sm${readOnly ? "" : " cursor-grab active:cursor-grabbing"}`}
              >
                <div className="text-sm font-medium">{lum.name}</div>
                <div className="text-[10px] text-[var(--muted)] mb-1">
                  {libraryConeLabel(lum) ? `${libraryConeLabel(lum)} · ` : ""}
                  {lum.lumens ? Math.round(lum.lumens) : "—"} lm ·{" "}
                  {lum.watts ? Math.round(lum.watts) : "—"} W{readOnly ? "" : " · drag to plan"}
                </div>
                {photoCache[lum.id] && (
                  <>
                    <PolarPreview photo={photoCache[lum.id]!} size={120} />
                    <PhotometricColorQuality
                      photo={photoCache[lum.id]!}
                      className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]"
                    />
                  </>
                )}
              </li>
            ))}
            {!projectFixtures.length && (
              <li className="text-xs text-[var(--muted)]">No fixtures in project yet.</li>
            )}
          </ul>
          </div>
          )}

          </>
          )}
        </aside>
        )}
      </div>

      {showResultsStrip && (
      <div
        className={
          chromeMin.results
            ? "cad-results-chrome cad-results-chrome--minimized"
            : "cad-results-chrome"
        }
      >
        {chromeMin.results && (
          <p className="cad-section-title cad-chrome-panel-bar__label">Calculation results / 計算結果</p>
        )}
        {!chromeMin.results && (
      <EditorResultsStrip
        results={stripResults}
        en12464Check={activeRoom ? en12464Check : null}
        maintenanceFactor={
          activeRoom
            ? resolveMaintenanceFactor({
                maintenanceFactor: activeRoom.calc.maintenanceFactor,
                mfBreakdown: activeRoom.calc.mfBreakdown,
              }).mf
            : storeyAggregate?.maintenanceFactor ?? 0.8
        }
        roomName={activeRoom?.name ?? activeStorey?.name ?? null}
        scope={activeRoom ? "room" : activeStorey ? "storey" : "room"}
      />
        )}
        <EditorChromeToggle
          panel="results"
          minimized={chromeMin.results}
          onToggle={() => setChromePanelMinimized("results", !chromeMin.results)}
        />
      </div>
      )}

      <div className="cad-status-bar">
        {status || (readOnly ? "View only · browse this project — editing is not allowed" : "Click Save to keep your work · Undo / Redo (Ctrl+Z, Ctrl+Y or Ctrl+Shift+Z) · Top view: drop fixtures into rooms")}
        {assets.length > 0 && (
          <span className="ml-3 opacity-70">Assets: {assets.map((a) => a.fileName).join(", ")}</span>
        )}
      </div>
      <BuildModelFirstDialog
        open={buildModelFirstOpen}
        onDismiss={() => setBuildModelFirstOpen(false)}
      />
      <AskBuildAfterPlanDialog
        open={askBuildAfterPlanOpen && !readOnly}
        onSelfBuild={() => setAskBuildAfterPlanOpen(false)}
        onCreateFromPlan={() => void createStoreyAndRoomsFromPlan()}
      />
      <DiscardResultsDialog
        open={pendingDiscardRoomIds != null && !readOnly}
        onConfirm={confirmDiscardResults}
        onCancel={cancelDiscardResults}
      />
      <SaveReminderDialog
        open={saveReminderOpen}
        saving={saving}
        onSave={saveFromReminder}
        onLater={deferSaveReminder}
      />
      {!readOnly && (
        <GenerateLdtDialog
          open={generateLdtOpen}
          onClose={() => setGenerateLdtOpen(false)}
          onCreated={async (lum, photometric) => {
            await loadLibrary();
            setPhotoCache((c) => ({ ...c, [lum.id]: photometric }));
            patchScene((s) => ({
              ...s,
              fixtureLibraryIds: s.fixtureLibraryIds.includes(lum.id)
                ? s.fixtureLibraryIds
                : [...s.fixtureLibraryIds, lum.id],
            }));
            setStatus(`Generated “${lum.name}” and added to project fixture list (not placed)`);
          }}
        />
      )}
    </div>
  );
}

function PassRow({
  label,
  check,
}: {
  label: string;
  check: { pass: boolean | null; target: number | null; actual: number | null; note?: string };
}) {
  if (check.pass === null && check.target == null && !check.note) return null;
  const detail =
    check.actual != null && check.target != null
      ? label.includes("Uo")
        ? `${check.actual.toFixed(2)} / ${check.target}`
        : label.includes("UGR")
          ? `${check.actual.toFixed(1)} / ${check.target}`
          : `${check.actual.toFixed(0)} / ${check.target} lx`
      : check.target != null
        ? `target ${check.target}${label.includes("UGR") ? "" : " lx"}`
        : "";
  if (check.pass === null) {
    const pending = enAssistPendingStatus(check);
    return (
      <div className="flex flex-col gap-0.5 text-[var(--muted)]">
        <span>
          {label} {detail && `(${detail})`} — {pending.label}
        </span>
        {pending.showNoteBelow && check.note && <span className="text-[10px]">{check.note}</span>}
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-2">
      <span>
        {label} {detail && <span className="text-[var(--muted)]">({detail})</span>}
      </span>
      <span className={`pass-badge ${check.pass ? "ok" : "fail"}`}>
        {check.pass ? "pass" : "fail"}
      </span>
    </div>
  );
}

function roomBoundsSafe(room: { polygon: { x: number; y: number }[] }) {
  const xs = room.polygon.map((p) => p.x);
  const ys = room.polygon.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}
