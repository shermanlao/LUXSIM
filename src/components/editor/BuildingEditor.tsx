"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import type { PhotometricData } from "@luxsim/photometry";
import {
  buildFullReportPdf,
  gridToFalseColorPngDataUrl,
  collectOfficialIsoluxSnapshots,
  defaultDisplay3d,
  findRoomAt,
  fitOverviewCamera,
  applyUnderlayCalibration,
  isDisplayableRasterUnderlay,
  officialImportedUnderlay,
  officialDrawRoomAllowed,
  officialDrawRoomBlockedReason,
  officialAppendDrawnRoom,
  officialAppendRoomsFromDxfClosedPolylines,
  officialCanCreateRoomsFromDxf,
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
  DISTRIBUTE_ROOMS_CANCELLED_STATUS,
  DEFAULT_OFFICIAL_ROOM_DISTRIBUTE_AXIS,
  OFFICIAL_ROOM_DISTRIBUTE_AXES,
  officialRoomDistributeAxisLabel,
  type OfficialRoomDistributeAxis,
  applyOfficialRoomHeightMm,
  resolveOfficialNewRoomHeightM,
  DEFAULT_NEW_ROOM_HEIGHT_M,
  DEFAULT_NEW_ROOM_HEIGHT_MM,
  STOREY_METRICS_EXPLANATION,
  officialAppendStorey,
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
  type Camera3dView,
  type Display3dMode,
  type DxfEntity,
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
  formatArrayApplyStatus,
  prepareFixtureArrayApply,
} from "@/lib/array-occupied";
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
  focusActiveRoomAfterPlacement,
  postPlaceCalcStatusSuffix,
} from "@/lib/post-place-calc";
import {
  patchProjectMinimal,
  projectPatchDiff,
  snapshotProject,
  type ProjectSnapshot,
} from "@/lib/project-autosave";
import { saveReminderDue, startSaveReminderEpoch } from "@/lib/save-reminder";
import { useAccountSettings } from "@/components/AccountSettingsProvider";
import {
  calcStatusTone,
  formatCalcEmptyError,
  planCalcRooms,
} from "@/lib/editor-calc-rooms";
import { runOfficialClientCalc } from "@/lib/official-client-calc";
import {
  createUndoStack,
  editorUndoKeyAction,
  isTypingField,
} from "@/lib/editor-undo";
import { FalseColorLegend } from "./FalseColorLegend";
import { EditorResultsStrip } from "./EditorResultsStrip";
import { RcpDetectPanel } from "./RcpDetectPanel";
import { FixtureArrayPanel } from "./FixtureArrayPanel";
import { ScheduleImportPanel } from "./ScheduleImportPanel";
import { FixtureCodeMapPanel } from "./FixtureCodeMapPanel";
import { Display3dToggle } from "./Display3dToggle";
import { PlanIsoluxToggle } from "./PlanIsoluxToggle";
import {
  planIsoluxControlState,
  planShowFalseColorFromUi,
  planShowIsolinesFromUi,
} from "@/lib/plan-isolux-display";
import { showWorkplaneFromUi } from "@/lib/workplane-display";
import { captureOfficialReport3dViews } from "@/lib/official-pdf-3d-capture";
import { renderAllReport3dViews, webglCaptureAvailable } from "@/lib/render-scene-3d";
import { TopView2D } from "./TopView2D";
import { ElevationView2D } from "./ElevationView2D";
import { DiscardResultsDialog } from "./DiscardResultsDialog";
import { SaveReminderDialog } from "./SaveReminderDialog";
import { FixtureLightConePreview } from "./FixtureLightConePreview";
import { PolarPreview } from "@/components/PolarPreview";
import { PhotometricColorQuality } from "@/components/PhotometricColorQuality";
import { GenerateLdtForm } from "@/components/GenerateLdtForm";
import { OfficialWaitDialog } from "@/components/OfficialWaitDialog";
import { useOfficialWaitDialog } from "@/components/useOfficialWaitDialog";
import { OFFICIAL_WAIT_COPY } from "@/lib/official-wait-dialog";
import { shouldApplyViewFalseColorScale } from "@/lib/false-color-scale-commit";
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
};

function nid(prefix: string) {
  return prefixedId(prefix);
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
};

export function BuildingEditor({
  projectId,
  initialName,
  initialScene,
  initialResults,
  initialAssets = [],
}: Props) {
  const [name, setName] = useState(initialName);
  const [scene, setScene] = useState<ProjectSceneV2>(initialScene);
  const [results, setResults] = useState<ResultsV2>(initialResults);
  const [library, setLibrary] = useState<LumRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>(initialAssets);
  const [photoCache, setPhotoCache] = useState<Record<string, PhotometricData>>({});
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
  const reminderEpochRef = useRef<number | null>(null);
  const [reminderGeneration, setReminderGeneration] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
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
  const [scheduleRows, setScheduleRows] = useState<ScheduleImportRow[]>([]);
  const [scheduleParseErrors, setScheduleParseErrors] = useState<string[]>([]);
  const [scheduleCommitting, setScheduleCommitting] = useState(false);
  const [calcAfterSchedule, setCalcAfterSchedule] = useState(false);
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
  /** Live 3D orbit; flushed into scene.ui.camera3d on save */
  const camera3dRef = useRef<Camera3dView | null>(initialScene.ui.camera3d ?? null);
  const lastSavedRef = useRef<ProjectSnapshot>(
    snapshotProject(initialName, initialScene, initialResults)
  );
  const latestRef = useRef({ name: initialName, scene: initialScene, results: initialResults });
  const saveInFlight = useRef(false);
  const saveQueued = useRef(false);

  const { autosaveMs, loaded: accountLoaded } = useAccountSettings();
  const [calcTarget, setCalcTarget] = useState<"room" | "all" | null>(null);
  const undoStackRef = useRef(
    createUndoStack<{ name: string; scene: ProjectSceneV2; results: ResultsV2 }>(50)
  );
  const coalesceRef = useRef<string | null>(null);


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
  const underlayUrl = underlayDisplayAssetId
    ? `/api/projects/${projectId}/assets/${underlayDisplayAssetId}/file`
    : null;
  const dxfEntities: DxfEntity[] = underlay?.dxfEntities ?? [];

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
    const res = await fetch("/api/luminaires");
    if (res.ok) setLibrary(await res.json());
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

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
    const next = undoStackRef.current.undo(snapshotNow());
    if (!next) return;
    coalesceRef.current = null;
    applyEditorSnapshot(next);
    setStatus("Undid");
  }

  function redoEdit() {
    const next = undoStackRef.current.redo(snapshotNow());
    if (!next) return;
    coalesceRef.current = null;
    applyEditorSnapshot(next);
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
        const { ok } = await patchProjectMinimal(projectId, body);
        if (ok) {
          lastSavedRef.current = current;
          reminderEpochRef.current = null;
          setSaveReminderOpen(false);
          setStatus("Saved");
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
    opts?: { recordUndo?: boolean; coalesce?: string }
  ) {
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
    patchScene(updater, { recordUndo: false });
  }


  function addStorey() {
    const id = nid("storey");
    patchScene((s) => officialAppendStorey(s, { id }));
  }

  function copyStorey() {
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
    const storeyId = activeStorey?.id;
    if (!storeyId) return;
    patchScene((s) => applyOfficialStoreyMetrics(s, storeyId, patch));
  }

  function applyRoomHeightMm(raw: string) {
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
    if (tool === "drawRoom" && refuseUncalibratedDrawRoom()) return;
    if (booleanPick.active && tool !== "select") {
      setBooleanPick(EMPTY_OFFICIAL_TWO_ROOM_PICK);
    }
    if (distributePick.active && tool !== "select") {
      setDistributePick(EMPTY_ROOM_DISTRIBUTE_PICK);
    }
    patchSceneUi((s) => ({ ...s, ui: { ...s.ui, tool } }));
  }

  function drawRoomPolygon(points: Vec2[]) {
    if (refuseUncalibratedDrawRoom()) return;
    if (points.length < 3) {
      setStatus("Need at least 3 corners to close a room");
      return;
    }
    const id = nid("room");
    const heightM = resolveNewRoomHeightM();
    patchScene((s) => officialAppendDrawnRoom(s, { id, polygon: points, heightM }).scene);
    setStatus("Room created");
  }

  function createRectRoom() {
    if (refuseUncalibratedDrawRoom()) return;
    const lengthM = parseLengthToM(rectLenMm);
    const widthM = parseLengthToM(rectWidMm);
    if (!(lengthM && lengthM >= 0.05) || !(widthM && widthM >= 0.05)) {
      setStatus("Enter length and width in mm (or with m / cm suffix)");
      return;
    }
    drawRoomPolygon(rectPolygon(0, 0, lengthM, widthM));
  }

  async function createRoomsFromDxf() {
    const heightM = resolveNewRoomHeightM();
    await officialWait.run(OFFICIAL_WAIT_COPY.creatingRoomsFromDxf, () => {
      const result = officialAppendRoomsFromDxfClosedPolylines(scene, {
        heightM,
        nextId: () => nid("room"),
      });
      setStatus(result.status);
      if (result.created > 0) {
        patchScene(() => result.scene);
      }
    });
  }

  function currentStoreyRoomIds(): string[] {
    const storeyId = scene.ui.activeStoreyId;
    return scene.rooms.filter((room) => room.storeyId === storeyId).map((room) => room.id);
  }

  function startUnionRooms() {
    if (distributePick.active) {
      setDistributePick(EMPTY_ROOM_DISTRIBUTE_PICK);
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
    const next = startOfficialRoomDistributePick(scene.ui.activeRoomId, currentStoreyRoomIds());
    setDistributePick(next);
    setStatus(distributeRoomsPickHint(next));
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
      const lum = data.luminaire as LumRow;
      await loadLibrary();
      await ensurePhotometry(lum.id);
      patchScene((s) => ({
        ...s,
        fixtureLibraryIds: s.fixtureLibraryIds.includes(lum.id)
          ? s.fixtureLibraryIds
          : [...s.fixtureLibraryIds, lum.id],
      }));
      setStatus(`Imported “${lum.name}” to project fixture list (not placed)`);
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function addFromLibrary(luminaireId: string) {
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
    const decision = decideFixtureChange(latestRef.current.results, roomIds);
    if (decision.action === "apply") {
      apply();
      return;
    }
    pendingFixtureApplyRef.current = apply;
    setPendingDiscardRoomIds(decision.roomIdsToClear);
  }

  function confirmDiscardResults() {
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
    const inst = latestRef.current.scene.instances.find((i) => i.instanceId === instanceId);
    const roomIds = inst?.roomId ? [inst.roomId] : [];
    const decision = decideFixtureChange(latestRef.current.results, roomIds);
    if (decision.action === "apply") return true;
    pendingFixtureApplyRef.current = null;
    setPendingDiscardRoomIds(decision.roomIdsToClear);
    return false;
  }

  function updateInstanceRotation(instanceId: string, rotationDeg: number) {
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
      setAssets((a) => [
        ...(rasterAsset ? [rasterAsset] : []),
        asset,
        ...a,
      ]);
      const meta = JSON.parse(asset.metaJson || "{}") as {
        entities?: DxfEntity[];
        widthPx?: number;
        heightPx?: number;
        pageCount?: number;
      };
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
            dxfEntities: meta.entities,
            pageIndex: raster?.pageIndex ?? 0,
            pageRasterAssetId: rasterAsset?.id,
            rasterDpi: raster?.rasterDpi,
            pdfPageCount: raster?.pageCount ?? meta.pageCount,
          }),
        ],
      }));
      if (asset.kind === "dwg") {
        setStatus(data.warnings?.[0] || "DWG stored — upload DXF for linework");
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
      });
    } finally {
      setUploading(false);
      if (planRef.current) planRef.current.value = "";
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

  async function runCalc(all: boolean) {
    const plan = planCalcRooms(scene, all);
    if (!plan.ok) {
      setStatus(formatCalcEmptyError(plan));
      return;
    }
    setCalcTarget(all ? "all" : "room");
    setCalculating(true);
    setStatus("Calculating on client…");
    try {
      await officialWait.run(OFFICIAL_WAIT_COPY.calculating, async () => {
      const calc = await runOfficialClientCalc(
        scene,
        results,
        all,
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

  async function applyFixtureArray(params: ArrayParams, luminaireId: string) {
    if (!activeRoom) {
      setStatus("Select a room for the array");
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
      await officialWait.run(OFFICIAL_WAIT_COPY.placingFixtures, async () => {
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
      const snap = gridToFalseColorPngDataUrl(room, res);
      if (snap) falseColorSnapshots[room.id] = snap;
    }
    const isoluxSnapshots = collectOfficialIsoluxSnapshots(scene, results);
    const captured3d = captureOfficialReport3dViews({
      captureAvailable: webglCaptureAvailable,
      render: () =>
        renderAllReport3dViews({
          scene,
          results,
          photometry,
          overviewCamera: fitOverviewCamera(scene),
        }),
    });
    if (captured3d.status) setStatus(captured3d.status);
    const {
      projectPerspectiveGreyscale,
      projectPerspectiveFalseColor,
      persp3dGreyscale,
      persp3dFalseColor,
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
    const doc = buildFullReportPdf({
      projectName: name,
      scene,
      results,
      photometry,
      wattsById,
      falseColorSnapshots,
      isoluxSnapshots,
      projectPerspectiveGreyscale,
      projectPerspectiveFalseColor,
      persp3dGreyscale,
      persp3dFalseColor,
      luxsimVersion: "0.1.0",
      website,
    });
    doc.save(`${name.replace(/[^\w\-]+/g, "_")}-report.pdf`);
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
  const planIsoluxControls = planIsoluxControlState(results, currentStoreyRoomIds());
  const autoScale = OFFICIAL_FALSE_COLOR_SCALE;
  const [scale, setScale] = useState<FalseColorScale>(autoScale);
  const [scalePinned, setScalePinned] = useState(false);
  const viewScaleRef = useRef(scale);
  viewScaleRef.current = scale;
  useEffect(() => {
    if (!scalePinned) setScale(autoScale);
  }, [autoScale, scalePinned]);

  function commitViewFalseColorScale(next: FalseColorScale, pinned: boolean) {
    setScalePinned(pinned);
    if (!shouldApplyViewFalseColorScale(viewScaleRef.current, next)) return;
    setScale(next);
    void officialWait.run(OFFICIAL_WAIT_COPY.updatingScale, async () => {});
  }

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
              onClick={() =>
                patchSceneUi((s) => ({
                  ...s,
                  ui: {
                    ...s.ui,
                    viewMode: mode,
                    camera3d: camera3dRef.current ?? s.ui.camera3d ?? null,
                  },
                }))
              }
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
          scene={scene}
          variant="top"
          results={results}
          showFalseColor={planShowFalseColor}
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
          rcpProposals={scene.rcpProposals ?? []}
          showRcpOverlay={showRcpOverlay && workflow === "light"}
          selectedRcpId={selectedRcpId}
        />
      )}
      {viewMode === "front" && (
        <ElevationView2D
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
          showValueLabels={planValueLabels}
          showIsolines={planShowIsolines}
          showWorkplane={showWorkplane}
        />
      )}
      </div>
      {((viewMode === "persp3d" && (display3d === "falsecolor" || display3d === "greyscale")) ||
        ((viewMode === "top") && planShowFalseColor && results)) && (
        <FalseColorLegend
          emin={autoScale.minLux}
          emax={autoScale.maxLux}
          results={activeResults}
          scale={scale}
          onChange={(next) => commitViewFalseColorScale(next, true)}
          onReset={() => commitViewFalseColorScale(autoScale, false)}
          layout="bar"
          tone="dark"
          palette={viewMode === "persp3d" && display3d === "greyscale" ? "greyscale" : "falsecolor"}
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
        <input
          id="projectName"
          className="cad-project-input"
          value={name}
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
          <button type="button" className="btn btn-secondary !text-xs" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            className="btn btn-secondary !text-xs"
            disabled={calculating}
            onClick={() => void runCalc(false)}
          >
            {calculating && calcTarget === "room" ? "Calculating…" : "Calc room"}
          </button>
          <button
            type="button"
            className="btn btn-accent !text-xs"
            disabled={calculating}
            onClick={() => void runCalc(true)}
          >
            {calculating && calcTarget !== "room" ? "Calculating…" : "Calc all"}
          </button>
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

      {workflow === "light" && !activeRoom && (
        <p className="workflow-banner">Select a room in the building tree — luminaires need a closed space.</p>
      )}

      <div className="cad-body">
        <aside className="cad-left space-y-1">
          <p className="cad-section-title">Building</p>
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

          {activeStorey && (
            <div className="border-t border-[#3d5563] pt-2 space-y-2">
              <p className="text-xs font-semibold text-white/95">{activeStorey.name}</p>
              <label className="label" htmlFor="storeyElevationM">
                Elevation (m)
              </label>
              <input
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
              <input
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
              <p className="text-[10px] text-[var(--muted)] leading-snug">
                {STOREY_METRICS_EXPLANATION}
              </p>
            </div>
          )}

          <div className="border-t border-[#3d5563] pt-2 space-y-2">
            <div className="flex items-center justify-between">
              <label className="label mb-0" htmlFor="buildingRoomHeightMm">
                Room height (mm)
              </label>
              <HelpTip helpKey="tool.roomHeight" />
            </div>
            <input
              id="buildingRoomHeightMm"
              className="input"
              type="number"
              min={500}
              step={100}
              data-help-key="tool.roomHeight"
              value={roomHeightMm}
              onChange={(e) => applyRoomHeightMm(e.target.value)}
            />
            <p className="text-[10px] text-[var(--muted)] leading-snug">
              Used for the next room you draw or create (default 2800 mm). If a room is
              selected, this also updates that room’s ceiling. Other rooms are left
              unchanged.
            </p>
          </div>

          <div
            className={`border-t border-[#3d5563] pt-2 space-y-2 ${
              workflow !== "construction" ? "cad-panel-hidden" : ""
            }`}
          >
            <h3 className="font-semibold text-sm text-white/95">Tools</h3>
            {(
              [
                ["select", "Select / move", null, IconSelect] as const,
                ["drawRoom", "Draw room", "tool.drawRoom", IconDrawRoom] as const,
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
            {scene.ui.tool === "drawRoom" && (
              <p className="text-[10px] text-[var(--muted)]">
                Click corners — type mm to lock length — click the start point to close.
                Uses the Building Room height above (default 2800 mm).
              </p>
            )}
            {scene.ui.tool === "calibrate" && (
              <div>
                <label className="label">Real distance (m)</label>
                <input
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
              <input
                className="input"
                value={rectLenMm}
                onChange={(e) => setRectLenMm(e.target.value)}
              />
              <label className="label">Width (mm)</label>
              <input
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
              <p className="text-[10px] text-[var(--muted)]">
                Places a rectangle at 0, 0 using the Building Room height. After creation, select the room and use corner or mid-edge handles to change its shape. Rooms are not translated by dragging the fill. Hold the middle mouse button to pan the plan.
              </p>
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
              <p className="text-[10px] text-[var(--muted)]">
                Adds rooms from closed DXF polylines, from simple closed loops of connected lines, and from each minimal room face in a T-junction or shared-wall network on this storey, using the Building Room height and official new-room defaults. Official rooms are simple polygons without holes: if one room lies fully inside another with no connecting wall, only the inner room is kept. Scale follows the current Calibrate scale.
              </p>
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
              <p className="text-[10px] text-[var(--muted)]">
                Merges two overlapping or edge-adjacent rooms on this storey into the first room. The first room keeps its name, maintenance factor, and other properties; the second is removed. Alignment is not included. Esc cancels the pick.
              </p>
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
              <p className="text-[10px] text-[var(--muted)]">
                Cuts the first room on this storey by the second (the cutter). The first room keeps its name, maintenance factor, and other properties; the cutter stays in place. The result must be a single simple outline. Alignment is not included. Esc cancels the pick.
              </p>
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
              <p className="text-[10px] text-[var(--muted)]">
                Keeps the overlapping area of two rooms on this storey as the first room. The first room keeps its name, maintenance factor, and other properties; the second is removed. The rooms must overlap in area, and the result must be a single simple outline. Alignment is not included. Esc cancels the pick.
              </p>
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
              <p className="text-[10px] text-[var(--muted)]">
                Keeps the exclusive parts of two rooms on this storey as the first room (first XOR second). The first room keeps its name, maintenance factor, and other properties; the second is removed. The rooms must overlap in area, and the result must be a single simple outline. A bite that shares the outer boundary can succeed; two remainders or a hole are refused. Alignment is not included. Esc cancels the pick.
              </p>
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
              <p className="text-[10px] text-[var(--muted)]">
                Aligns a room on this storey to a reference along the selected edge or centre (Left is the default). The first room is the reference and stays put; the second room moves without changing shape. Both rooms are kept. Even spacing is not included. Esc cancels the pick.
              </p>
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
              <p className="text-[10px] text-[var(--muted)]">
                Spaces three or more rooms on this storey with equal gaps between bounding boxes along the selected axis (Horizontal is the default). The first and last rooms along that axis stay put; interiors move without changing shape. Press Enter to apply. Esc cancels the pick.
              </p>
            </div>
          </div>

          <div
            className={`border-t border-[#3d5563] pt-2 space-y-2 ${
              workflow !== "construction" ? "cad-panel-hidden" : ""
            }`}
          >
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
                <select
                  className="select !text-xs"
                  value={underlay.pageIndex ?? 0}
                  disabled={uploading}
                  onChange={(e) => void setPdfUnderlayPage(Number(e.target.value))}
                >
                  {Array.from({ length: underlay.pdfPageCount ?? 1 }, (_, i) => (
                    <option key={i} value={i}>
                      Page {i + 1}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {underlay?.kind === "pdf" && underlay.rasterDpi && (
              <p className="text-[10px] text-[#8fa3ad]">
                Raster {underlay.sourceWidthPx}×{underlay.sourceHeightPx}px @{" "}
                {underlay.rasterDpi} DPI
              </p>
            )}
          </div>

        </aside>

        <section className="cad-center">
          <div className="cad-viewport-wrap">
            {viewport}
          </div>

          <div
            className={`shrink-0 px-2 pb-2 max-h-40 overflow-auto ${
              workflow !== "light" && workflow !== "calculation" ? "cad-panel-hidden" : ""
            }`}
          >
            <p className="cad-section-title">Fixtures in project ({scene.instances.length})</p>
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
                      </td>
                    </tr>
                  );
                })}
                {!scene.instances.length && (
                  <tr>
                    <td colSpan={5} className="text-[#8fa3ad] py-2">
                      Drag fixtures from the library onto a room.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="cad-right space-y-2">
          <p className="cad-section-title">Properties</p>
          {!selected && activeRoom ? (
            <div
              className={`cad-props-card space-y-2 ${
                workflow !== "construction" && workflow !== "calculation" ? "cad-panel-hidden" : ""
              }`}
            >
              <p className="text-xs font-semibold">{activeRoom.name}</p>
              <div className="flex items-center justify-between">
                <label className="label mb-0" htmlFor="roomHeightMm">
                  Height (mm)
                </label>
                <HelpTip helpKey="tool.roomHeight" />
              </div>
              <input
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
              <input
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
              {(["floor", "ceiling", "walls"] as const).map((face) => (
                <div key={face}>
                  <label className="label">ρ {face}</label>
                  <input
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
              <label className="label">Grid spacing (m)</label>
              <input
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
                  <input
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
                <input
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
              <select
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
                }}
              >
                {EN12464_TEMPLATES.map((t) => (
                  <option key={t.id || "none"} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
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
          ) : !selected ? (
            <p className="text-xs text-[var(--muted)]">
              No room selected. Set Room height in the Building panel for the next room
              you draw or create. Area and origin appear after a room is selected.
            </p>
          ) : null}

          {selected && (
            <div
              className="cad-props-card space-y-2"
              data-fixture-properties=""
            >
              <p className="text-xs uppercase text-[var(--muted)]">Selected fixture</p>
              <input
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
                  <input
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
                  <input
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

          {workflow === "light" && (
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
            />
          )}

          <div
            className={`border-t border-[#3d5563] pt-2 space-y-2 ${
              workflow !== "light" && workflow !== "construction" ? "cad-panel-hidden" : ""
            }`}
          >
            <p className="cad-section-title">Fixture library</p>
          <div className="space-y-2 rounded border border-dashed border-[#4a6270] p-3 bg-[#1a2832]">
            <label className="label">Upload IES / LDT</label>
            <input
              ref={fileRef}
              className="input text-xs"
              type="file"
              accept=".ies,.ldt"
              disabled={uploading}
              onChange={(e) => void onUploadPhotometry(e.target.files?.[0] ?? null)}
            />
            <p className="text-[10px] text-[var(--muted)]">
              Adds to list only — drag to place on the plan.
            </p>
          </div>

          <div className="space-y-2 rounded border border-dashed border-[#4a6270] p-3 bg-[#1a2832]">
            <GenerateLdtForm
              compact
              tone="cad"
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
          </div>

          <div>
            <label className="label">Add from org library</label>
            <select
              className="select"
              defaultValue=""
              onChange={(e) => {
                addFromLibrary(e.target.value);
                e.target.value = "";
              }}
            >
              <option value="">Select…</option>
              {library.map((l) => (
                <option key={l.id} value={l.id}>
                  {luminaireListLabel(l.name, l)}
                </option>
              ))}
            </select>
          </div>

          <ul className="space-y-2">
            {projectFixtures.map((lum) => (
              <li
                key={lum.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/x-luxsim-luminaire", lum.id);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                className="border border-[#3d5563] p-2 bg-[#243540] cursor-grab active:cursor-grabbing rounded-sm"
              >
                <div className="text-sm font-medium">{lum.name}</div>
                <div className="text-[10px] text-[var(--muted)] mb-1">
                  {libraryConeLabel(lum) ? `${libraryConeLabel(lum)} · ` : ""}
                  {lum.lumens ? Math.round(lum.lumens) : "—"} lm ·{" "}
                  {lum.watts ? Math.round(lum.watts) : "—"} W · drag to plan
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

          <div
            className={`border-t border-[#3d5563] pt-2 space-y-2 ${
              workflow !== "export" ? "cad-panel-hidden" : ""
            }`}
          >
            <p className="cad-section-title">Documentation &amp; export</p>
            <button className="btn btn-secondary w-full" onClick={() => void exportFullPdf()}>
              Full PDF report
            </button>
            <button
              className="btn btn-secondary w-full"
              onClick={async () => {
                const toExport = sceneWithView(scene);
                const names: Record<string, string> = {};
                for (const l of library) names[l.id] = l.name;
                const collected = await collectSourcesForOfficialExport(
                  officialExportLuminaireIds(toExport)
                );
                exportLuxsimFile(
                  buildLuxsimProject({
                    name,
                    scene: toExport as never,
                    results: results as never,
                    photometry: collected.photometry,
                    sourceFiles: collected.sourceFiles,
                    luminaireLibrary: collected.luminaireLibrary,
                  })
                );
                if (collected.missingSourceIds.length) {
                  setStatus(missingExportSourceStatus("luxsim", collected.missingSourceIds, names));
                }
              }}
            >
              Save .lux
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
          </div>
        </aside>
      </div>

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

      <div className="cad-status-bar">
        {status || "Click Save to keep your work · Ctrl+Z undo · Top view: drop fixtures into rooms"}
        {assets.length > 0 && (
          <span className="ml-3 opacity-70">Assets: {assets.map((a) => a.fileName).join(", ")}</span>
        )}
      </div>
      <DiscardResultsDialog
        open={pendingDiscardRoomIds != null}
        onConfirm={confirmDiscardResults}
        onCancel={cancelDiscardResults}
      />
      <SaveReminderDialog
        open={saveReminderOpen}
        saving={saving}
        onSave={saveFromReminder}
        onLater={deferSaveReminder}
      />
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
