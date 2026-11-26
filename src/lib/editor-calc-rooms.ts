import type { ProjectSceneV2 } from "@luxsim/project-io";

export type CalcScope = "room" | "storey" | "all";

export type CalcRoomSkip = { id: string; name: string };

export type CalcRoomsPlan =
  | {
      ok: false;
      reason: "no-room" | "all-empty";
      scope: CalcScope;
      roomIds: [];
      skippedEmpty: CalcRoomSkip[];
    }
  | {
      ok: true;
      reason?: undefined;
      scope: CalcScope;
      roomIds: string[];
      skippedEmpty: CalcRoomSkip[];
    };

/** Choose rooms for Calc room / Calc storey / Calc all. Empty rooms are skipped, not fatal, unless none remain. */
export function planCalcRooms(scene: ProjectSceneV2, scope: CalcScope): CalcRoomsPlan {
  const rooms =
    scope === "all"
      ? scene.rooms
      : scope === "storey"
        ? scene.rooms.filter((r) => r.storeyId === scene.ui.activeStoreyId)
        : scene.rooms.filter((r) => r.id === scene.ui.activeRoomId);

  if (!rooms.length) {
    return { ok: false, reason: "no-room", scope, roomIds: [], skippedEmpty: [] };
  }

  const skippedEmpty: CalcRoomSkip[] = [];
  const roomIds: string[] = [];
  for (const room of rooms) {
    if (scene.instances.some((i) => i.roomId === room.id)) roomIds.push(room.id);
    else skippedEmpty.push({ id: room.id, name: room.name });
  }

  if (!roomIds.length) {
    return { ok: false, reason: "all-empty", scope, roomIds: [], skippedEmpty };
  }
  return { ok: true, scope, roomIds, skippedEmpty };
}

export function formatCalcEmptyError(plan: Extract<CalcRoomsPlan, { ok: false }>): string {
  if (plan.scope === "storey") {
    if (plan.reason === "no-room") {
      return "No rooms on this storey / 此樓層沒有房間";
    }
    if (plan.skippedEmpty.length === 1) {
      return `Room “${plan.skippedEmpty[0]!.name}” on this storey has no fixtures / 此樓層房間「${plan.skippedEmpty[0]!.name}」沒有燈具`;
    }
    return "No rooms on this storey have fixtures to calculate / 此樓層沒有可計算的房間";
  }
  if (plan.reason === "no-room") return "Select or create a room first";
  if (plan.skippedEmpty.length === 1) {
    return `Room “${plan.skippedEmpty[0]!.name}” has no fixtures`;
  }
  return "No rooms have fixtures to calculate";
}

export function formatCalcBusyStatus(scope: CalcScope): string {
  if (scope === "storey") return "Calculating storey… / 正在計算樓層…";
  return "Calculating on client…";
}

export function formatCalcCompleteStatus(
  skippedEmpty: CalcRoomSkip[],
  bilingual: boolean,
  skippedMissing: CalcRoomSkip[] = []
): string {
  const base = bilingual
    ? "Calculation complete (client-side) / 客戶端計算完成"
    : "Calculation complete (client-side)";
  const parts: string[] = [];
  if (skippedEmpty.length) {
    parts.push(`${skippedEmpty.map((s) => s.name).join(", ")} (no fixtures)`);
  }
  if (skippedMissing.length) {
    parts.push(`${skippedMissing.map((s) => s.name).join(", ")} (missing photometry)`);
  }
  if (!parts.length) return base;
  return `${base} · skipped ${parts.join(", ")}`;
}

export function calcStatusTone(
  status: string | null,
  calculating: boolean
): "busy" | "error" | "ok" | null {
  if (calculating) return "busy";
  if (!status) return null;
  const lower = status.toLowerCase();
  if (
    /fail|missing photometry|no fixtures|select or create|缺少|失敗|no rooms on this storey|此樓層沒有/.test(
      lower
    ) ||
    lower.includes("no rooms have fixtures")
  ) {
    return "error";
  }
  if (/calculat|計算/.test(status)) return "ok";
  return null;
}
