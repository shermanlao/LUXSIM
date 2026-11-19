export type {
  RoomSpec,
  LuminaireInstance,
  GridSettings,
  CalcOptions,
  CalcResults,
} from "./types";
export { calculate } from "./calculate";
export {
  computeUgr,
  defaultUgrObserverPositions,
  UGR_EYE_HEIGHT_M,
} from "./ugr";
export type { UgrObserverPosition } from "./ugr";
export { estimateFlux } from "./direct";
export { interreflectedWorkplaneBoost, interreflectedWallBoost } from "./interreflect";
export {
  GRID_SPACING_MIN_M,
  GRID_SPACING_MAX_M,
  DEFAULT_GRID_SPACING_M,
  WORKPLANE_CLEARANCE_M,
  clampGridSpacingM,
  wallZoneFromSpacingM,
  clampWorkplaneHeightM,
  clampReflectance,
} from "./grid-spacing";
