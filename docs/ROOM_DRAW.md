# Room drawing

Rooms are stored as `RoomV2.polygon` in **metres**. Draw inputs are **millimetres**. Convert with `mm / 1000` (`parseLengthToM` in `packages/project-io`).

## Draw room (CAD) — primary

Tool **Draw room** on **Top** or **Bottom**.

1. Left-click places a corner. A preview “next point” follows the cursor (DIALux-style).
2. Type a length (bare number = mm). The next point is locked to the **circle** of that radius around the last corner. The pointer only chooses the angle.
3. **Shift** constrains to 0° / 90° / 180° / 270°.
4. Left-click or **Enter** commits the preview point.
5. Close by clicking (or Enter) within 200 mm of the first corner after 3+ points.
6. **Esc** cancels the draft. **Backspace** clears the typed length, then removes the last corner.
7. With a parsed DXF underlay, official Top/Bottom corner picks snap to endpoints, midpoints, and the nearest point on a segment within 8 CSS pixels at the current zoom. **Create rooms from DXF** (beside Draw room / Create rectangle) makes rooms from closed polylines and from simple closed loops of connected lines on the current storey, using official new-room defaults and the current Calibrate scale. It does not trace T-junctions or shared walls.

Help tip key: `tool.drawRoom`.

## Rectangle L×W — simple simulation

**Room height** is a standalone field (mm) under Building. It is visible even when no room is selected (default 2800 mm). It sets the selected room’s ceiling, when a room is selected, and is used for the next CAD outline or rectangle. Changing the field with no room selected does not alter existing rooms. It is not part of the L×W form.

In the tools panel, enter **Length** and **Width** (mm, or `m` / `cm` suffix) and **Create rectangle**. The room is placed at the storey origin `(0, 0)` using the current Room height. After creation, use the **Select** tool and drag the room fill on the Top or Bottom plan to translate the whole polygon (rectangle, L-shape, or irregular) without changing its shape. Fixtures that belong to that room move with it. If the storey is selected in Building, dragging a room fill moves every room on that storey by the same XY delta; a click without movement still selects that room. Hold **Shift** to constrain the move to horizontal or vertical. Use **Select / move** to drag a single fixture on its own.

With a room selected, drag a corner handle on the Top or Bottom plan to stretch that existing vertex, or drag a smaller mid-edge handle to insert a new corner on that edge and place it in the same drag. Official DXF object snap applies to both. Hover or click a corner handle, then press Delete or Backspace to remove that vertex. A mid-edge handle is not deletable. Invalid inserts, stretches, or deletes (fewer than 3 unique corners, a self-crossing outline, or area below 0.01 m²) are refused — inserts and stretches revert to the pre-insert or pre-drag polygon, and a refused delete leaves the room unchanged. Draw-room Backspace is unchanged: while a draft is active, one Backspace clears a locked typed length and the next drops the last draft corner. Dragging the room fill still translates the whole polygon. This increment does not fillet corners. Two rooms on the same storey can be united with **Union rooms**, the first can be cut by the second with **Subtract rooms**, the overlapping area can be kept with **Intersect rooms**, the exclusive parts can be kept with **XOR rooms**, or one room can be aligned to a reference with **Align rooms**; even spacing / distribute is not included.

Help tip key: `tool.drawRect`.

## Create rooms from DXF — closed polylines and simple line loops

When the current storey’s underlay is a parsed DXF, **Create rooms from DXF** adds official new rooms from closed LWPOLYLINE entities (group 70 bit 1, or first and last vertices coincident) and from simple closed loops of connected LINE and open LWPOLYLINE segments on that storey. A simple loop is a single closed chain in which every vertex has degree 2. T-junction, shared-wall, and nested multi-room networks are not auto-traced. Polygons are created in official world space, so they follow the current Calibrate scale (`metersPerUnit` and origin offset). New rooms use the same defaults as Draw room / Create rectangle (maintenance factor 0.80, no EN template, Building Room height). Degenerate rings and outlines that already exist on the storey are skipped; existing rooms are not modified.

Help tip key: `tool.createRoomsFromDxf`.

## Union rooms — overlapping or edge-adjacent rooms

**Union rooms** in Construction tools (beside Draw room / Create rectangle / Create rooms from DXF) merges two rooms on the current storey that overlap in area or share a boundary of positive length. With Select idle, the selected room is the first (surviving) room if one is already selected; otherwise pick two rooms in order on the Top or Bottom plan. Esc cancels the pick. Rooms on another storey are refused. The first room keeps its id, name, maintenance factor, EN template, height, and other official properties; the second is removed after a successful union. Fixtures of the removed room that still lie in the union are reassigned to the surviving room; fixtures that would fall outside stay on the storey with `roomId` cleared. Luminaires are not deleted. The command is refused, with no change, when the rooms are disjoint or only touch at a point, the union would contain a hole, or the result would not be a single simple room (fewer than 3 unique vertices, a self-crossing outline, or area below 0.01 m²). Calculation results stay in place until Calculate, as with official room translation. Alignment is not included.

Help tip key: `tool.unionRooms`.

## Subtract rooms — cut the first room by the second

**Subtract rooms** in Construction tools (beside Union rooms) cuts the first room on the current storey by a second room (the cutter). With Select idle, the selected room is the first (kept) room if one is already selected; otherwise pick two rooms in order on the Top or Bottom plan. Esc cancels the pick. Rooms on another storey are refused. The first room keeps its id, name, maintenance factor, EN template, height, and other official properties; its polygon becomes first minus second as a single simple outer ring. The cutter room is left in place and is not deleted. Fixtures assigned to the surviving room whose XY no longer lie in the cut polygon have `roomId` cleared; fixtures of the cutter room are unchanged. Luminaires are not deleted. The command is refused, with no change, when the rooms do not overlap in area (edge-touch or disjoint is not a cut), the same room is picked twice, the result would be empty, the subtract would split the first room into two or more islands, the subtract would contain a hole (including a cutter strictly inside the first room), or the result would not be a single simple room (fewer than 3 unique vertices, a self-crossing outline, or area below 0.01 m²). Calculation results stay in place until Calculate, as with official room translation and union. Alignment is not included.

Help tip key: `tool.subtractRooms`.

## Intersect rooms — keep the overlapping area

**Intersect rooms** in Construction tools (beside Subtract rooms) keeps the overlapping area of two rooms on the current storey as the first room. With Select idle, the selected room is the first (kept) room if one is already selected; otherwise pick two rooms in order on the Top or Bottom plan. Esc cancels the pick. Rooms on another storey are refused. The first room keeps its id, name, maintenance factor, EN template, height, and other official properties; its polygon becomes the intersection as a single simple outer ring. The second room is removed after a successful intersect. Fixtures of either room that still lie in the intersection are assigned to the surviving room; fixtures that fall outside stay on the storey with `roomId` cleared. Luminaires are not deleted. The command is refused, with no change, when the rooms do not overlap in area (edge-touch or disjoint is not an intersection), the same room is picked twice, the result would be empty, the intersection would split into two or more islands, the intersection would contain a hole, or the result would not be a single simple room (fewer than 3 unique vertices, a self-crossing outline, or area below 0.01 m²). Calculation results stay in place until Calculate, as with official room translation, union, and subtract. Alignment is not included.

Help tip key: `tool.intersectRooms`.

## XOR rooms — keep the exclusive parts

**XOR rooms** in Construction tools (beside Intersect rooms) keeps the exclusive parts of two rooms on the current storey as the first room (first XOR second). With Select idle, the selected room is the first (kept) room if one is already selected; otherwise pick two rooms in order on the Top or Bottom plan. Esc cancels the pick. Rooms on another storey are refused. The first room keeps its id, name, maintenance factor, EN template, height, and other official properties; its polygon becomes the symmetric difference as a single simple outer ring. The second room is removed after a successful XOR. Fixtures of either room that still lie in the XOR outline are assigned to the surviving room; fixtures that fall outside stay on the storey with `roomId` cleared. Luminaires are not deleted. The command is refused, with no change, when the rooms do not overlap in area (edge-touch or disjoint is not an XOR), the same room is picked twice, the result would be empty, the XOR would split into two or more islands (typical when both rooms have a remainder), the XOR would contain a hole (including a room strictly inside the other), or the result would not be a single simple room (fewer than 3 unique vertices, a self-crossing outline, or area below 0.01 m²). A bite that shares the first room’s outer boundary can succeed as a single ring. Calculation results stay in place until Calculate, as with official room translation, union, subtract, and intersect. Alignment is not included.

Help tip key: `tool.xorRooms`.

## Align rooms — line up to a reference

**Align rooms** in Construction tools (beside XOR rooms) translates a room on the current storey so an edge or centre of its bounding box lines up with a reference room. Choose Left, Right, Top, Bottom, H centre, or V centre first (Left is the default). With Select idle, the selected room is the reference if one is already selected and stays put; otherwise pick the reference and the room to move in order on the Top or Bottom plan. Esc cancels the pick. Rooms on another storey are refused. The moving room keeps its shape, name, maintenance factor, EN template, height, and other official properties; only its position changes. The reference room is not moved. Both rooms are kept. Fixtures assigned to the moved room follow the same translation. Luminaires are not deleted. The command is refused, with no change, when the same room is picked twice, the room is already aligned, or the move would not be a single simple room (fewer than 3 unique vertices, a self-crossing outline, or area below 0.01 m²). Calculation results stay in place until Calculate, as with official room translation. Even spacing / distribute is not included.

Help tip key: `tool.alignRooms`.



## 3D

`BuildingScene3D` extrudes the true floor polygon (not an AABB box), so L-shaped rooms match the plan.
