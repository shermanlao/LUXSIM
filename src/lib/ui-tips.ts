import { STOREY_METRICS_EXPLANATION } from "@luxsim/project-io";
import { LINE_ARRAY_PICK_HINT, LINE_ARRAY_SPACING_Y_REASON } from "@/lib/line-array-pick";
import {
  CIRCLE_ARRAY_PICK_HINT,
  CIRCLE_ARRAY_ROTATION_REASON,
  CIRCLE_ARRAY_UNUSED_FIELDS_REASON,
} from "@/lib/circle-array-pick";
import {
  POLYGON_ARRAY_HINT,
  POLYGON_ARRAY_ROTATION_REASON,
  POLYGON_ARRAY_UNUSED_FIELDS_REASON,
} from "@/lib/polygon-array";
import { PLAN_ISOLUX_HINT } from "@/lib/plan-isolux-display";

export type UiTipSeed = {
  helpKey: string;
  title: string;
  body: string;
};

export const UI_TIPS: UiTipSeed[] = [
  {
    helpKey: "tool.drawRoom",
    title: "Draw room (CAD)",
    body: "Left-click each corner. Type a length in mm to lock the next point onto a circle around the last corner. Shift constrains to 90°. Click the first point (or press Enter when near it) to close the room. Esc cancels; Backspace clears the typed length in one press, then removes the last corner. With a DXF underlay, official Top/Bottom picks snap to endpoints, midpoints, and the nearest point on a segment within 8 CSS pixels.",
  },
  {
    helpKey: "tool.drawRect",
    title: "Rectangle L×W",
    body: "Enter length and width in millimetres (or with m / cm suffix) and create a rectangle at the storey origin (0, 0). Height comes from the standalone Room height field. After creation, use Select to drag the room on the Top plan; fixtures in that room follow and the shape stays the same. If the storey is selected in Building, dragging a room fill moves every room on that storey. Use Select / move to drag fixtures on their own. For irregular rooms, use Draw room instead.",
  },
  {
    helpKey: "tool.roomHeight",
    title: "Room height",
    body: "Standalone ceiling height in millimetres, under Building (default 2800). Visible before a room exists, and used for the next room you draw or create. If a room is selected, changing it also updates that room’s ceiling. Other rooms stay as they are.",
  },
  {
    helpKey: "tool.storeyHeight",
    title: "Storey elevation and height",
    body: STOREY_METRICS_EXPLANATION,
  },
  {
    helpKey: "tool.lineArray",
    title: "Line array",
    body: `${LINE_ARRAY_PICK_HINT} ${LINE_ARRAY_SPACING_Y_REASON}`,
  },
  {
    helpKey: "tool.circleArray",
    title: "Circular array",
    body: `${CIRCLE_ARRAY_PICK_HINT} ${CIRCLE_ARRAY_ROTATION_REASON} ${CIRCLE_ARRAY_UNUSED_FIELDS_REASON}`,
  },
  {
    helpKey: "tool.polygonArray",
    title: "Polygon array",
    body: `${POLYGON_ARRAY_HINT} ${POLYGON_ARRAY_ROTATION_REASON} ${POLYGON_ARRAY_UNUSED_FIELDS_REASON}`,
  },
  {
    helpKey: "view.planIsolux",
    title: "Isolines and value labels",
    body: PLAN_ISOLUX_HINT,
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
