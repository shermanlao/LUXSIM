import type { ProjectSceneV2, SceneJson, AnyScene, ResultsV2 } from "./types";
import type { CalcResults } from "../../solver/src/types";
import { rectPolygon } from "./geometry";

function id(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function isSceneV2(scene: unknown): scene is ProjectSceneV2 {
  return Boolean(
    scene &&
      typeof scene === "object" &&
      (scene as ProjectSceneV2).version === 2 &&
      Array.isArray((scene as ProjectSceneV2).storeys)
  );
}

export function isSceneV1(scene: unknown): scene is SceneJson {
  return Boolean(
    scene &&
      typeof scene === "object" &&
      (scene as SceneJson).version === 1 &&
      (scene as SceneJson).room
  );
}

export function defaultSceneV2(): ProjectSceneV2 {
  const storeyId = id("storey");
  return {
    version: 2,
    storeys: [{ id: storeyId, name: "GF", elevationM: 0, heightM: 3.0 }],
    rooms: [],
    underlays: [],
    fixtureLibraryIds: [],
    instances: [],
    ui: {
      activeStoreyId: storeyId,
      activeRoomId: null,
      viewMode: "top",
      tool: "select",
      camera3d: null,
    },
  };
}

/** Wrap v1 single-room scene into v2 building model. */
export function migrateSceneV1toV2(scene: SceneJson): ProjectSceneV2 {
  const storeyId = id("storey");
  const roomId = id("room");
  const room = scene.room;
  const libraryIds = [...new Set(scene.luminaires.map((l) => l.luminaireId))];

  return {
    version: 2,
    storeys: [
      {
        id: storeyId,
        name: "GF",
        elevationM: 0,
        heightM: room.height,
      },
    ],
    rooms: [
      {
        id: roomId,
        storeyId,
        name: "Room 1",
        polygon: rectPolygon(0, 0, room.width, room.depth),
        heightM: room.height,
        workplaneHeightM: room.workplaneHeight,
        reflectance: { ...room.reflectance },
        calc: {
          gridSpacing: scene.gridSpacing,
          interreflection: scene.calcOptions.interreflection,
          bounces: scene.calcOptions.bounces,
          computeUgr: scene.calcOptions.computeUgr,
        },
      },
    ],
    underlays: [],
    fixtureLibraryIds: libraryIds,
    instances: scene.luminaires.map((l) => ({
      instanceId: l.instanceId,
      luminaireId: l.luminaireId,
      storeyId,
      roomId,
      name: l.name,
      position: { ...l.position },
      rotationDeg: l.rotationDeg,
    })),
    ui: {
      activeStoreyId: storeyId,
      activeRoomId: roomId,
      viewMode: "top",
      tool: "select",
      camera3d: null,
    },
  };
}

const VIEW_MODES = new Set(["top", "bottom", "front", "side", "persp3d"]);

function normalizeViewMode(raw: unknown): ProjectSceneV2["ui"]["viewMode"] {
  if (typeof raw === "string" && VIEW_MODES.has(raw)) {
    return raw as ProjectSceneV2["ui"]["viewMode"];
  }
  return "top";
}

function normalizeCamera3d(
  raw: unknown
): ProjectSceneV2["ui"]["camera3d"] {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as { position?: unknown; target?: unknown };
  if (
    !Array.isArray(c.position) ||
    !Array.isArray(c.target) ||
    c.position.length !== 3 ||
    c.target.length !== 3 ||
    !c.position.every((n) => typeof n === "number") ||
    !c.target.every((n) => typeof n === "number")
  ) {
    return null;
  }
  return {
    position: [c.position[0], c.position[1], c.position[2]],
    target: [c.target[0], c.target[1], c.target[2]],
  };
}

export function normalizeScene(scene: unknown): ProjectSceneV2 {
  if (isSceneV2(scene)) {
    return {
      ...scene,
      underlays: scene.underlays ?? [],
      fixtureLibraryIds: scene.fixtureLibraryIds ?? [],
      instances: scene.instances ?? [],
      rooms: scene.rooms ?? [],
      storeys: scene.storeys?.length ? scene.storeys : defaultSceneV2().storeys,
      ui: {
        activeStoreyId:
          scene.ui?.activeStoreyId ?? scene.storeys[0]?.id ?? defaultSceneV2().storeys[0]!.id,
        activeRoomId: scene.ui?.activeRoomId ?? null,
        viewMode: normalizeViewMode(scene.ui?.viewMode),
        tool: scene.ui?.tool ?? "select",
        camera3d: normalizeCamera3d(scene.ui?.camera3d),
      },
    };
  }
  if (isSceneV1(scene)) return migrateSceneV1toV2(scene);
  return defaultSceneV2();
}

export function normalizeResults(
  results: unknown,
  scene?: ProjectSceneV2
): ResultsV2 {
  if (
    results &&
    typeof results === "object" &&
    (results as ResultsV2).version === 2 &&
    (results as ResultsV2).byRoomId
  ) {
    return results as ResultsV2;
  }
  // v1 single CalcResults → attach to first room if present
  if (results && typeof results === "object" && (results as CalcResults).grid) {
    const roomId = scene?.rooms[0]?.id;
    if (roomId) {
      return { version: 2, byRoomId: { [roomId]: results as CalcResults } };
    }
  }
  return { version: 2, byRoomId: {} };
}

export function ensureAnyScene(scene: AnyScene): ProjectSceneV2 {
  return normalizeScene(scene);
}
