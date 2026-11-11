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
    helpKey: "export.dialuxEvo",
    title: "Export .evo",
    body: "Builds a DIALux evo 12.1–shaped project zip from your storeys and room polygons (metres, workplane, heights). Luminaire instances are not written into the archive yet—place fixtures in DIALux after import, or use the DIALux pack for IES files. Template supports up to nine room zones per export.",
  },
];
