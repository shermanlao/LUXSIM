export type UiTipSeed = {
  helpKey: string;
  title: string;
  body: string;
};

export const UI_TIPS: UiTipSeed[] = [
  {
    helpKey: "tool.drawRoom",
    title: "Draw room (CAD)",
    body: "Left-click each corner. Type a length in mm to lock the next point onto a circle around the last corner. Shift constrains to 90°. Click the first point (or press Enter when near it) to close the room. Esc cancels; Backspace undoes the last corner.",
  },
  {
    helpKey: "tool.drawRect",
    title: "Rectangle L×W",
    body: "Enter length and width in millimetres (or with m / cm suffix) and create a rectangle at the storey origin (0, 0). Height comes from the standalone Room height field. Use Select / move to drag the room into place. For irregular rooms, use Draw room instead.",
  },
  {
    helpKey: "tool.roomHeight",
    title: "Room height",
    body: "Standalone ceiling height in millimetres. Applies to the selected room (polygon or rectangle) and to the next room you draw or create.",
  },
  {
    helpKey: "room.maintenanceFactor",
    title: "Maintenance factor (CIE 97)",
    body: "LLMF × LSF × LMF × RSMF (each 0.5–1), product clamped 0.5–1. Default product ≈ 0.80. Applies to maintained EN 12464 assist checks only — the lux solver uses initial lamp output.",
  },
  {
    helpKey: "room.en12464",
    title: "EN 12464-1 assist",
    body: "Optional maintained illuminance / uniformity / UGR targets for pass-fail hints after Calculate. Design assist only — not certification.",
  },
  {
    helpKey: "export.dialuxVerification",
    title: "DIALux verification zip",
    body: "Downloads rooms.json (height, ρ, MF 0.80 default), schedule.csv with rotation_deg, IES/LDT, geometry.dxf, and results CSV. In desktop DIALux use closed rooms, normal luminaires, and match MF. Read README.txt inside the zip.",
  },
];
