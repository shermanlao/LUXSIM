import {
  defaultUgrObserverPositions,
  UGR_EYE_HEIGHT_M,
  type UgrObserverPosition,
} from "../../solver/src/ugr";
import { pointInPolygon, roomBounds } from "./geometry";
import type { RoomV2, Vec2 } from "./types";

/** Inset from the boundary after snapping an outside observer inside the polygon. */
const SNAP_INSET_M = 0.05;

export function polygonToLocal(room: RoomV2): { local: Vec2[]; width: number; depth: number } {
  const b = roomBounds(room);
  return {
    local: room.polygon.map((p) => ({ x: p.x - b.minX, y: p.y - b.minY })),
    width: b.width,
    depth: b.depth,
  };
}

/** Shoelace centroid of a ring; null if the polygon has no area. */
export function polygonCentroid(polygon: Vec2[]): Vec2 | null {
  if (polygon.length < 3) return null;
  let area2 = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const p = polygon[i]!;
    const q = polygon[(i + 1) % polygon.length]!;
    const cross = p.x * q.y - q.x * p.y;
    area2 += cross;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
  }
  if (Math.abs(area2) < 1e-18) return null;
  return { x: cx / (3 * area2), y: cy / (3 * area2) };
}

/**
 * A point known to lie inside the local-coord polygon, used as the snap target
 * and as a fallback when the AABB centre sits in a notch.
 */
export function interiorTarget(localPolygon: Vec2[], width: number, depth: number): Vec2 | null {
  const centroid = polygonCentroid(localPolygon);
  if (centroid && pointInPolygon(centroid, localPolygon)) return centroid;
  const mid = { x: width / 2, y: depth / 2 };
  if (pointInPolygon(mid, localPolygon)) return mid;
  const steps = 24;
  for (let j = 1; j < steps; j += 1) {
    for (let i = 1; i < steps; i += 1) {
      const p = { x: (width * i) / steps, y: (depth * j) / steps };
      if (pointInPolygon(p, localPolygon)) return p;
    }
  }
  return null;
}

function snapInside(point: Vec2, polygon: Vec2[], interior: Vec2): Vec2 {
  if (pointInPolygon(point, polygon)) return point;
  let lo = 0;
  let hi = 1;
  let inside = interior;
  for (let k = 0; k < 40; k += 1) {
    const mid = (lo + hi) / 2;
    const p = {
      x: interior.x + (point.x - interior.x) * mid,
      y: interior.y + (point.y - interior.y) * mid,
    };
    if (pointInPolygon(p, polygon)) {
      lo = mid;
      inside = p;
    } else {
      hi = mid;
    }
  }
  const dist = Math.hypot(inside.x - interior.x, inside.y - interior.y);
  if (dist <= 1e-9) return interior;
  const inset = Math.min(SNAP_INSET_M, dist * 0.1);
  const s = Math.max(0, 1 - inset / dist);
  const snapped = {
    x: interior.x + (inside.x - interior.x) * s,
    y: interior.y + (inside.y - interior.y) * s,
  };
  return pointInPolygon(snapped, polygon) ? snapped : interior;
}

/**
 * Six simplified CIE 117 assist observer positions in room-local coordinates.
 * AABB-fraction points that already lie in the polygon are kept; any point
 * in a notch or otherwise outside is snapped along the line to an interior
 * target so all six remain inside. Eye height stays 1.2 m.
 */
export function ugrObserverPositionsInRoom(room: RoomV2): UgrObserverPosition[] {
  const { local, width, depth } = polygonToLocal(room);
  const defaults = defaultUgrObserverPositions(width, depth, UGR_EYE_HEIGHT_M);
  const target = interiorTarget(local, width, depth);
  if (!target) return defaults;
  return defaults.map((p) => {
    const xy = snapInside({ x: p.x, y: p.y }, local, target);
    return { x: xy.x, y: xy.y, z: UGR_EYE_HEIGHT_M };
  });
}
