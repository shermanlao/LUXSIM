/**
 * Offscreen WebGL capture of the shared LUXSIM 3D scene.
 * Used by BuildingEditor.exportFullPdf() and (via a Chrome bootstrap) QA scripts.
 * Requires a DOM + WebGL context — throws a clear error in plain Node.
 */
import * as THREE from "three";
import type { PhotometricData } from "@luxsim/photometry";
import {
  fitOverviewCamera,
  fitRoomCamera,
  isolineSettingsFromUi,
  OFFICIAL_FALSE_COLOR_SCALE,
  type Camera3dView,
  type Display3dMode,
  type FalseColorScale,
  type ProjectSceneV2,
  type ResultsV2,
  type RoomV2,
} from "@luxsim/project-io";
import {
  assignOfficialReport3dIsolineStill,
  tryOfficialReport3dIsolineStill,
} from "./official-pdf-3d-capture";
import { addOfficial3dIsoluxOverlay } from "./scene-3d-isolux";
import {
  buildBuildingThreeScene,
  createOfficialFalseColorWorkplane,
  setMirroredFrontFace,
} from "./scene-3d-model";

/** Official Full PDF 3D stills: sharp enough on A4, small enough for the file. */
export const REPORT_3D_JPEG_QUALITY = 0.75;
export const REPORT_3D_OVERVIEW_WIDTH = 1280;
export const REPORT_3D_OVERVIEW_HEIGHT = 720;
export const REPORT_3D_ROOM_WIDTH = 960;
export const REPORT_3D_ROOM_HEIGHT = 680;

export function webglCaptureAvailable(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    return Boolean(gl);
  } catch {
    return false;
  }
}

export type OfficialReportRenderer = {
  renderToJpeg: (opts: {
    scene: THREE.Scene;
    camera: Camera3dView;
    width: number;
    height: number;
    fov?: number;
    quality?: number;
  }) => string;
  dispose: () => void;
};

/** One offscreen WebGL renderer reused for every official report still. */
export function createOffscreenReportRenderer(): OfficialReportRenderer {
  if (typeof document === "undefined") {
    throw new Error("WebGL 3D capture requires a browser document");
  }
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  setMirroredFrontFace(renderer);
  return {
    renderToJpeg(opts) {
      const width = Math.max(16, Math.round(opts.width));
      const height = Math.max(16, Math.round(opts.height));
      renderer.setSize(width, height, false);
      const cam = new THREE.PerspectiveCamera(opts.fov ?? 45, width / height, 0.05, 800);
      cam.position.set(opts.camera.position[0], opts.camera.position[1], opts.camera.position[2]);
      const up = opts.camera.up ?? [0, 1, 0];
      cam.up.set(up[0], up[1], up[2]);
      cam.lookAt(opts.camera.target[0], opts.camera.target[1], opts.camera.target[2]);
      cam.updateProjectionMatrix();
      renderer.render(opts.scene, cam);
      return renderer.domElement.toDataURL("image/jpeg", opts.quality ?? REPORT_3D_JPEG_QUALITY);
    },
    dispose() {
      renderer.dispose();
      const gl = renderer.getContext();
      const ext = gl.getExtension("WEBGL_lose_context");
      ext?.loseContext();
      renderer.domElement.width = 0;
      renderer.domElement.height = 0;
      renderer.domElement.remove();
    },
  };
}

export function renderThreeSceneToJpeg(opts: {
  scene: THREE.Scene;
  camera: Camera3dView;
  width: number;
  height: number;
  fov?: number;
  quality?: number;
}): string {
  const renderer = createOffscreenReportRenderer();
  try {
    return renderer.renderToJpeg(opts);
  } finally {
    renderer.dispose();
  }
}

export interface RenderBuilding3dOpts {
  scene: ProjectSceneV2;
  results?: ResultsV2 | null;
  photometry?: Record<string, PhotometricData>;
  camera?: Camera3dView | null;
  storeyId?: string | null;
  isolateRoomId?: string | null;
  highlightRoomId?: string | null;
  width?: number;
  height?: number;
  quality?: number;
  falseColorScale?: FalseColorScale;
}

function renderMode(
  opts: RenderBuilding3dOpts,
  mode: Display3dMode,
  camera: Camera3dView,
  renderer?: OfficialReportRenderer
): string {
  const built = buildBuildingThreeScene({
    scene: opts.scene,
    results: opts.results,
    photometry: opts.photometry,
    mode,
    theme: "light",
    storeyId: opts.storeyId,
    isolateRoomId: opts.isolateRoomId,
    highlightRoomId: opts.highlightRoomId ?? null,
    falseColorScale: opts.falseColorScale ?? OFFICIAL_FALSE_COLOR_SCALE,
  });
  try {
    const jpegOpts = {
      scene: built.scene,
      camera,
      width: opts.width ?? REPORT_3D_OVERVIEW_WIDTH,
      height: opts.height ?? REPORT_3D_OVERVIEW_HEIGHT,
      quality: opts.quality ?? REPORT_3D_JPEG_QUALITY,
    };
    return renderer ? renderer.renderToJpeg(jpegOpts) : renderThreeSceneToJpeg(jpegOpts);
  } finally {
    built.dispose();
  }
}

/**
 * Official Full PDF 3D isoline still: same viewpoint as the greyscale /
 * false-colour pair, with the official isoline overlay (contours and labels)
 * drawn on a greyscale workplane. Returns null when the rooms have no isoline
 * overlay — never invents a field. Uses the project's Isoline levels setting.
 */
export function renderOfficialReport3dIsolines(
  opts: RenderBuilding3dOpts & { renderer?: OfficialReportRenderer }
): string | null {
  const camera = opts.camera ?? fitOverviewCamera(opts.scene, opts.storeyId);
  const built = buildBuildingThreeScene({
    scene: opts.scene,
    results: opts.results,
    photometry: opts.photometry,
    mode: "greyscale",
    theme: "light",
    storeyId: opts.storeyId,
    isolateRoomId: opts.isolateRoomId,
    highlightRoomId: opts.highlightRoomId ?? null,
    falseColorScale: opts.falseColorScale ?? OFFICIAL_FALSE_COLOR_SCALE,
  });
  const workplaneDisposables: Array<{ dispose: () => void }> = [];
  let isolineOverlay: { hasOverlay: boolean; dispose: () => void } = {
    hasOverlay: false,
    dispose: () => undefined,
  };
  try {
    const isolineSettings = isolineSettingsFromUi(opts.scene.ui);
    for (const room of built.rooms) {
      const res = opts.results?.byRoomId[room.id];
      if (!res) continue;
      const official = createOfficialFalseColorWorkplane(
        room,
        res,
        built.elevationM,
        opts.falseColorScale ?? OFFICIAL_FALSE_COLOR_SCALE,
        "greyscale"
      );
      if (!official) continue;
      workplaneDisposables.push(official.geometry, official.material, official.texture);
      built.content.add(new THREE.Mesh(official.geometry, official.material));
    }
    const fixtures = opts.scene.instances.filter((i) => {
      if (opts.isolateRoomId) return i.roomId === opts.isolateRoomId;
      return built.rooms.some((r) => r.id === i.roomId);
    });
    isolineOverlay = addOfficial3dIsoluxOverlay(
      built.content,
      built.rooms,
      opts.results,
      built.elevationM,
      fixtures,
      {
        showWorkplane: true,
        isolineSettings,
        showValueLabels: true,
      }
    );
    if (!isolineOverlay.hasOverlay) return null;
    const jpegOpts = {
      scene: built.scene,
      camera,
      width: opts.width ?? REPORT_3D_OVERVIEW_WIDTH,
      height: opts.height ?? REPORT_3D_OVERVIEW_HEIGHT,
      quality: opts.quality ?? REPORT_3D_JPEG_QUALITY,
    };
    return opts.renderer ? opts.renderer.renderToJpeg(jpegOpts) : renderThreeSceneToJpeg(jpegOpts);
  } finally {
    isolineOverlay.dispose();
    for (const d of workplaneDisposables) {
      try {
        d.dispose();
      } catch {
        /* ignore */
      }
    }
    built.dispose();
  }
}

export function renderBuilding3dPair(
  opts: RenderBuilding3dOpts & { renderer?: OfficialReportRenderer }
): {
  greyscale: string;
  falsecolor: string;
  camera: Camera3dView;
} {
  const camera = opts.camera ?? fitOverviewCamera(opts.scene, opts.storeyId);
  return {
    greyscale: renderMode(opts, "greyscale", camera, opts.renderer),
    falsecolor: renderMode(opts, "falsecolor", camera, opts.renderer),
    camera,
  };
}

export function renderRoom3dPair(
  opts: RenderBuilding3dOpts & { room: RoomV2; elevationM?: number; renderer?: OfficialReportRenderer }
): { greyscale: string; falsecolor: string; camera: Camera3dView } {
  const camera = opts.camera ?? fitRoomCamera(opts.room, opts.elevationM ?? 0);
  const shared = {
    ...opts,
    isolateRoomId: opts.room.id,
    highlightRoomId: null,
    storeyId: opts.room.storeyId,
    camera,
    width: opts.width ?? REPORT_3D_ROOM_WIDTH,
    height: opts.height ?? REPORT_3D_ROOM_HEIGHT,
  };
  return {
    greyscale: renderMode(shared, "greyscale", camera, opts.renderer),
    falsecolor: renderMode(shared, "falsecolor", camera, opts.renderer),
    camera,
  };
}

/** Render every storey overview plus every room, both modes, for the official PDF path. */
export function renderAllReport3dViews(opts: {
  scene: ProjectSceneV2;
  results?: ResultsV2 | null;
  photometry?: Record<string, PhotometricData>;
  overviewCamera?: Camera3dView | null;
  overviewWidth?: number;
  overviewHeight?: number;
  roomWidth?: number;
  roomHeight?: number;
  falseColorScale?: FalseColorScale;
}): {
  projectGreyscale: string;
  projectFalseColor: string;
  projectIsolines?: string;
  roomGreyscale: Record<string, string>;
  roomFalseColor: Record<string, string>;
  roomIsolines?: Record<string, string>;
} {
  const storeyId = opts.scene.ui.activeStoreyId ?? opts.scene.storeys[0]?.id;
  const overviewOpts = {
    scene: opts.scene,
    results: opts.results,
    photometry: opts.photometry,
    falseColorScale: opts.falseColorScale,
    camera: opts.overviewCamera ?? fitOverviewCamera(opts.scene, storeyId),
    storeyId,
    width: opts.overviewWidth ?? REPORT_3D_OVERVIEW_WIDTH,
    height: opts.overviewHeight ?? REPORT_3D_OVERVIEW_HEIGHT,
  };
  const overview = renderBuilding3dPair(overviewOpts);
  const projectIsolines = tryOfficialReport3dIsolineStill(() =>
    renderOfficialReport3dIsolines(overviewOpts)
  );
  const roomGreyscale: Record<string, string> = {};
  const roomFalseColor: Record<string, string> = {};
  const roomIsolines: Record<string, string> = {};
  for (const room of opts.scene.rooms) {
    const storey = opts.scene.storeys.find((s) => s.id === room.storeyId);
    const pair = renderRoom3dPair({
      scene: opts.scene,
      results: opts.results,
      photometry: opts.photometry,
      falseColorScale: opts.falseColorScale,
      room,
      elevationM: storey?.elevationM ?? 0,
      width: opts.roomWidth ?? REPORT_3D_ROOM_WIDTH,
      height: opts.roomHeight ?? REPORT_3D_ROOM_HEIGHT,
    });
    roomGreyscale[room.id] = pair.greyscale;
    roomFalseColor[room.id] = pair.falsecolor;
    assignOfficialReport3dIsolineStill(roomIsolines, room.id, () =>
      renderOfficialReport3dIsolines({
        scene: opts.scene,
        results: opts.results,
        photometry: opts.photometry,
        falseColorScale: opts.falseColorScale,
        camera: pair.camera,
        storeyId: room.storeyId,
        isolateRoomId: room.id,
        highlightRoomId: null,
        width: opts.roomWidth ?? REPORT_3D_ROOM_WIDTH,
        height: opts.roomHeight ?? REPORT_3D_ROOM_HEIGHT,
      })
    );
  }
  return {
    projectGreyscale: overview.greyscale,
    projectFalseColor: overview.falsecolor,
    ...(projectIsolines ? { projectIsolines } : {}),
    roomGreyscale,
    roomFalseColor,
    ...(Object.keys(roomIsolines).length ? { roomIsolines } : {}),
  };
}

/** Same stills as `renderAllReport3dViews`, reusing one WebGL renderer and yielding between views. */
export async function renderAllReport3dViewsAsync(
  opts: {
    scene: ProjectSceneV2;
    results?: ResultsV2 | null;
    photometry?: Record<string, PhotometricData>;
    overviewCamera?: Camera3dView | null;
    overviewWidth?: number;
    overviewHeight?: number;
    roomWidth?: number;
    roomHeight?: number;
    falseColorScale?: FalseColorScale;
  },
  yieldTo: () => Promise<void> = () => Promise.resolve()
): Promise<{
  projectGreyscale: string;
  projectFalseColor: string;
  projectIsolines?: string;
  roomGreyscale: Record<string, string>;
  roomFalseColor: Record<string, string>;
  roomIsolines?: Record<string, string>;
}> {
  const storeyId = opts.scene.ui.activeStoreyId ?? opts.scene.storeys[0]?.id;
  const renderer = createOffscreenReportRenderer();
  try {
    await yieldTo();
    const overviewOpts = {
      scene: opts.scene,
      results: opts.results,
      photometry: opts.photometry,
      falseColorScale: opts.falseColorScale,
      camera: opts.overviewCamera ?? fitOverviewCamera(opts.scene, storeyId),
      storeyId,
      width: opts.overviewWidth ?? REPORT_3D_OVERVIEW_WIDTH,
      height: opts.overviewHeight ?? REPORT_3D_OVERVIEW_HEIGHT,
      renderer,
    };
    const overview = renderBuilding3dPair(overviewOpts);
    await yieldTo();
    const projectIsolines = tryOfficialReport3dIsolineStill(() =>
      renderOfficialReport3dIsolines(overviewOpts)
    );
    const roomGreyscale: Record<string, string> = {};
    const roomFalseColor: Record<string, string> = {};
    const roomIsolines: Record<string, string> = {};
    for (const room of opts.scene.rooms) {
      await yieldTo();
      const storey = opts.scene.storeys.find((s) => s.id === room.storeyId);
      const camera = fitRoomCamera(room, storey?.elevationM ?? 0);
      const shared = {
        scene: opts.scene,
        results: opts.results,
        photometry: opts.photometry,
        falseColorScale: opts.falseColorScale,
        isolateRoomId: room.id,
        highlightRoomId: null as string | null,
        storeyId: room.storeyId,
        camera,
        width: opts.roomWidth ?? REPORT_3D_ROOM_WIDTH,
        height: opts.roomHeight ?? REPORT_3D_ROOM_HEIGHT,
        renderer,
      };
      roomGreyscale[room.id] = renderMode(shared, "greyscale", camera, renderer);
      await yieldTo();
      roomFalseColor[room.id] = renderMode(shared, "falsecolor", camera, renderer);
      await yieldTo();
      assignOfficialReport3dIsolineStill(roomIsolines, room.id, () =>
        renderOfficialReport3dIsolines(shared)
      );
    }
    return {
      projectGreyscale: overview.greyscale,
      projectFalseColor: overview.falsecolor,
      ...(projectIsolines ? { projectIsolines } : {}),
      roomGreyscale,
      roomFalseColor,
      ...(Object.keys(roomIsolines).length ? { roomIsolines } : {}),
    };
  } finally {
    renderer.dispose();
  }
}
