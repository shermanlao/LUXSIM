import type { EditorWorkflowMode } from "@luxsim/project-io";

/** Which docked rails a workflow tab owns, and where Documentation is shown. */
export type EditorWorkflowRailPlacement = {
  showLeftDocumentation: boolean;
  showLeftBuilding: boolean;
  showLeftRail: boolean;
  showRightRail: boolean;
};

/**
 * The left rail is the primary panel. A tab never uses a right-only layout:
 * Documentation (export) goes on the left, and the right rail stays hidden.
 * Other tabs keep the Building tree on the left and may also show a right rail
 * when that tab has right-hand content.
 */
export function editorWorkflowRailPlacement(opts: {
  workflow: EditorWorkflowMode;
  hasRightContent: boolean;
}): EditorWorkflowRailPlacement {
  const showLeftDocumentation = opts.workflow === "export";
  const showLeftBuilding = !showLeftDocumentation;
  return {
    showLeftDocumentation,
    showLeftBuilding,
    showLeftRail: showLeftBuilding || showLeftDocumentation,
    showRightRail: !showLeftDocumentation && opts.hasRightContent,
  };
}
