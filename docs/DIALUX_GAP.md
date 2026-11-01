# LUXSIM vs DIALux evo — feature gap

LUXSIM is a **browser design-assist** tool. DIALux evo 14 is a **desktop, standards-oriented** lighting CAD. This document lists what LUXSIM already covers, what is thinner, and what is missing. It is not a claim that LUXSIM should clone every DIALux module or that LUXSIM is “DIALux on the web”.

## Already in LUXSIM

- Multi-storey / multi-room projects (`ProjectSceneV2`)
- **Rect / line fixture arrays** — `arrange-array` + shared `writeFixtureInstances` batch path
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
| Ortho / snap | Ortho, polar tracking, object snap | Shift = 90° ortho. No DXF object snap |
| Edit outline | Move vertices, stretch walls | Drag whole room (select). No vertex handles |
| Room inspector | Height, workplane, materials | **BuildingEditor** properties panel (height, workplane, ρ, grid, MF, EN template) |
| 3D volume | Extrude true polygon | Extruded floor polygon |
| Openings | Windows / doors | None |
| Furniture | 3D objects + textures | None |

`RoomV2.polygon` is `Vec2[]`. The solver clips the grid with `clipResultsToPolygon`. Draw room writes that polygon; L×W still uses `rectPolygon(0, 0, L, W)`.

### Plans / BIM

- **PDF RCP**: uploaded PDF kept as asset; selected page rasterized to PNG (`pageRasterAssetId`, `rasterDpi`, pixel size on underlay) for Top/3D — not `<img src=pdf>`
- **RCP OCR (F2.2)**: Light mode **Detect from plan** — local tesseract proposals (`rcpProposals` on scene); no cloud by default
- DXF is display-only (no snap / convert-to-room)
- DWG not parsed natively
- IFC import is a text parser (no openings, no export)
- No Metaroom / LiDAR scan path

### Fixtures

- No manufacturer catalog
- **Rectangular / line arrays** in Light mode (Arrange · array panel; preview on Top view). Circular / polygonal arrays not yet.
- **Fixture code map** (Light → Code map): RCP/schedule codes → luminaire; CSV import; gates block unmapped/ambiguous (PDF/OCR import not yet)
- No automatic placement (intentionally out of v2 scope)
- `rotationDeg` stored; **BuildingEditor** rotation control + Top view arrow; included in DIALux schedule.csv
- No lighting scenes / dimming

### Calculation

- One workplane per room (no extra task areas / wall grids)
- Interreflection is a box-room boost, not radiosity
- UGR observers are simplified (look toward room centre)
- Maintenance factor + EN 12464 assist targets (pass-fail hints only)
- No daylight, emergency (EN 1838), street / outdoor / sports

### Visualization & docs

- False color yes; isolines / value charts no
- No raytrace
- PDF is a fixed template; no DOCX / PPT / CD layouts
- No proprietary native DIALux project write

## CAD room draw (implemented)

See [ROOM_DRAW.md](./ROOM_DRAW.md). Scene units stay metres; typed lengths are millimetres (`15000` = 15 m). L×W creates a rectangle at `(0, 0)`. Remaining geometry gaps: vertex edit, DXF object snap.

## Suggested order

1. **P0 done** — Point-to-point draw + typed polar lock + ortho + close; L×W; room translate; 3D polygon extrusion; workspace chrome; room inspector; DIALux verification pack.
2. **P0 leftover** — vertex edit.
3. **P1** — Snap, fixture arrays + rotation, isolines, extra calc surfaces, richer standard libraries.
4. **P2+** — Daylight, emergency, furniture, catalog, raytrace, outdoor, IFC/Office export.

## Non-claims (unchanged)

Design assist only. Not tender-certified. No proprietary native DIALux project write.
