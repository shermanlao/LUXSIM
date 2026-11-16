/**
 * 3D fixture picking: a click on a fixture selects it; a re-click on the
 * already-selected fixture may toggle it off. Clicks on the background,
 * a room, empty space, or orbiting must not clear the selection.
 */
export type Scene3dPointerTarget = "fixture" | "room" | "background" | "orbit" | "empty";

export function next3dFixtureSelection(
  currentId: string | null,
  clickedFixtureId: string
): string | null {
  return currentId === clickedFixtureId ? null : clickedFixtureId;
}

export function shouldClear3dFixtureSelection(target: Scene3dPointerTarget): boolean {
  return target === "fixture";
}

/** Selecting a fixture must not change 3D room isolate (activeRoomId). */
export function isolateRoomIdAfterFixtureSelect(activeRoomId: string | null): string | null {
  return activeRoomId;
}
