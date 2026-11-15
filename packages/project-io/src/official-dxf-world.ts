import type { DxfEntity, Vec2 } from "./types";

/**
 * Official DXF entity→world scale/origin fields. `metersPerUnit` is metres per
 * drawing unit (default 1: entities already in metres). `offsetX` / `offsetY`
 * are the same world-metre origin used by raster underlays; they are added
 * after the uniform scale and are not themselves multiplied.
 */
export type OfficialDxfWorldUnderlay = {
  metersPerUnit?: number;
  offsetX?: number;
  offsetY?: number;
} | null | undefined;

function finiteNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Uniform metres-per-drawing-unit; non-positive or non-finite values fall back to 1. */
export function officialDxfMetersPerUnit(underlay: OfficialDxfWorldUnderlay): number {
  const mpu = finiteNumber(underlay?.metersPerUnit, 1);
  return mpu > 0 ? mpu : 1;
}

export function officialDxfWorldOffset(underlay: OfficialDxfWorldUnderlay): Vec2 {
  return {
    x: finiteNumber(underlay?.offsetX, 0),
    y: finiteNumber(underlay?.offsetY, 0),
  };
}

/**
 * Official world mapping for a DXF entity point:
 * `(entity × metersPerUnit) + (offsetX, offsetY)`.
 * When `metersPerUnit` is 1 and the origin is 0, the result equals the entity
 * point. Existing room polygons and fixture coordinates are already in world
 * metres and must not be remapped with this helper. New rooms created from
 * DXF entities must use it so their polygons land in official world space.
 */
export function officialDxfEntityToWorld(
  point: Vec2,
  underlay?: OfficialDxfWorldUnderlay
): Vec2 {
  const mpu = officialDxfMetersPerUnit(underlay);
  const origin = officialDxfWorldOffset(underlay);
  return {
    x: origin.x + point.x * mpu,
    y: origin.y + point.y * mpu,
  };
}

/**
 * Map LINE / LWPOLYLINE entity points into official world metres.
 * Identity (`metersPerUnit` 1, origin 0) returns the same array.
 */
export function officialDxfEntitiesToWorld<T extends Pick<DxfEntity, "points">>(
  entities: T[],
  underlay?: OfficialDxfWorldUnderlay
): T[] {
  const mpu = officialDxfMetersPerUnit(underlay);
  const origin = officialDxfWorldOffset(underlay);
  if (mpu === 1 && origin.x === 0 && origin.y === 0) return entities;
  return entities.map((entity) => ({
    ...entity,
    points: entity.points.map((p) => ({
      x: origin.x + p.x * mpu,
      y: origin.y + p.y * mpu,
    })),
  }));
}
