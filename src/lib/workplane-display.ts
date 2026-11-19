/** The 3D workplane / calculation plane is shown unless the user has hidden it. */
export function showWorkplaneFromUi(ui: { showWorkplane?: boolean } | null | undefined): boolean {
  return ui?.showWorkplane !== false;
}

/**
 * Small display lift so the official 3D illuminance field (and isolines / value labels)
 * does not z-fight the surface it sits on — the workplane, or the floor slab when the
 * workplane is hidden. The floor mesh itself sits at elevationM + 0.002.
 */
export const OFFICIAL_ILLUMINANCE_DISPLAY_LIFT_M = 0.02;

/** Floor height of the official 3D illuminance field when the workplane is hidden. */
export function officialIlluminanceFloorHeightM(elevationM = 0): number {
  return elevationM + OFFICIAL_ILLUMINANCE_DISPLAY_LIFT_M;
}

/**
 * 3D display height of the official illuminance field (Greyscale / False colour)
 * and of Isolines / Value labels that overlay it.
 * Workplane on: storey elevation + Workplane (m) + display lift.
 * Workplane off: storey elevation + the same display lift, so the field stays
 * visible on the floor without z-fighting the slab.
 */
export function officialIlluminanceFieldHeightM(
  room: { workplaneHeightM: number },
  elevationM = 0,
  showWorkplane = true
): number {
  return showWorkplane
    ? elevationM + room.workplaneHeightM + OFFICIAL_ILLUMINANCE_DISPLAY_LIFT_M
    : officialIlluminanceFloorHeightM(elevationM);
}
