"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import type { PhotometricData } from "@luxsim/photometry";
import {
  buildFullReportPdf,
  findRoomAt,
  initialMetersPerPixel,
  legacyScaleToMetersPerPixel,
  mToMm,
  parseLengthToM,
  rectPolygon,
  translatePolygon,
  underlayWorldSize,
  type Camera3dView,
  type DxfEntity,
  type ProjectSceneV2,
  type ResultsV2,
  type Vec2,
  type ViewMode,
  EN12464_TEMPLATES,
  evaluateEn12464,
  clampMf,
  resolveMaintenanceFactor,
  normalizeMfBreakdown,
  DEFAULT_MF_BREAKDOWN,
  WORKFLOW_MODES,
  getDialuxPackWarnings,
  type EditorWorkflowMode,
} from "@luxsim/project-io";
import {
  buildLuxsimProject,
  exportDialuxPack,
  exportLuxsimFile,
} from "@/lib/exports-client";
import { runSolverClient } from "@/lib/run-solver";
import { planFixtureArray } from "@/lib/arrange-array";
import type { ArrayParams } from "@/lib/arrange-array";
import {
  runClientCalcForRooms,
  writeFixtureInstances,
  type WriteInstancesCalcDeps,
} from "@/lib/write-instances";
import {
  patchProjectMinimal,
  projectPatchDiff,
  snapshotProject,
  type ProjectSnapshot,
} from "@/lib/project-autosave";
import { FalseColorLegend } from "./FalseColorLegend";
import { EditorResultsStrip } from "./EditorResultsStrip";
import { FixtureArrayPanel } from "./FixtureArrayPanel";
import { TopView2D } from "./TopView2D";
import { ElevationView2D } from "./ElevationView2D";
import { PolarPreview } from "@/components/PolarPreview";
import { HelpTip } from "@/components/HelpTip";
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
    loading: () => (
      <div className="h-[520px] bg-[#0f1c24] text-white/70 grid place-items-center">
        Loading 3D…
      </div>
    ),
  }
);

type LumRow = {
  id: string;
  name: string;
  sourceFormat?: string;
  originalName?: string;
  watts: number | null;
  lumens: number | null;
};

type AssetRow = {
  id: string;
  kind: string;
  fileName: string;
  metaJson: string;
};

function nid(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [calcAfterPlace, setCalcAfterPlace] = useState(false);
  const [arrayPreview, setArrayPreview] = useState<{ x: number; y: number; rotationDeg: number }[] | null>(
    null
  );
  const [arrayApplying, setArrayApplying] = useState(false);
  const [calibDist, setCalibDist] = useState("5");
  const [rectLenMm, setRectLenMm] = useState("6000");
  const [rectWidMm, setRectWidMm] = useState("4000");
  const [roomHeightMm, setRoomHeightMm] = useState(() => {
    const first = initialScene.rooms.find((r) => r.id === initialScene.ui.activeRoomId)
      ?? initialScene.rooms[0];
    return first ? String(Math.round(mToMm(first.heightM))) : "2800";
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

  const selected = scene.instances.find((l) => l.instanceId === selectedId) ?? null;
  const activeRoom = scene.rooms.find((r) => r.id === scene.ui.activeRoomId) ?? null;
  const activeResults = activeRoom ? results.byRoomId[activeRoom.id] ?? null : null;
  const en12464Check = useMemo(() => {
    if (!activeRoom || !activeResults) return null;
    return evaluateEn12464({
      templateId: activeRoom.calc.en12464TemplateId,
      maintenanceFactor: activeRoom.calc.maintenanceFactor,
      mfBreakdown: activeRoom.calc.mfBreakdown,
      taskResults: activeResults,
    });
  }, [activeRoom, activeResults]);

  const underlay = scene.underlays.find((u) => u.storeyId === scene.ui.activeStoreyId);
  const underlayUrl = underlay
    ? `/api/projects/${projectId}/assets/${underlay.assetId}/file`
    : null;
  const dxfEntities: DxfEntity[] = underlay?.dxfEntities ?? [];

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

  async function ensurePhotometry(id: string) {
    if (photoCache[id]) return photoCache[id]!;
    const res = await fetch(`/api/luminaires/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    setPhotoCache((c) => ({ ...c, [id]: data.photometric }));
    if (data.sourceText) {
      setSourceCache((c) => ({
        ...c,
        [id]: { filename: data.originalName, text: data.sourceText },
      }));
    }
    return data.photometric as PhotometricData;
  }

  const writeCalcDeps = useCallback((): WriteInstancesCalcDeps => {
    return {
      ensurePhotometry,
      getWatts: (luminaireId) => library.find((l) => l.id === luminaireId)?.watts,
      runSolver: runSolverClient,
    };
  }, [library, photoCache]);

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
    const { ok } = await patchProjectMinimal(projectId, body);
    saveInFlight.current = false;
    setSaving(false);
    if (ok) {
      lastSavedRef.current = current;
      setStatus("Saved");
    } else {
      setStatus("Save failed");
    }
    if (saveQueued.current) {
      saveQueued.current = false;
      const latest = latestRef.current;
      void save(latest.scene, latest.results, latest.name);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const latest = latestRef.current;
      void save(latest.scene, latest.results, latest.name);
    }, 800);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce on data only
  }, [name, scene, results]);

  useEffect(() => {
    const flush = () => {
      const latest = latestRef.current;
      void save(latest.scene, latest.results, latest.name);
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (!activeRoom) return;
    setRoomHeightMm(String(Math.round(mToMm(activeRoom.heightM))));
  }, [activeRoom?.id, activeRoom?.heightM]);

  function patchScene(updater: (s: ProjectSceneV2) => ProjectSceneV2) {
    setScene((s) => updater(s));
  }

  function addStorey() {
    const id = nid("storey");
    const last = scene.storeys[scene.storeys.length - 1];
    patchScene((s) => ({
      ...s,
      storeys: [
        ...s.storeys,
        {
          id,
          name: `L${s.storeys.length}`,
          elevationM: (last?.elevationM ?? 0) + (last?.heightM ?? 3),
          heightM: 3,
        },
      ],
      ui: { ...s.ui, activeStoreyId: id, activeRoomId: null },
    }));
  }

  function resolveNewRoomHeightM(): number {
    const fromField = parseLengthToM(roomHeightMm);
    if (fromField && fromField >= 0.5) return fromField;
    const storey = scene.storeys.find((st) => st.id === scene.ui.activeStoreyId);
    return storey?.heightM ?? 2.8;
  }

  function drawRoomPolygon(points: Vec2[]) {
    if (points.length < 3) {
      setStatus("Need at least 3 corners to close a room");
      return;
    }
    const id = nid("room");
    patchScene((s) => ({
      ...s,
      rooms: [
        ...s.rooms,
        {
          id,
          storeyId: s.ui.activeStoreyId,
          name: `Room ${s.rooms.length + 1}`,
          polygon: points.map((p) => ({ x: p.x, y: p.y })),
          heightM: resolveNewRoomHeightM(),
          workplaneHeightM: 0.75,
          reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
          calc: {
            gridSpacing: 0.5,
            interreflection: true,
            bounces: 2,
            computeUgr: true,
            maintenanceFactor: activeRoom?.calc.maintenanceFactor ?? 0.8,
            en12464TemplateId: activeRoom?.calc.en12464TemplateId ?? "",
          },
        },
      ],
      ui: { ...s.ui, activeRoomId: id, tool: "select" },
    }));
    setStatus("Room created");
  }

  function createRectRoom() {
    const lengthM = parseLengthToM(rectLenMm);
    const widthM = parseLengthToM(rectWidMm);
    if (!(lengthM && lengthM >= 0.05) || !(widthM && widthM >= 0.05)) {
      setStatus("Enter length and width in mm (or with m / cm suffix)");
      return;
    }
    drawRoomPolygon(rectPolygon(0, 0, lengthM, widthM));
  }

  function moveRoom(roomId: string, dx: number, dy: number) {
    if (dx === 0 && dy === 0) return;
    patchScene((s) => ({
      ...s,
      rooms: s.rooms.map((r) =>
        r.id === roomId ? { ...r, polygon: translatePolygon(r.polygon, dx, dy) } : r
      ),
      instances: s.instances.map((i) =>
        i.roomId === roomId
          ? { ...i, position: { ...i.position, x: i.position.x + dx, y: i.position.y + dy } }
          : i
      ),
    }));
  }

  async function onUploadPhotometry(file: File | null) {
    if (!file) return;
    setUploading(true);
    setStatus(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("name", file.name.replace(/\.(ies|ldt)$/i, ""));
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
        setScene(out.scene);
        setResults(out.results);
        setSelectedId(out.instanceIds[0] ?? null);
        setStatus(
          calcAfterPlace
            ? `Placed in ${room.name} · calculated`
            : `Placed in ${room.name}`
        );
        if (calcAfterPlace) {
          await save(out.scene, out.results, latest.name);
        }
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "Placement failed");
      }
    })();
  }

  function updateInstanceRotation(instanceId: string, rotationDeg: number) {
    patchScene((s) => ({
      ...s,
      instances: s.instances.map((i) =>
        i.instanceId === instanceId ? { ...i, rotationDeg } : i
      ),
    }));
    const inst = scene.instances.find((i) => i.instanceId === instanceId);
    if (inst?.roomId) {
      setResults((r) => {
        const next = { ...r, byRoomId: { ...r.byRoomId } };
        delete next.byRoomId[inst.roomId!];
        return next;
      });
    }
  }

  function moveInstance(instanceId: string, x: number, y: number, z?: number) {
    patchScene((s) => ({
      ...s,
      instances: s.instances.map((i) => {
        if (i.instanceId !== instanceId) return i;
        const room =
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
          roomId: room?.id ?? i.roomId,
        };
      }),
    }));
  }

  async function importPlan(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
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
      setAssets((a) => [asset, ...a]);
      const meta = JSON.parse(asset.metaJson || "{}") as {
        entities?: DxfEntity[];
        widthPx?: number;
        heightPx?: number;
      };
      const pixelSize =
        asset.kind === "image" ? await readImagePixelSize(file) : null;
      const sourceWidthPx = pixelSize?.width ?? meta.widthPx;
      const sourceHeightPx = pixelSize?.height ?? meta.heightPx;
      const metersPerUnit =
        sourceWidthPx && sourceHeightPx
          ? initialMetersPerPixel(sourceWidthPx, sourceHeightPx)
          : 1;
      const underlayId = nid("underlay");
      patchScene((s) => ({
        ...s,
        underlays: [
          ...s.underlays.filter((u) => u.storeyId !== s.ui.activeStoreyId),
          {
            id: underlayId,
            storeyId: s.ui.activeStoreyId,
            assetId: asset.id,
            kind: asset.kind === "dxf" ? "dxf" : asset.kind === "pdf" ? "pdf" : "image",
            opacity: 0.85,
            metersPerUnit,
            offsetX: 0,
            offsetY: 0,
            rotationDeg: 0,
            sourceWidthPx,
            sourceHeightPx,
            orientationMigrated: true,
            dxfEntities: meta.entities,
          },
        ],
      }));
      if (asset.kind === "dwg") {
        setStatus(data.warnings?.[0] || "DWG stored — upload DXF for linework");
      } else if (asset.kind === "image" && !(sourceWidthPx && sourceHeightPx)) {
        setStatus("Plan imported, but image size could not be read — re-import if distorted.");
      } else {
        setStatus(`Plan imported (${asset.kind}). Use calibrate tool to set scale.`);
      }
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
    const factor = real / distM;
    patchScene((s) => ({
      ...s,
      underlays: s.underlays.map((u) =>
        u.id === underlay.id
          ? { ...u, metersPerUnit: u.metersPerUnit * factor }
          : u
      ),
      ui: { ...s.ui, tool: "select" },
    }));
    setStatus(`Calibrated: ${real} m across selection`);
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
    const rooms = all
      ? scene.rooms
      : scene.rooms.filter((r) => r.id === scene.ui.activeRoomId);
    if (!rooms.length) {
      setStatus("Select or create a room first");
      return;
    }
    setCalculating(true);
    setStatus("Calculating on client…");
    try {
      const missing = rooms.filter(
        (r) => !scene.instances.some((i) => i.roomId === r.id)
      );
      if (missing.length === rooms.length) {
        setStatus(`Room “${rooms[0]!.name}” has no fixtures`);
        return;
      }
      const roomIds = rooms.map((r) => r.id);
      const nextResults = await runClientCalcForRooms(scene, results, roomIds, writeCalcDeps());
      setResults(nextResults);
      setStatus("Calculation complete (client-side)");
      await save(scene, nextResults, name);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Calculation failed");
    } finally {
      setCalculating(false);
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
    if (plan.skippedOutside > 0) {
      const ok = window.confirm(
        `${plan.skippedOutside} point(s) fall outside the room and will be skipped. Place ${plan.inside.length} fixture(s)?`
      );
      if (!ok) return;
    }

    const lib = library.find((l) => l.id === luminaireId);
    const photo = photoCache[luminaireId];
    const mountZ = activeRoom.heightM - 0.1;
    const drafts = plan.inside.map((p) => ({
      luminaireId,
      storeyId: scene.ui.activeStoreyId,
      roomId: activeRoom.id,
      name: lib?.name ?? photo?.description ?? "Fixture",
      position: { x: p.x, y: p.y, z: mountZ },
      rotationDeg: p.rotationDeg,
    }));

    setArrayApplying(true);
    try {
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
      setScene(out.scene);
      setResults(out.results);
      setArrayPreview(null);
      setSelectedId(out.instanceIds[out.instanceIds.length - 1] ?? null);
      setStatus(
        `Array placed ${out.instanceIds.length} fixture(s) in ${activeRoom.name}${
          calcAfterPlace ? " · calculated" : ""
        }`
      );
      if (calcAfterPlace) {
        await save(out.scene, out.results, latest.name);
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Array apply failed");
    } finally {
      setArrayApplying(false);
    }
  }

  async function exportFullPdf() {
    const photometry: Record<string, PhotometricData> = {};
    for (const id of scene.fixtureLibraryIds) {
      const p = await ensurePhotometry(id);
      if (p) photometry[id] = p;
    }
    const wattsById: Record<string, number | null | undefined> = {};
    for (const l of library) wattsById[l.id] = l.watts;
    const doc = buildFullReportPdf({
      projectName: name,
      scene,
      results,
      photometry,
      wattsById,
    });
    doc.save(`${name.replace(/[^\w\-]+/g, "_")}-report.pdf`);
  }

  const projectFixtures = useMemo(
    () => library.filter((l) => scene.fixtureLibraryIds.includes(l.id)),
    [library, scene.fixtureLibraryIds]
  );

  async function onExportDialuxVerification() {
    const toExport = sceneWithView(scene);
    const warnings = getDialuxPackWarnings(toExport, results);
    const blocking = warnings.filter((w) => w.code === "no_rooms" || w.code === "open_contour");
    if (blocking.length) {
      setStatus(blocking.map((w) => w.message).join(" "));
      return;
    }
    for (const id of scene.fixtureLibraryIds) await ensurePhotometry(id);
    const names: Record<string, string> = {};
    for (const l of library) names[l.id] = l.name;
    await exportDialuxPack({
      projectName: name,
      scene: toExport,
      results,
      sourceFiles: sourceCache,
      luminaireNames: names,
    });
    const soft = warnings.filter((w) => w.code !== "dialux_general").map((w) => w.message);
    setStatus(
      soft.length
        ? `Verification zip downloaded. Note: ${soft[0]}`
        : "DIALux verification zip downloaded — see README.txt in the zip."
    );
  }

  const workflow: EditorWorkflowMode = scene.ui.workflowMode ?? "construction";
  const workflowMeta = WORKFLOW_MODES.find((m) => m.id === workflow)!;

  function setWorkflowMode(mode: EditorWorkflowMode) {
    patchScene((s) => {
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

  const viewMode = scene.ui.viewMode;

  const viewTabs: { mode: ViewMode; label: string; icon: ReactElement }[] = [
    { mode: "top", label: "Top", icon: <IconViewTop /> },
    { mode: "bottom", label: "Bottom", icon: <IconViewTop /> },
    { mode: "front", label: "Front", icon: <IconViewElevation /> },
    { mode: "side", label: "Side", icon: <IconViewElevation /> },
    { mode: "persp3d", label: "3D", icon: <IconView3d /> },
  ];

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

  const viewport = (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-[100] bg-[#0f1c24]"
          : "panel relative overflow-hidden flex-1 min-h-[320px] bg-[#0a1218] border-[#2a3842]"
      }
    >
      <div className="absolute top-3 right-3 z-10 flex gap-2">
        <button
          type="button"
          className="btn btn-secondary !py-1.5 !px-3 !text-xs"
          onClick={() => setFullscreen((v) => !v)}
        >
          {fullscreen ? "Exit fullscreen" : "Fullscreen"}
        </button>
      </div>
      {(viewMode === "top" || viewMode === "bottom") && (
        <TopView2D
          scene={scene}
          variant={viewMode === "bottom" ? "bottom" : "top"}
          underlayUrl={underlayUrl}
          dxfEntities={dxfEntities}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onDropLuminaire={(id, x, y) => placeAt(id, x, y)}
          onMoveInstance={(id, x, y) => moveInstance(id, x, y)}
          onDrawRoomPolygon={drawRoomPolygon}
          onMoveRoom={moveRoom}
          onSelectRoom={(roomId) =>
            patchScene((s) => ({
              ...s,
              ui: { ...s.ui, activeRoomId: roomId },
            }))
          }
          onCalibratePoints={onCalibrate}
          onUnderlaySourceSize={persistUnderlaySourceSize}
          arrayPreview={arrayPreview ?? undefined}
        />
      )}
      {viewMode === "front" && (
        <ElevationView2D
          scene={scene}
          mode="front"
          selectedId={selectedId}
          onSelect={setSelectedId}
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
        />
      )}
      {viewMode === "side" && (
        <ElevationView2D
          scene={scene}
          mode="side"
          selectedId={selectedId}
          onSelect={setSelectedId}
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
        />
      )}
      {viewMode === "persp3d" && (
        <BuildingScene3D
          scene={scene}
          results={activeResults}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onDropLuminaire={(id, x, y, z) => placeAt(id, x, y, z)}
          className={fullscreen ? "h-screen" : "h-[520px]"}
          underlayUrl={underlayUrl}
          dxfEntities={dxfEntities}
          onUnderlaySourceSize={persistUnderlaySourceSize}
          viewRef={camera3dRef}
          initialView={scene.ui.camera3d ?? camera3dRef.current}
        />
      )}
      {fullscreen && (
        <div className="absolute bottom-4 left-4 z-10 w-72">
          <FalseColorLegend results={activeResults} />
        </div>
      )}
    </div>
  );

  return (
    <div className="cad-editor">
      <header className="cad-file-bar">
        <span className="text-[10px] uppercase tracking-widest text-[#8fa3ad] shrink-0">Project</span>
        <input
          id="projectName"
          className="cad-project-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Project name"
        />
        <p className="cad-disclaimer hidden lg:block">
          Design assist · not tender-certified · verify in DIALux
        </p>
        <div className="flex flex-wrap gap-2 items-center ml-auto">
          <button className="btn btn-secondary !text-xs" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            className="btn btn-secondary !text-xs"
            disabled={calculating}
            onClick={() => void runCalc(false)}
          >
            Calc room
          </button>
          <button
            className="btn btn-accent !text-xs"
            disabled={calculating}
            onClick={() => void runCalc(true)}
          >
            {calculating ? "Calculating…" : "Calc all"}
          </button>
        </div>
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
      </nav>

      {workflow === "light" && !activeRoom && (
        <p className="workflow-banner">Select a room in the building tree — luminaires need a closed space.</p>
      )}

      <div className="cad-body">
        <aside className="cad-left space-y-1">
          <p className="cad-section-title">Building</p>
          <button className="btn btn-secondary w-full !text-xs" onClick={addStorey}>
            Add storey
          </button>
          <ul className="space-y-0.5">
            {scene.storeys.map((st) => (
              <li key={st.id}>
                <button
                  type="button"
                  className={`cad-tree-btn ${
                    st.id === scene.ui.activeStoreyId ? "is-storey-active" : ""
                  }`}
                  onClick={() =>
                    patchScene((s) => ({
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
                            patchScene((s) => ({
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
                  onClick={() => patchScene((s) => ({ ...s, ui: { ...s.ui, tool } }))}
                >
                  <Icon className="w-4 h-4 shrink-0 opacity-90" />
                  {label}
                </button>
                {helpKey && <HelpTip helpKey={helpKey} />}
              </div>
            ))}
            {scene.ui.tool === "drawRoom" && (
              <p className="text-[10px] text-[var(--muted)]">
                Click corners — type mm to lock length — click the start point to close.
                Uses Room height above.
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
                Places a rectangle at 0, 0 using Room height. Select / move to drag it.
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
          </div>

          <div className={workflow !== "calculation" ? "cad-panel-hidden" : "pt-2"}>
            <FalseColorLegend results={activeResults} />
          </div>
        </aside>

        <section className="cad-center">
          <div className="editor-viewbar">
            {viewTabs.map(({ mode, label, icon }) => (
              <button
                key={mode}
                type="button"
                className={`view-tab ${viewMode === mode ? "is-active" : ""}`}
                onClick={() =>
                  patchScene((s) => ({
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
          </div>

          <div className="cad-viewport-wrap">
            {viewport}
          </div>

          <div
            className={`px-2 pb-2 max-h-40 overflow-auto ${
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
                            patchScene((s) => ({
                              ...s,
                              instances: s.instances.filter(
                                (i) => i.instanceId !== inst.instanceId
                              ),
                            }));
                            if (selectedId === inst.instanceId) setSelectedId(null);
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
          {activeRoom ? (
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
                onChange={(e) => {
                  const raw = e.target.value;
                  setRoomHeightMm(raw);
                  const next = Number(raw) / 1000;
                  if (!(next >= 0.5)) return;
                  const roomId = activeRoom.id;
                  patchScene((s) => ({
                    ...s,
                    rooms: s.rooms.map((r) =>
                      r.id === roomId ? { ...r, heightM: next } : r
                    ),
                  }));
                }}
              />
              <label className="label">Workplane (m)</label>
              <input
                className="input"
                type="number"
                step={0.05}
                min={0}
                value={activeRoom.workplaneHeightM}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (!Number.isFinite(next)) return;
                  patchScene((s) => ({
                    ...s,
                    rooms: s.rooms.map((r) =>
                      r.id === activeRoom.id ? { ...r, workplaneHeightM: next } : r
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
                      patchScene((s) => ({
                        ...s,
                        rooms: s.rooms.map((r) =>
                          r.id === activeRoom.id
                            ? {
                                ...r,
                                reflectance: { ...r.reflectance, [face]: v },
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
                min={0.2}
                value={activeRoom.calc.gridSpacing}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!(v >= 0.2)) return;
                  patchScene((s) => ({
                    ...s,
                    rooms: s.rooms.map((r) =>
                      r.id === activeRoom.id
                        ? { ...r, calc: { ...r.calc, gridSpacing: v } }
                        : r
                    ),
                  }));
                }}
              />
              <div className="flex items-center justify-between gap-1">
                <label className="label mb-0">Maintenance factor (CIE 97)</label>
                <HelpTip helpKey="room.maintenanceFactor" />
              </div>
              {(
                [
                  ["llmf", "LLMF (lamp lumen)"],
                  ["lsf", "LSF (luminaire surface)"],
                  ["lmf", "LMF (lamp survival)"],
                  ["rsmf", "RSMF (room surfaces)"],
                ] as const
              ).map(([key, lbl]) => {
                const bd = normalizeMfBreakdown(activeRoom.calc.mfBreakdown);
                return (
                  <div key={key}>
                    <label className="label">{lbl}</label>
                    <input
                      className="input"
                      type="number"
                      step={0.01}
                      min={0.5}
                      max={1}
                      value={bd[key]}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v)) return;
                        patchScene((s) => ({
                          ...s,
                          rooms: s.rooms.map((r) => {
                            if (r.id !== activeRoom.id) return r;
                            const nextBd = normalizeMfBreakdown({
                              ...r.calc.mfBreakdown,
                              ...bd,
                              [key]: v,
                            });
                            const resolved = resolveMaintenanceFactor({
                              mfBreakdown: nextBd,
                              useBreakdown: true,
                            });
                            return {
                              ...r,
                              calc: {
                                ...r.calc,
                                mfBreakdown: nextBd,
                                maintenanceFactor: resolved.mf,
                              },
                            };
                          }),
                        }));
                      }}
                    />
                  </div>
                );
              })}
              <p className="text-[10px] text-[var(--muted)]">
                Product MF{" "}
                <strong>
                  {resolveMaintenanceFactor({
                    maintenanceFactor: activeRoom.calc.maintenanceFactor,
                    mfBreakdown: activeRoom.calc.mfBreakdown,
                  }).mf.toFixed(3)}
                </strong>{" "}
                (LLMF×LSF×LMF×RSMF, clamped 0.5–1). Used for maintained EN checks only — solver uses initial output.
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
                    const v = clampMf(Number(e.target.value));
                    patchScene((s) => ({
                      ...s,
                      rooms: s.rooms.map((r) =>
                        r.id === activeRoom.id
                          ? { ...r, calc: { ...r.calc, maintenanceFactor: v, mfBreakdown: undefined } }
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
                  <PassRow label="UGR" check={en12464Check.checks.ugr} />
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-[var(--muted)]">Select a room to edit height, materials, and targets.</p>
          )}

          {selected && (
            <div
              className={`cad-props-card space-y-2 ${
                workflow !== "light" && workflow !== "construction" ? "cad-panel-hidden" : ""
              }`}
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
                      patchScene((s) => ({
                        ...s,
                        instances: s.instances.map((i) =>
                          i.instanceId === selected.instanceId
                            ? {
                                ...i,
                                position: {
                                  ...i.position,
                                  [axis]: Number(e.target.value),
                                },
                              }
                            : i
                        ),
                      }))
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
            </div>
          )}

          {workflow === "light" && (
            <FixtureArrayPanel
              room={activeRoom}
              luminaires={projectFixtures.map((l) => ({ id: l.id, name: l.name }))}
              preview={arrayPreview}
              onPreviewChange={setArrayPreview}
              calcAfterPlace={calcAfterPlace}
              onCalcAfterPlaceChange={setCalcAfterPlace}
              applying={arrayApplying}
              onApply={(params, luminaireId) => void applyFixtureArray(params, luminaireId)}
              onCancel={() => setArrayPreview(null)}
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
                  {l.name}
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
                  {lum.lumens ? Math.round(lum.lumens) : "—"} lm ·{" "}
                  {lum.watts ? Math.round(lum.watts) : "—"} W · drag to plan
                </div>
                {photoCache[lum.id] && (
                  <PolarPreview photo={photoCache[lum.id]!} size={120} />
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
                const photometry: Record<string, PhotometricData> = {};
                for (const id of scene.fixtureLibraryIds) {
                  const p = await ensurePhotometry(id);
                  if (p) photometry[id] = p;
                }
                exportLuxsimFile(
                  buildLuxsimProject({
                    name,
                    scene: sceneWithView(scene) as never,
                    results: results as never,
                    photometry,
                    sourceFiles: sourceCache,
                  })
                );
              }}
            >
              Save .luxsim
            </button>
            <button
              className="btn btn-accent w-full"
              data-help-key="export.dialuxVerification"
              onClick={() => void onExportDialuxVerification()}
            >
              DIALux verification (zip)
            </button>
            <p className="text-[10px] text-[var(--muted)]">
              Multi-room geometry, IES/LDT, DXF, and results CSV for desktop DIALux cross-check.
            </p>
          </div>
        </aside>
      </div>

      <EditorResultsStrip
        results={activeResults}
        en12464Check={en12464Check}
        maintenanceFactor={
          activeRoom
            ? resolveMaintenanceFactor({
                maintenanceFactor: activeRoom.calc.maintenanceFactor,
                mfBreakdown: activeRoom.calc.mfBreakdown,
              }).mf
            : 0.8
        }
        roomName={activeRoom?.name ?? null}
      />

      <div className="cad-status-bar">
        {status || "Autosave on pause · Top view: drop fixtures into rooms"}
        {assets.length > 0 && (
          <span className="ml-3 opacity-70">Assets: {assets.map((a) => a.fileName).join(", ")}</span>
        )}
      </div>
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
    return (
      <div className="flex flex-col gap-0.5 text-[var(--muted)]">
        <span>
          {label} {detail && `(${detail})`} — not evaluated
        </span>
        {check.note && <span className="text-[10px]">{check.note}</span>}
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
