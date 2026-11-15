# LUXSIM vs DIALux evo — feature gap

LUXSIM is a **browser design-assist** tool. DIALux evo 14 is a **desktop, standards-oriented** lighting CAD. This document lists what LUXSIM already covers, what is thinner, and what is missing. It is not a claim that LUXSIM should clone every DIALux module or that LUXSIM is “DIALux on the web”.

## Already in LUXSIM

- Multi-storey / multi-room projects (`ProjectSceneV2`)
- **Rect / line fixture arrays** — `arrange-array` + shared `writeFixtureInstances` batch path
- **Auto arrange by target Ēm (F1.2)** — `arrange-by-em` estimator + same array preview/apply path; utilance η default 0.6 (adjustable); not a substitute for client Calc
- **CSV schedule import (F3.1)** — Light **Import schedule**: metre coordinates + code map → preview → `writeFixtureInstances`; unmapped accepted rows block commit
- **Fixture code map** — schedule codes (e.g. DL-01) → project luminaire via exact/alias rules on `scene.fixtureCodeMap` (no fuzzy match)
- **Dark CAD workspace** on project routes: workflow ribbon, 3-pane layout, bottom results strip (Ēm / Uo / UGR / MF / LPD)
- **Workflow ribbon** (Construction / Light / Calculation / Documentation) with panel filters
- Plan underlays: image / PDF (server raster → PNG for Top/3D) / DXF; DWG stored with convert-to-DXF message
- Lightweight IFC storey / `IfcSpace` import
- Two-point scale calibration
- IES / LDT upload → project fixture list (does **not** auto-place)
- Drag-and-drop placement on Top / Bottom / Front / Side / 3D
- Client solver: direct illuminance, simplified interreflection, simplified UGR, LPD
- False-color overlay + PDF / `.luxsim` / **DIALux verification zip** (multi-room geometry + DXF + results CSV)
- CAD point-to-point room draw (typed mm polar lock) + L×W rectangle at origin; 3D extrudes the floor polygon
- **Select-tool room / storey translation** on the Top / Bottom plan (fixtures in the moved rooms follow; shape unchanged; Shift constrains to X or Y)
- **EN 12464-1 assist** — task / surrounding / background targets; **CIE 97 MF breakdown**; pass-fail hints (not certification)
- **CIE 171 skeleton** — analytical direct self-tests in `packages/solver/src/cie171/`
- **AB golden room** — [`docs/ab-golden-room/`](./ab-golden-room/) for Dialux evo manual compare
- **Workflow mode bar** (Construction / Light / Calculation / Documentation) with panel filters
- Fixture **rotation** control + Top view heading arrow

## Missing or thinner (by domain)

### Geometry / CAD — highest gap for indoor use

| Capability | DIALux | LUXSIM today |
|------------|--------|--------------|
| Draw room | Click corners; type length; polar lock | Click corners; type mm; close on start. See [ROOM_DRAW.md](./ROOM_DRAW.md) |
| Typed distance | Next point locked to radius circle | Bare number = mm; suffixes `m` / `cm` / `mm` |
| Ortho / snap | Ortho, polar tracking, object snap | Shift = 90° ortho. Official DXF underlays snap to endpoints, midpoints, and the nearest point on a segment (8 CSS px at the current zoom). No intersection, grid, or raster snap. Closed DXF polylines and simple closed loops of connected lines can be created as rooms on the current storey; T-junction / shared-wall networks are not auto-traced |
| Edit outline | Move vertices, stretch walls | Select-tool drag translates a selected room, or every room on a storey when the storey is selected in Building. With a room selected, corner vertex handles stretch one existing vertex, mid-edge handles insert a new vertex that can be placed in the same drag, and Delete or Backspace removes a hovered or click-selected corner vertex (DXF object snap applies to stretch/insert; degenerate or self-crossing results are refused). **Union rooms** merges two overlapping or edge-adjacent rooms on the current storey into the first room. **Subtract rooms** cuts the first room by a second room on the same storey (the cutter stays in place; the result must be a single simple ring). **Intersect rooms** keeps the overlapping area as the first room and removes the second (area overlap required; the result must be a single simple ring). **XOR rooms** keeps the exclusive parts as the first room and removes the second (area overlap required; a bite that shares the outer boundary can succeed as a single simple ring; two remainders or a hole are refused). Fillet, alignment, and full DIALux-style vertex modelling are not available |
| Room inspector | Height, workplane, materials | **BuildingEditor** properties panel (height, workplane, ρ, grid, MF, EN template) |
| 3D volume | Extrude true polygon | Extruded floor polygon |
| Openings | Windows / doors | None |
| Furniture | 3D objects + textures | None |

`RoomV2.polygon` is `Vec2[]`. The solver clips the grid with `clipResultsToPolygon`. Draw room writes that polygon; L×W still uses `rectPolygon(0, 0, L, W)`.

### Plans / BIM

- **PDF RCP**: uploaded PDF kept as asset; selected page rasterized to PNG (`pageRasterAssetId`, `rasterDpi`, pixel size on underlay) for Top/3D — not `<img src=pdf>`
- **RCP OCR (F2.2)**: Light mode **Detect from plan** — local tesseract proposals (`rcpProposals` on scene); no cloud by default
- **RCP confirm (F2.3)**: human review table (code map column, accept/reject, edit code → `codeNorm`); autosaved proposals only
- **RCP commit (F2.4)**: **Commit accepted** places mapped proposals as fixtures (`rcpProposalId` on instance); optional replace prior detect-sourced fixtures on storey; room results cleared; optional calc after commit
- **Post-place calc (F2.6)**: RCP commit, array apply, drag-drop, and **Calc room/all** use shared **`post-place-calc`** → `runClientCalcForRooms` / `packages/solver`; bottom results strip + EN/MF assist; photometry gaps surfaced by luminaire name
- Official DXF object snap on Top/Bottom picks (endpoint, midpoint, nearest-on-segment, 8 CSS px). **Create rooms from DXF** builds rooms from closed polylines and from simple closed loops of connected LINE / open LWPOLYLINE segments on the current storey; T-junction / shared-wall networks are not auto-traced. DWG is still unparsed
- DWG not parsed natively
- IFC import is a text parser (no openings, no export)
- No Metaroom / LiDAR scan path

### Fixtures

- No manufacturer catalog
- **Rectangular / line / circular / polygon / target-Ēm arrays** in Light mode (Arrange · array panel; preview on Top view). Polygon mode places Count fixtures equally along the selected room outline, starting at the first corner, or along an optional custom path picked on the plan (open or closed); rotation is fixture orientation. Alignment is not yet available. Target-Ēm estimate remains a rectangular grid only.
- **Fixture code map** (Light → Code map): RCP/schedule codes → luminaire; CSV import; gates block unmapped/ambiguous on accepted OCR rows (F2.3); F2.4 commit writes instances
- No automatic placement (intentionally out of v2 scope)
- `rotationDeg` stored; **BuildingEditor** rotation control + Top view arrow; included in DIALux schedule.csv
- No lighting scenes / dimming

### Calculation

- Automatic vertical calculation surfaces on every room wall (inward normals, same grid/inset as the workplane). One workplane per room; no extra task areas, ceiling grids, or user-drawn surfaces yet
- Interreflection is a box-room boost, not radiosity
- UGR observers are simplified (look toward room centre)
- Maintenance factor + EN 12464 assist targets (pass-fail hints only)
- No daylight, emergency (EN 1838), street / outdoor / sports

### Visualization & docs

- False colour, isolines, and value labels on the official Top/Bottom plan (after Calculate) and in the official Full PDF isolux diagram; official 3D can also show isolines and value labels on the workplane from the same model, beside greyscale / false-colour. No custom isoline presets. Not a raytraced visualisation.
- No raytrace
- PDF is a fixed template; no DOCX / PPT / CD layouts
- No proprietary native DIALux project write

## CAD room draw (implemented)

See [ROOM_DRAW.md](./ROOM_DRAW.md). Scene units stay metres; typed lengths are millimetres (`15000` = 15 m). L×W creates a rectangle at `(0, 0)`. Remaining geometry gaps: fillet and alignment (corner handles can already stretch an existing room, mid-edge handles can insert a new vertex, Delete or Backspace can remove a corner vertex, Union rooms can merge two overlapping or edge-adjacent rooms on the current storey, Subtract rooms can cut the first room by a second room, leaving the cutter in place, when the result is a single simple ring, Intersect rooms can keep the overlapping area as the first room and remove the second, when the result is a single simple ring, and XOR rooms can keep the exclusive parts as the first room and remove the second, when the result is a single simple ring). T-junction / shared-wall LINE-network tracing into rooms is not yet implemented (closed DXF polylines and simple closed line loops can already be created as rooms).

## Suggested order

1. **P0 done** — Point-to-point draw + typed polar lock + ortho + close; L×W; room translate; 3D polygon extrusion; workspace chrome; room inspector; DIALux verification pack.
2. **P0 leftover** — fillet, alignment, and fuller vertex modelling (corner-handle stretch, mid-edge insert, delete-vertex, union of two overlapping or edge-adjacent rooms, subtract of one room from another on the same storey, intersect of two overlapping rooms on the same storey, and XOR of two overlapping rooms on the same storey are done).
3. **P1** — Snap, fixture arrays + rotation, extra calc surfaces, richer standard libraries. (Official DXF object snap on endpoint / midpoint / nearest, wall calculation surfaces, rectangular/line/circular/polygon arrays, and official isolines / value labels: done. Intersection / grid snap and auto-tracing T-junction / shared-wall LINE networks into rooms are not yet implemented. Creating rooms from closed DXF polylines and simple closed line loops is done.)
4. **P2+** — Daylight, emergency, furniture, catalog, raytrace, outdoor, IFC/Office export.

## Non-claims (unchanged)

Design assist only. Not tender-certified. No proprietary native DIALux project write.
