# Editor workflow

The project editor is **`BuildingEditor`** (`ProjectSceneV2`). Legacy v1 `ProjectEditor` lives under `src/components/editor/_legacy/` for reference only.

On project routes, the editor uses a **dark CAD shell** (`cad-editor`): full-bleed layout (footer hidden), top file bar + **workflow ribbon** (Construction → Light → Calculation → Documentation), left building tree + tools, centre viewport with view tabs, right properties/library/export by mode, and a bottom **results strip** (Ēm, maintained Ēm, Uo, UGR, LPD, EN assist).

`BuildingEditor` and app chrome use the **full browser width** — no `max-w-7xl` cap — so the 3D viewport and side panels expand with the window.

**Autosave** writes name / scene / results about 800 ms after you stop changing them, and on tab hide. Only fields that actually changed are PATCHed. **Save now** flushes immediately. See [AUTOSAVE.md](./AUTOSAVE.md). View tab and last 3D orbit (`ui.camera3d`) are included when a save runs.

2D drag/drop uses `getScreenCTM()` (`svg-coords.ts`) so fixture picks stay under the cursor when the viewport is wider than the SVG viewBox (letterboxing).

1. **New project** — empty GF storey, no rooms.
2. **Import plan** (optional) — PNG/JPG/PDF/DXF/IFC. **PDF** is rasterized server-side (pdf.js) to a PNG underlay for Top/Bottom/3D; multi-page PDFs have a **page picker** in Construction. Raster plans keep aspect ratio. **Calibrate** (two-point + real length in m) sets `metersPerUnit` — unchanged from image plans.
3. **Calibrate** — tool → set real distance → click two points (uniform scale; does not distort the plan).
4. **Draw rooms** — Draw room on Top or Bottom: left-click corners, type mm to lock the next length (polar circle), click the start point to close. For a quick rectangle, enter L×W (mm) and create at `(0, 0)`, then drag with Select / move. See [ROOM_DRAW.md](./ROOM_DRAW.md).
5. **Upload IES/LDT** — appears in fixture list only.
6. **Drag** fixture onto a room (Top / Front / Side / 3D), or use **Light → Arrange · array / 排列**: rectangular / line grid, or **By target Ēm / 目標照度** (F1.2 — lumen method estimate `n ≈ ceil((Ēm×A)/(Φ×η×MF))`, square-ish grid, spacing from room bounds − wall offset; Preview ghosts on Top; Apply via `writeFixtureInstances`; status reminds **Estimate only — run Calc**). Optional **Calc after place / 放置後計算** uses F2.6 post-place calc.
7. **Code map** (Light mode): define schedule codes → luminaire rules on the project scene (`fixtureCodeMap` JSON, autosaved). Optional CSV `code,luminaireId`. Test lookup shows mapped / ambiguous / unmapped — pipelines must not guess.
7b. **Import schedule / 匯入 schedule** (F3.1): CSV `code,x,y[,z,rotationDeg]` in **metres** on active storey → preview table (map status, accept/reject) → **Commit schedule** writes only **accepted + mapped + inside room** rows via `writeFixtureInstances` (optional F2.6 calc). Accepted but unmapped/ambiguous **blocks** commit; points outside rooms skipped with count. No OCR.
8. **Detect from plan / 從圖則偵測** (Light): local OCR → confirm table → **Commit accepted** writes fixtures (F2.4). Optional **Calc after commit / 提交後計算** and **Arrange · Calc after place** share **`runPostPlaceCalcForRooms`** (same client solver as **Calc room/all**): updates `ResultsV2` for the bottom **Ēm / Uo / UGR / LPD / EN assist** strip and false-colour views; missing IES/LDT lists luminaire names; calc errors do not remove placed instances (F2.6).
9. **Calculate** active room or all rooms (client-side). Optional **Calc after place** when applying an array (or enable before drag-drop).
10. **Documentation** mode — full PDF report, `.luxsim`, or DIALux verification zip.

**Persistence:** fixture code map rules live in **`ProjectSceneV2.fixtureCodeMap`** (project `sceneJson`), not a separate DB table — they travel with `.luxsim` export and autosave. Each rule has an `id` used as the table row key; load fills one in when an older row omitted it.
