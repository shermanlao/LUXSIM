import { officialMetersPerUnitFromInsUnits } from "./dxf";

export type OfficialAssetUnitMeta = {
  metersPerUnit?: number;
  insunits?: number | null;
};

/**
 * Official metres-per-drawing-unit from an asset meta blob.
 * Prefers a stored `metersPerUnit`, then `$INSUNITS`. Returns undefined when
 * neither yields a positive finite scale, so the caller can keep a default.
 */
export function officialMetersPerUnitFromAssetMeta(
  meta: OfficialAssetUnitMeta | null | undefined
): number | undefined {
  const stored = meta?.metersPerUnit;
  if (typeof stored === "number" && Number.isFinite(stored) && stored > 0) {
    return stored;
  }
  if (meta?.insunits == null) return undefined;
  const fromUnits = officialMetersPerUnitFromInsUnits(meta.insunits);
  return fromUnits > 0 ? fromUnits : undefined;
}

/**
 * Recover a dropped CAD underlay scale from the linked asset meta.
 * Only replaces a missing or default (1) metres-per-unit when the asset
 * records a different official scale (for example 0.001 from $INSUNITS 4).
 */
export function officialRecoverCadMetersPerUnit(
  currentMpu: number | undefined,
  meta: OfficialAssetUnitMeta | null | undefined
): number | undefined {
  const fromAsset = officialMetersPerUnitFromAssetMeta(meta);
  if (fromAsset == null) return undefined;
  const current =
    typeof currentMpu === "number" && Number.isFinite(currentMpu) && currentMpu > 0
      ? currentMpu
      : 1;
  if (current === 1 && fromAsset !== 1) return fromAsset;
  return undefined;
}
