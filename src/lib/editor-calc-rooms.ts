import type { ProjectSceneV2 } from "@luxsim/project-io";

export type CalcRoomSkip = { id: string; name: string };

export type CalcRoomsPlan =
  | { ok: false; reason: "no-room" | "all-empty"; roomIds: []; skippedEmpty: CalcRoomSkip[] }
  | { ok: true; reason?: undefined; roomIds: string[]; skippedEmpty: CalcRoomSkip[] };

/** Choose rooms for Calc room / Calc all. Empty rooms are skipped, not fatal, unless none remain. */
export function planCalcRooms(scene: ProjectSceneV2, all: boolean): CalcRoomsPlan {
  const rooms = all
    ? scene.rooms
    : scene.rooms.filter((r) => r.id === scene.ui.activeRoomId);

  if (!rooms.length) {
    return { ok: false, reason: "no-room", roomIds: [], skippedEmpty: [] };
  }

  const skippedEmpty: CalcRoomSkip[] = [];
  const roomIds: string[] = [];
  for (const room of rooms) {
    if (scene.instances.some((i) => i.roomId === room.id)) roomIds.push(room.id);
    else skippedEmpty.push({ id: room.id, name: room.name });
  }

  if (!roomIds.length) {
    return { ok: false, reason: "all-empty", roomIds: [], skippedEmpty };
  }
  return { ok: true, roomIds, skippedEmpty };
}

export function formatCalcEmptyError(plan: Extract<CalcRoomsPlan, { ok: false }>): string {
  if (plan.reason === "no-room") return "Select or create a room first";
  if (plan.skippedEmpty.length === 1) {
    return `Room “${plan.skippedEmpty[0]!.name}” has no fixtures`;
  }
  return "No rooms have fixtures to calculate";
}

export function formatCalcCompleteStatus(skippedEmpty: CalcRoomSkip[], bilingual: boolean): string {
  const base = bilingual
    ? "Calculation complete (client-side) / 客戶端計算完成"
    : "Calculation complete (client-side)";
  if (!skippedEmpty.length) return base;
  const names = skippedEmpty.map((s) => s.name).join(", ");
  return `${base} · skipped ${names} (no fixtures)`;
}

export function calcStatusTone(
  status: string | null,
  calculating: boolean
): "busy" | "error" | "ok" | null {
  if (calculating) return "busy";
  if (!status) return null;
  const lower = status.toLowerCase();
  if (
    /fail|missing photometry|no fixtures|select or create|缺少|失敗/.test(lower) ||
    lower.includes("no rooms have fixtures")
  ) {
    return "error";
  }
  if (/calculat|計算/.test(status)) return "ok";
  return null;
}
