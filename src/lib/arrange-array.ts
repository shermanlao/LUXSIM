import { pointInPolygon, roomBounds, type RoomV2, type Vec2 } from "@luxsim/project-io";

export type ArrayMode = "rect" | "line";

export type ArrayParams = {
  mode: ArrayMode;
  rows: number;
  cols: number;
  count: number;
  spacingX: number;
  spacingY: number;
  wallOffset: number;
  rotationDeg: number;
};

export type ArrayPoint = { x: number; y: number; rotationDeg: number };

export type ArrayPlanResult = {
  /** All grid / line points before room clip */
  proposed: ArrayPoint[];
  /** Points inside room.polygon */
  inside: ArrayPoint[];
  skippedOutside: number;
};

export function planRectArray(room: RoomV2, params: Omit<ArrayParams, "mode" | "count">): ArrayPoint[] {
  const rows = Math.max(1, Math.floor(params.rows));
  const cols = Math.max(1, Math.floor(params.cols));
  const spacingX = Math.max(0.01, params.spacingX);
  const spacingY = Math.max(0.01, params.spacingY);
  const wallOffset = Math.max(0, params.wallOffset);
  const rotationDeg = params.rotationDeg;
  const b = roomBounds(room);
  const points: ArrayPoint[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = b.minX + wallOffset + col * spacingX;
      const y = b.minY + wallOffset + row * spacingY;
      points.push({ x, y, rotationDeg });
    }
  }
  return points;
}

export function planLineArray(room: RoomV2, params: Pick<ArrayParams, "count" | "spacingX" | "rotationDeg">): ArrayPoint[] {
  const count = Math.max(1, Math.floor(params.count));
  const spacing = Math.max(0.01, params.spacingX);
  const rotationDeg = params.rotationDeg;
  const b = roomBounds(room);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const rad = (rotationDeg * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const half = (count - 1) / 2;
  const points: ArrayPoint[] = [];

  for (let i = 0; i < count; i += 1) {
    const t = i - half;
    points.push({
      x: cx + t * spacing * dx,
      y: cy + t * spacing * dy,
      rotationDeg,
    });
  }
  return points;
}

export function clipArrayPointsToRoom(room: RoomV2, proposed: ArrayPoint[]): ArrayPlanResult {
  const inside: ArrayPoint[] = [];
  for (const p of proposed) {
    if (pointInPolygon({ x: p.x, y: p.y }, room.polygon)) {
      inside.push(p);
    }
  }
  return {
    proposed,
    inside,
    skippedOutside: proposed.length - inside.length,
  };
}

export function planFixtureArray(room: RoomV2, params: ArrayParams): ArrayPlanResult {
  const proposed =
    params.mode === "line"
      ? planLineArray(room, params)
      : planRectArray(room, params);
  return clipArrayPointsToRoom(room, proposed);
}

/** Round-trip helper for tests (1 mm tolerance). */
export function pointsRoughlyEqual(a: Vec2, b: Vec2, tolM = 0.001): boolean {
  return Math.abs(a.x - b.x) <= tolM && Math.abs(a.y - b.y) <= tolM;
}
