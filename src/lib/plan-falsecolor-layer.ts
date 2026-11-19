import type {
  FalseColorScale,
  FixtureInstance,
  IsoluxModel,
  ResultsV2,
  RoomV2,
} from "@luxsim/project-io";
import { officialIsoluxModelForRoom } from "@luxsim/project-io";

export type OfficialPlanIsoluxEntry = { room: RoomV2; model: IsoluxModel };

/**
 * Build official plan isolux models. Callers must memoize this against results,
 * room geometry, and scale — never against cursor position or a live pan/zoom view.
 */
export function officialPlanIsoluxModels(input: {
  rooms: RoomV2[];
  results: ResultsV2;
  fixtures?: FixtureInstance[];
  showFalseColor?: boolean;
  showIsolines?: boolean;
  showValueLabels?: boolean;
  colorScale?: FalseColorScale;
  targetLongSide?: number;
}): OfficialPlanIsoluxEntry[] {
  const {
    rooms,
    results,
    fixtures = [],
    showFalseColor = true,
    showIsolines = false,
    showValueLabels = false,
    colorScale,
    targetLongSide = 800,
  } = input;
  if (!showFalseColor && !showIsolines && !showValueLabels) return [];
  const out: OfficialPlanIsoluxEntry[] = [];
  for (const room of rooms) {
    const model = officialIsoluxModelForRoom(room, results.byRoomId[room.id], {
      mode: showFalseColor ? "falsecolor" : "isolines",
      fixtures: fixtures.filter((i) => i.roomId === room.id),
      targetLongSide,
      colorScale,
      includeContours: showIsolines,
      includeValueLabels: showValueLabels,
    });
    if (model) out.push({ room, model });
  }
  return out;
}

/** Stable key for isolux model inputs. View pan/zoom / cursor must not appear here. */
export function officialPlanIsoluxModelKey(input: {
  roomIds: readonly string[];
  results: ResultsV2;
  showFalseColor?: boolean;
  showIsolines?: boolean;
  showValueLabels?: boolean;
  colorScale?: FalseColorScale;
  instanceIds?: readonly string[];
}): string {
  const scale = input.colorScale
    ? `${input.colorScale.minLux}:${input.colorScale.maxLux}`
    : "";
  const rooms = input.roomIds.join(",");
  const instances = (input.instanceIds ?? []).join(",");
  const resultRooms = Object.keys(input.results.byRoomId).sort().join(",");
  return [
    rooms,
    resultRooms,
    String(input.showFalseColor !== false),
    String(Boolean(input.showIsolines)),
    String(Boolean(input.showValueLabels)),
    scale,
    instances,
  ].join("|");
}
