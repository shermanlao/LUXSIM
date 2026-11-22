import * as THREE from "three";
import type {
  CalcResults,
  FixtureInstance,
  IsolineLevelSettings,
  IsoluxModel,
  ResultsV2,
  RoomV2,
} from "@luxsim/project-io";
import { isoluxPxToWorld, officialIsoluxModelForRoom } from "@luxsim/project-io";
import {
  OFFICIAL_ILLUMINANCE_DISPLAY_LIFT_M,
  officialIlluminanceFieldHeightM,
} from "./workplane-display";

/**
 * Official plan→Three convention used by BuildingScene3D:
 * plan (x, y, z) maps to Three.js (x, z, y). The scene root then applies
 * scale={[-1, 1, 1]} and CW front faces so the 3D floor plate matches Top.
 */
export function planToThree(x: number, y: number, z: number): [number, number, number] {
  return [x, z, y];
}

/** Same lift as the official false-colour workplane so contours do not z-fight the floor. */
export const ISOLUX_WORKPLANE_LIFT_M = OFFICIAL_ILLUMINANCE_DISPLAY_LIFT_M;

/** Counter-scale X so billboard labels stay legible under the official mirrored root. */
export const ISOLUX_LABEL_MIRROR_SCALE_X = -1;

/** Official 3D isoline overlay styling, shared by the editor and Full PDF capture. */
export const ISOLUX_CONTOUR_COLOR = "#e8eef2";
export const ISOLUX_CONTOUR_LABEL_FILL = "#f5f7f8";
export const ISOLUX_VALUE_LABEL_FILL = "#dce8ff";
export const ISOLUX_LABEL_STROKE = "#0a1218";
export const ISOLUX_CONTOUR_LABEL_HEIGHT_M = 0.2;
export const ISOLUX_VALUE_LABEL_HEIGHT_M = 0.16;

/** Canvas texture for official 3D isoline / value labels. Returns null without a document. */
export function createOfficial3dIsoluxLabelTexture(text: string, fill: string): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "700 48px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 8;
    ctx.strokeStyle = ISOLUX_LABEL_STROKE;
    ctx.fillStyle = fill;
    const x = canvas.width / 2;
    const y = canvas.height / 2;
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Attach official 3D isoline contours and labels to a scene group (must be the
 * mirrored plan-handedness `content` group). Never invents a field for rooms
 * without results. Custom levels outside emin–emax yield no contour, as in the editor.
 */
export function addOfficial3dIsoluxOverlay(
  parent: THREE.Object3D,
  rooms: RoomV2[],
  results: ResultsV2 | null | undefined,
  elevationM = 0,
  fixtures: FixtureInstance[] = [],
  opts?: {
    showWorkplane?: boolean;
    isolineSettings?: Pick<IsolineLevelSettings, "mode" | "levels"> | null;
    showValueLabels?: boolean;
  }
): { hasOverlay: boolean; dispose: () => void } {
  const overlays = official3dIsoluxOverlaysForRooms(rooms, results, elevationM, fixtures, {
    showWorkplane: opts?.showWorkplane,
    isolineSettings: opts?.isolineSettings,
  });
  if (overlays.length === 0) {
    return { hasOverlay: false, dispose: () => undefined };
  }
  const group = new THREE.Group();
  group.name = "official3dIsoluxOverlay";
  const disposables: Array<{ dispose: () => void }> = [];
  const lineMat = new THREE.LineBasicMaterial({
    color: ISOLUX_CONTOUR_COLOR,
    depthTest: true,
    depthWrite: false,
  });
  disposables.push(lineMat);

  const addLabels = (labels: Official3dIsoluxLabel[], fill: string, heightM: number) => {
    const scale = isoluxLabelSpriteScale(heightM);
    for (const label of labels) {
      const texture = createOfficial3dIsoluxLabelTexture(label.text, fill);
      if (!texture) continue;
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        sizeAttenuation: true,
      });
      const sprite = new THREE.Sprite(material);
      sprite.position.set(label.position[0], label.position[1], label.position[2]);
      sprite.scale.set(scale[0], scale[1], scale[2]);
      sprite.renderOrder = 3;
      group.add(sprite);
      disposables.push(texture, material);
    }
  };

  for (const overlay of overlays) {
    for (const contour of overlay.contours) {
      for (const polyline of contour.polylines) {
        if (polyline.length < 2) continue;
        const geo = new THREE.BufferGeometry();
        geo.setFromPoints(polyline.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
        const line = new THREE.Line(geo, lineMat);
        line.renderOrder = 2;
        group.add(line);
        disposables.push(geo);
      }
    }
    addLabels(overlay.contourLabels, ISOLUX_CONTOUR_LABEL_FILL, ISOLUX_CONTOUR_LABEL_HEIGHT_M);
    if (opts?.showValueLabels !== false) {
      addLabels(overlay.valueLabels, ISOLUX_VALUE_LABEL_FILL, ISOLUX_VALUE_LABEL_HEIGHT_M);
    }
  }
  parent.add(group);
  return {
    hasOverlay: true,
    dispose: () => {
      parent.remove(group);
      for (const d of disposables) {
        try {
          d.dispose();
        } catch {
          /* ignore */
        }
      }
    },
  };
}


export function isoluxWorkplaneHeightM(
  room: Pick<RoomV2, "workplaneHeightM">,
  results?: Pick<CalcResults, "grid"> | null,
  elevationM = 0,
  showWorkplane = true
): number {
  // Display follows the live room property, not the last calculated grid z.
  // When the workplane is hidden, isolines and labels sit on the floor with the field.
  void results;
  return officialIlluminanceFieldHeightM(room, elevationM, showWorkplane);
}

export type Official3dIsoluxPolyline = [number, number, number][];

export type Official3dIsoluxContour = {
  level: number;
  polylines: Official3dIsoluxPolyline[];
};

export type Official3dIsoluxLabel = {
  text: string;
  position: [number, number, number];
};

export type Official3dIsoluxOverlay = {
  roomId: string;
  heightM: number;
  model: IsoluxModel;
  contours: Official3dIsoluxContour[];
  contourLabels: Official3dIsoluxLabel[];
  valueLabels: Official3dIsoluxLabel[];
};

function toWorkplanePoint(
  model: IsoluxModel,
  px: { x: number; y: number },
  heightM: number
): [number, number, number] {
  const world = isoluxPxToWorld(model.world, px);
  return planToThree(world.x, world.y, heightM);
}

/**
 * Build the official 3D isoline overlay from `buildIsoluxModel` /
 * `officialIsoluxModelForRoom`. Returns null when the room has no calc grid
 * — never invents numbers.
 */
export function official3dIsoluxOverlayForRoom(
  room: RoomV2,
  results: CalcResults | null | undefined,
  elevationM = 0,
  opts?: {
    fixtures?: FixtureInstance[];
    targetLongSide?: number;
    showWorkplane?: boolean;
    isolineSettings?: Pick<IsolineLevelSettings, "mode" | "levels"> | null;
  }
): Official3dIsoluxOverlay | null {
  const model = officialIsoluxModelForRoom(room, results, {
    mode: "isolines",
    fixtures: opts?.fixtures,
    targetLongSide: opts?.targetLongSide ?? 800,
    isolineSettings: opts?.isolineSettings,
  });
  if (!model || !results) return null;
  const heightM = isoluxWorkplaneHeightM(room, results, elevationM, opts?.showWorkplane ?? true);
  const mapLine = (line: { x: number; y: number }[]): Official3dIsoluxPolyline =>
    line.map((px) => toWorkplanePoint(model, px, heightM));
  return {
    roomId: room.id,
    heightM,
    model,
    contours: model.contours.map((c) => ({
      level: c.level,
      polylines: c.polylines.filter((line) => line.length >= 2).map(mapLine),
    })),
    contourLabels: model.contourLabels.map((label) => ({
      text: label.text,
      position: toWorkplanePoint(model, label, heightM),
    })),
    valueLabels: model.valueLabels.map((label) => ({
      text: label.text,
      position: toWorkplanePoint(model, label, heightM),
    })),
  };
}

export function official3dIsoluxOverlaysForRooms(
  rooms: RoomV2[],
  results: ResultsV2 | null | undefined,
  elevationM = 0,
  fixtures: FixtureInstance[] = [],
  opts?: { showWorkplane?: boolean; isolineSettings?: Pick<IsolineLevelSettings, "mode" | "levels"> | null }
): Official3dIsoluxOverlay[] {
  if (!results) return [];
  const out: Official3dIsoluxOverlay[] = [];
  for (const room of rooms) {
    const overlay = official3dIsoluxOverlayForRoom(room, results.byRoomId[room.id], elevationM, {
      fixtures: fixtures.filter((i) => i.roomId === room.id),
      showWorkplane: opts?.showWorkplane,
      isolineSettings: opts?.isolineSettings,
    });
    if (overlay) out.push(overlay);
  }
  return out;
}

export function isoluxLabelSpriteScale(worldHeightM: number, aspect = 2.6): [number, number, number] {
  const h = Math.max(0.08, worldHeightM);
  return [ISOLUX_LABEL_MIRROR_SCALE_X * h * aspect, h, 1];
}
