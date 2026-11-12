# Editor workflow

The project editor (`BuildingEditor` / `ProjectEditor`) and app chrome (`AppShell`) use the **full browser width** — no `max-w-7xl` cap — so the 3D viewport and side panels expand with the window.

**Autosave** writes name / scene / results **5 minutes** after the last persistable edit (configurable per account: Off / 1 / 5 / 15 minutes — click your email in the header). It also flushes on tab hide, after a successful calc, and when you click **Save**. Selecting a room or switching view / tool does not start a save. Only fields that actually changed are PATCHed. See [AUTOSAVE.md](./AUTOSAVE.md). View tab and last 3D orbit (`ui.camera3d`) are included when a real save runs. **Undo** is Ctrl+Z (Ctrl+X also undoes in the plan/3D view; Cut still works in text fields); redo is Ctrl+Y or Ctrl+Shift+Z.

2D drag/drop uses `getScreenCTM()` (`svg-coords.ts`) so fixture picks stay under the cursor when the viewport is wider than the SVG viewBox (letterboxing).

1. **New project** — empty GF storey, no rooms.
2. **Import plan** (optional) — PNG/JPG/PDF/DXF/IFC. Raster plans keep the file’s native aspect ratio and show on **Top**, **Bottom**, and **3D**. **Top** matches the 3D floor plan (look-down); **Bottom** is the look-up plan view.
3. **Calibrate** — tool → set real distance → click two points (uniform scale; does not distort the plan).
4. **Draw rooms** — Draw room on Top or Bottom: left-click corners, type mm to lock the next length (polar circle), click the start point to close. For a quick rectangle, enter L×W (mm) and create at `(0, 0)`. Rooms can be selected but not dragged; move fixtures with Select / move. See [ROOM_DRAW.md](./ROOM_DRAW.md).
5. **Upload IES/LDT** — appears in fixture list only.
6. **Drag** fixture onto a room (Top / Front / Side / 3D).
7. **Calculate** active room or all rooms (client-side).
8. **Export** full PDF report, `.luxsim`, or DIALux pack.
