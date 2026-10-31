/** Soft workflow modes (filters panels/tools; not separate apps). */
export type EditorWorkflowMode = "construction" | "light" | "calculation" | "export";

export const WORKFLOW_MODES: {
  id: EditorWorkflowMode;
  label: string;
  hint: string;
}[] = [
  {
    id: "construction",
    label: "Construction",
    hint: "Draw closed rooms, import plans, set height and reflectance.",
  },
  {
    id: "light",
    label: "Light",
    hint: "Select a room, drag fixtures from the library, set rotation.",
  },
  {
    id: "calculation",
    label: "Calculation",
    hint: "Run client calc, review lux / UGR, maintenance factor and EN assist.",
  },
  {
    id: "export",
    label: "Export",
    hint: "PDF, .luxsim, or DIALux verification zip.",
  },
];

export function normalizeWorkflowMode(raw: unknown): EditorWorkflowMode {
  if (raw === "light" || raw === "calculation" || raw === "export" || raw === "construction") {
    return raw;
  }
  return "construction";
}
