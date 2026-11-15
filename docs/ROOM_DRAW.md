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

Help tip key: `tool.drawRect`.

## Create rooms from DXF — closed polylines and simple line loops

When the current storey’s underlay is a parsed DXF, **Create rooms from DXF** adds official new rooms from closed LWPOLYLINE entities (group 70 bit 1, or first and last vertices coincident) and from simple closed loops of connected LINE and open LWPOLYLINE segments on that storey. A simple loop is a single closed chain in which every vertex has degree 2. T-junction, shared-wall, and nested multi-room networks are not auto-traced. Polygons are created in official world space, so they follow the current Calibrate scale (`metersPerUnit` and origin offset). New rooms use the same defaults as Draw room / Create rectangle (maintenance factor 0.80, no EN template, Building Room height). Degenerate rings and outlines that already exist on the storey are skipped; existing rooms are not modified.

Help tip key: `tool.createRoomsFromDxf`.

## 3D

`BuildingScene3D` extrudes the true floor polygon (not an AABB box), so L-shaped rooms match the plan.
