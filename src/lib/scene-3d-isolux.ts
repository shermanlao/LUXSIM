import type { CalcResults, FixtureInstance, IsoluxModel, ResultsV2, RoomV2 } from "@luxsim/project-io";
import { isoluxPxToWorld, officialIsoluxModelForRoom } from "@luxsim/project-io";

/**
 * Official plan→Three convention used by BuildingScene3D:
 * plan (x, y, z) maps to Three.js (x, z, y). The scene root then applies
 * scale={[-1, 1, 1]} and CW front faces so the 3D floor plate matches Top.
 */
export function planToThree(x: number, y: number, z: number): [number, number, number] {
  return [x, z, y];
}

/** Same lift as the official false-colour workplane so contours do not z-fight the floor. */
export const ISOLUX_WORKPLANE_LIFT_M = 0.02;

/** Counter-scale X so billboard labels stay legible under the official mirrored root. */
export const ISOLUX_LABEL_MIRROR_SCALE_X = -1;

export function isoluxWorkplaneHeightM(
  room: Pick<RoomV2, "workplaneHeightM">,
  results?: Pick<CalcResults, "grid"> | null,
  elevationM = 0
): number {
  const wp = results?.grid?.z ?? room.workplaneHeightM;
  return elevationM + wp + ISOLUX_WORKPLANE_LIFT_M;
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
  }
): Official3dIsoluxOverlay | null {
  const model = officialIsoluxModelForRoom(room, results, {
    mode: "isolines",
    fixtures: opts?.fixtures,
    targetLongSide: opts?.targetLongSide ?? 800,
  });
  if (!model || !results) return null;
  const heightM = isoluxWorkplaneHeightM(room, results, elevationM);
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
  fixtures: FixtureInstance[] = []
): Official3dIsoluxOverlay[] {
  if (!results) return [];
  const out: Official3dIsoluxOverlay[] = [];
  for (const room of rooms) {
    const overlay = official3dIsoluxOverlayForRoom(room, results.byRoomId[room.id], elevationM, {
      fixtures: fixtures.filter((i) => i.roomId === room.id),
    });
    if (overlay) out.push(overlay);
  }
  return out;
}

export function isoluxLabelSpriteScale(worldHeightM: number, aspect = 2.6): [number, number, number] {
  const h = Math.max(0.08, worldHeightM);
  return [ISOLUX_LABEL_MIRROR_SCALE_X * h * aspect, h, 1];
}
