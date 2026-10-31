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

Help tip key: `tool.drawRoom`.

## Rectangle L×W — simple simulation

**Room height** is a standalone field (mm) under Building. It sets the selected room’s ceiling and is used for the next CAD outline or rectangle. It is not part of the L×W form.

In the tools panel, enter **Length** and **Width** (mm, or `m` / `cm` suffix) and **Create rectangle**. The room is placed at the storey origin `(0, 0)` using the current Room height. Use **Select / move** and drag the room to relocate it (fixtures in that room move with it).

Help tip key: `tool.drawRect`.

## 3D

`BuildingScene3D` extrudes the true floor polygon (not an AABB box), so L-shaped rooms match the plan.
