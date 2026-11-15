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

With a room selected, drag a corner handle on the Top or Bottom plan to stretch that existing vertex, or drag a smaller mid-edge handle to insert a new corner on that edge and place it in the same drag. Official DXF object snap applies to both. Hover or click a corner handle, then press Delete or Backspace to remove that vertex. A mid-edge handle is not deletable. Invalid inserts, stretches, or deletes (fewer than 3 unique corners, a self-crossing outline, or area below 0.01 m²) are refused — inserts and stretches revert to the pre-insert or pre-drag polygon, and a refused delete leaves the room unchanged. Draw-room Backspace is unchanged: while a draft is active, one Backspace clears a locked typed length and the next drops the last draft corner. Dragging the room fill still translates the whole polygon. This increment does not fillet corners. Two rooms on the same storey can be united with **Union rooms**; subtract, intersect, and alignment are not included.

Help tip key: `tool.drawRect`.

## Create rooms from DXF — closed polylines and simple line loops

When the current storey’s underlay is a parsed DXF, **Create rooms from DXF** adds official new rooms from closed LWPOLYLINE entities (group 70 bit 1, or first and last vertices coincident) and from simple closed loops of connected LINE and open LWPOLYLINE segments on that storey. A simple loop is a single closed chain in which every vertex has degree 2. T-junction, shared-wall, and nested multi-room networks are not auto-traced. Polygons are created in official world space, so they follow the current Calibrate scale (`metersPerUnit` and origin offset). New rooms use the same defaults as Draw room / Create rectangle (maintenance factor 0.80, no EN template, Building Room height). Degenerate rings and outlines that already exist on the storey are skipped; existing rooms are not modified.

Help tip key: `tool.createRoomsFromDxf`.

## Union rooms — overlapping or edge-adjacent rooms

**Union rooms** in Construction tools (beside Draw room / Create rectangle / Create rooms from DXF) merges two rooms on the current storey that overlap in area or share a boundary of positive length. With Select idle, the selected room is the first (surviving) room if one is already selected; otherwise pick two rooms in order on the Top or Bottom plan. Esc cancels the pick. Rooms on another storey are refused. The first room keeps its id, name, maintenance factor, EN template, height, and other official properties; the second is removed after a successful union. Fixtures of the removed room that still lie in the union are reassigned to the surviving room; fixtures that would fall outside stay on the storey with `roomId` cleared. Luminaires are not deleted. The command is refused, with no change, when the rooms are disjoint or only touch at a point, the union would contain a hole, or the result would not be a single simple room (fewer than 3 unique vertices, a self-crossing outline, or area below 0.01 m²). Calculation results stay in place until Calculate, as with official room translation. Subtract, intersect, XOR, and alignment are not included.

Help tip key: `tool.unionRooms`.

## 3D

`BuildingScene3D` extrudes the true floor polygon (not an AABB box), so L-shaped rooms match the plan.
