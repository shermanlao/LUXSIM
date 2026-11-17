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
  type Camera3dView,
  type Display3dMode,
  type ProjectSceneV2,
  type ResultsV2,
  type RoomV2,
} from "@luxsim/project-io";
import { buildBuildingThreeScene, setMirroredFrontFace } from "./scene-3d-model";

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
      return renderer.domElement.toDataURL("image/jpeg", opts.quality ?? 0.85);
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
  });
  try {
    const jpegOpts = {
      scene: built.scene,
      camera,
      width: opts.width ?? 1800,
      height: opts.height ?? 1400,
      quality: opts.quality ?? 0.85,
    };
    return renderer ? renderer.renderToJpeg(jpegOpts) : renderThreeSceneToJpeg(jpegOpts);
  } finally {
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
    width: opts.width ?? 1280,
    height: opts.height ?? 900,
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
}): {
  projectGreyscale: string;
  projectFalseColor: string;
  roomGreyscale: Record<string, string>;
  roomFalseColor: Record<string, string>;
} {
  const storeyId = opts.scene.ui.activeStoreyId ?? opts.scene.storeys[0]?.id;
  const overview = renderBuilding3dPair({
    scene: opts.scene,
    results: opts.results,
    photometry: opts.photometry,
    camera: opts.overviewCamera ?? fitOverviewCamera(opts.scene, storeyId),
    storeyId,
    width: opts.overviewWidth ?? 1920,
    height: opts.overviewHeight ?? 1080,
  });
  const roomGreyscale: Record<string, string> = {};
  const roomFalseColor: Record<string, string> = {};
  for (const room of opts.scene.rooms) {
    const storey = opts.scene.storeys.find((s) => s.id === room.storeyId);
    const pair = renderRoom3dPair({
      scene: opts.scene,
      results: opts.results,
      photometry: opts.photometry,
      room,
      elevationM: storey?.elevationM ?? 0,
      width: opts.roomWidth ?? 1400,
      height: opts.roomHeight ?? 1100,
    });
    roomGreyscale[room.id] = pair.greyscale;
    roomFalseColor[room.id] = pair.falsecolor;
  }
  return {
    projectGreyscale: overview.greyscale,
    projectFalseColor: overview.falsecolor,
    roomGreyscale,
    roomFalseColor,
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
  },
  yieldTo: () => Promise<void> = () => Promise.resolve()
): Promise<{
  projectGreyscale: string;
  projectFalseColor: string;
  roomGreyscale: Record<string, string>;
  roomFalseColor: Record<string, string>;
}> {
  const storeyId = opts.scene.ui.activeStoreyId ?? opts.scene.storeys[0]?.id;
  const renderer = createOffscreenReportRenderer();
  try {
    await yieldTo();
    const overview = renderBuilding3dPair({
      scene: opts.scene,
      results: opts.results,
      photometry: opts.photometry,
      camera: opts.overviewCamera ?? fitOverviewCamera(opts.scene, storeyId),
      storeyId,
      width: opts.overviewWidth ?? 1920,
      height: opts.overviewHeight ?? 1080,
      renderer,
    });
    const roomGreyscale: Record<string, string> = {};
    const roomFalseColor: Record<string, string> = {};
    for (const room of opts.scene.rooms) {
      await yieldTo();
      const storey = opts.scene.storeys.find((s) => s.id === room.storeyId);
      const camera = fitRoomCamera(room, storey?.elevationM ?? 0);
      const shared = {
        scene: opts.scene,
        results: opts.results,
        photometry: opts.photometry,
        isolateRoomId: room.id,
        highlightRoomId: null as string | null,
        storeyId: room.storeyId,
        camera,
        width: opts.roomWidth ?? 1400,
        height: opts.roomHeight ?? 1100,
        renderer,
      };
      roomGreyscale[room.id] = renderMode(shared, "greyscale", camera, renderer);
      await yieldTo();
      roomFalseColor[room.id] = renderMode(shared, "falsecolor", camera, renderer);
    }
    return {
      projectGreyscale: overview.greyscale,
      projectFalseColor: overview.falsecolor,
      roomGreyscale,
      roomFalseColor,
    };
  } finally {
    renderer.dispose();
  }
}
