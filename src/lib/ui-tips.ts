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
    body: "Left-click each corner. Type a length in mm to lock the next point onto a circle around the last corner. Shift constrains to 90°. Click the first point (or press Enter when near it) to close the room. Esc cancels; Backspace clears the typed length in one press, then removes the last corner. With a DXF underlay, official Top picks snap to endpoints, midpoints, and the nearest point on a segment within 8 CSS pixels.",
  },
  {
    helpKey: "tool.drawRect",
    title: "Rectangle L×W",
    body: "Enter length and width in millimetres (or with m / cm suffix) and create a rectangle at the storey origin (0, 0). Height comes from the standalone Room height field. After creation, select the room and drag a corner handle to stretch that vertex, or a mid-edge handle to insert a corner. Rooms and storeys are not translated by dragging the fill. Use Select / move to drag fixtures on their own. For irregular rooms, use Draw room instead.",
  },
  {
    helpKey: "tool.createRoomsFromDxf",
    title: "Create rooms from DXF",
    body: "With a DXF underlay on the current storey, this makes rooms from closed polylines, from simple closed loops of connected lines, and from each minimal room face in a T-junction or shared-wall network. Official rooms are simple polygons without holes: if one room lies fully inside another with no connecting wall, only the inner room is kept. DWG is not parsed. CIRCLE, ARC, ELLIPSE, SPLINE, old POLYLINE, and LWPOLYLINE bulges are also traced (curves as polygons). New rooms use the official defaults (maintenance factor 0.80, no EN template) and the Building Room height. Scale follows the current Calibrate scale. Existing rooms are left unchanged.",
  },
  {
    helpKey: "tool.unionRooms",
    title: "Union rooms",
    body: "With Select idle, click Union rooms, then choose two rooms on the current storey. If a room is already selected, it is the first (surviving) room and you only pick the second. The first room keeps its name, maintenance factor, EN template, height, and other properties; the second is removed after a successful union. Rooms may overlap in area or share an edge. The command is refused when the rooms are on different storeys, are missing, only touch at a point or not at all, or the union would contain a hole or would not be a single simple room. Esc cancels the pick. Alignment is not included.",
  },
  {
    helpKey: "tool.subtractRooms",
    title: "Subtract rooms",
    body: "With Select idle, click Subtract rooms, then choose two rooms on the current storey. If a room is already selected, it is the first (kept) room and you only pick the cutter. The first room keeps its name, maintenance factor, EN template, height, and other properties; its outline becomes first minus second as a single simple ring. The cutter stays in place and is not deleted. The command is refused when the rooms are on different storeys, are missing, are the same room, do not overlap in area (edge-touch or disjoint is not a cut), or the result would be empty, would split into two or more pieces, would contain a hole, would cross itself, would have fewer than 3 unique vertices, or would have area below 0.01 m². Fixtures of the kept room whose XY no longer lie in the cut outline are unassigned; cutter fixtures are unchanged. Luminaires are not deleted. Esc cancels the pick. Alignment is not included.",
  },
  {
    helpKey: "tool.intersectRooms",
    title: "Intersect rooms",
    body: "With Select idle, click Intersect rooms, then choose two rooms on the current storey. If a room is already selected, it is the first (kept) room and you only pick the second. The first room keeps its name, maintenance factor, EN template, height, and other properties; its outline becomes the overlapping area as a single simple ring. The second room is removed after a successful intersect. The command is refused when the rooms are on different storeys, are missing, are the same room, do not overlap in area (edge-touch or disjoint is not an intersection), or the result would be empty, would split into two or more pieces, would contain a hole, would cross itself, would have fewer than 3 unique vertices, or would have area below 0.01 m². Fixtures of either room that still lie in the intersection are assigned to the surviving room; fixtures that fall outside stay on the storey with their room assignment cleared. Luminaires are not deleted. Esc cancels the pick. Alignment is not included.",
  },
  {
    helpKey: "tool.xorRooms",
    title: "XOR rooms",
    body: "With Select idle, click XOR rooms, then choose two rooms on the current storey. If a room is already selected, it is the first (kept) room and you only pick the second. The first room keeps its name, maintenance factor, EN template, height, and other properties; its outline becomes the symmetric difference (first XOR second) as a single simple ring. The second room is removed after a successful XOR. The command is refused when the rooms are on different storeys, are missing, are the same room, do not overlap in area (edge-touch or disjoint is not an XOR), or the result would be empty, would split into two or more pieces (typical when both rooms have a remainder), would contain a hole (including a room strictly inside the other), would cross itself, would have fewer than 3 unique vertices, or would have area below 0.01 m². A bite that shares the outer boundary can succeed as a single ring. Fixtures of either room that still lie in the XOR outline are assigned to the surviving room; fixtures that fall outside stay on the storey with their room assignment cleared. Luminaires are not deleted. Esc cancels the pick. Alignment is not included.",
  },
  {
    helpKey: "tool.alignRooms",
    title: "Align rooms",
    body: "With Select idle, click Align rooms, then choose two rooms on the current storey. First pick an alignment: Left, Right, Top, Bottom, H centre, or V centre (Left is the default). If a room is already selected, it is the reference and stays put; you only pick the room to move. The second room is translated so the matching edge or centre of its bounding box lines up with the reference; its shape does not change. Both rooms are kept. Fixtures assigned to the moved room follow the same translation. Luminaires are not deleted. The command is refused when the rooms are on different storeys, are missing, are the same room, the room is already aligned, or the move would cross itself, would have fewer than 3 unique vertices, or would have area below 0.01 m². Esc cancels the pick. Even spacing / distribute is not included.",
  },
  {
    helpKey: "tool.distributeRooms",
    title: "Distribute rooms",
    body: "With Select idle, click Distribute rooms, then click at least three rooms on the current storey and press Enter. First pick an axis: Horizontal or Vertical (Horizontal is the default). If a room is already selected, it is the first room in the set. Rooms are ordered by the leading edge of the bounding box (min X or min Y). The first and last rooms in that order stay put; interior rooms translate so the gaps between consecutive bounding boxes are equal. Shapes do not change. Fixtures assigned to a moved room follow the same translation. Luminaires are not deleted. The command is refused when the rooms are on different storeys, a room is missing, fewer than three rooms are selected, the rooms are already evenly spaced, or a move would cross itself, would have fewer than 3 unique vertices, or would have area below 0.01 m². Esc cancels the pick. Clicking the button again cancels.",
  },
  {
    helpKey: "tool.filletCorner",
    title: "Fillet corner",
    body: "With Select idle, click Fillet corner, enter a radius in millimetres, and click a corner handle of a room on the current storey. If a room is already selected, you only pick the corner; otherwise pick the room first, then the corner. A mid-edge insert handle is not a fillet target. The sharp vertex is replaced by a tessellated circular arc; official rooms stay plain polygons. The command is refused when the radius is 0 or negative, the room or corner is missing, the room is on another storey, the corner is already straight, the radius is too large for the adjacent edges, or the result would cross itself, would have fewer than 3 unique vertices, would have area below 0.01 m², or would not be a single simple room. Fixtures assigned to the room whose XY no longer lie in the filleted outline have their room assignment cleared; fixtures still inside keep their assignment and are not moved. Luminaires are not deleted. Esc cancels the pick. Clicking the button again cancels. Filleting every corner at once is not included.",
  },
  {
    helpKey: "tool.roomHeight",
    title: "Room height",
    body: "Standalone ceiling height in millimetres, under Building (default 2800). Visible before a room exists, and used for the next room you draw or create. If a room is selected, changing it also updates that room’s ceiling. Other rooms stay as they are.",
  },
  {
    helpKey: "tool.copyStorey",
    title: "Copy storey",
    body: "Copies the current storey into a new storey in the same building. The source storey is left unchanged. The copy is named Copy of {name} (or Copy of {name} 2, 3, … if that name is taken) and is placed immediately above the source at source elevation + source storey height, so the new floor does not overlap the source slab. If another storey already occupies that elevation, the copy steps up by the source storey height until a free slot is found. Rooms are copied with the same plan polygons, heights, materials, maintenance factor, EN targets, and other official properties, but with new ids. Luminaires on the source storey are copied with the same plan position, mounting height, rotation, and photometry reference; room assignments are remapped to the new rooms. Underlays and calculation results are not copied — run Calculate on the new storey. After a successful copy, the new storey is selected. Ctrl+Z undoes the copy as one step.",
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
    title: "Verification pack",
    body: "Downloads rooms.json (height, ρ, MF 0.80 default), schedule.csv with rotation_deg, IES/LDT, geometry.dxf, and results CSV for an independent cross-check. Use closed rooms, normal luminaires, and match MF. Read README.txt inside the zip.",
  },
];
