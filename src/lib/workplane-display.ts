/** The 3D workplane / calculation plane is shown unless the user has hidden it. */
export function showWorkplaneFromUi(ui: { showWorkplane?: boolean } | null | undefined): boolean {
  return ui?.showWorkplane !== false;
}
