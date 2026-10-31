# LUXSIM vs DIALux evo — feature gap

LUXSIM is a **browser design-assist** tool. DIALux evo 14 is a **desktop, standards-oriented** lighting CAD. This document lists what LUXSIM already covers, what is thinner, and what is missing. It is not a claim that LUXSIM should clone every DIALux module.

Companion canvas: open `dialux-gap-analysis.canvas.tsx` beside chat.

## Already in LUXSIM

- Multi-storey / multi-room projects (`ProjectSceneV2`)
- Plan underlays: image / PDF / DXF; DWG stored with convert-to-DXF message
- Lightweight IFC storey / `IfcSpace` import
- Two-point scale calibration
- IES / LDT upload → project fixture list (does **not** auto-place)
- Drag-and-drop placement on Top / Bottom / Front / Side / 3D
- Client solver: direct illuminance, simplified interreflection, simplified UGR, LPD
- False-color overlay + PDF / `.luxsim` / DIALux pack zip
- CAD point-to-point room draw (typed mm polar lock) + L×W rectangle at origin; 3D extrudes the floor polygon

## Missing or thinner (by domain)

### Geometry / CAD — highest gap for indoor use

| Capability | DIALux | LUXSIM today |
|------------|--------|--------------|
| Draw room | Click corners; type length; polar lock | Click corners; type mm; close on start. See [ROOM_DRAW.md](./ROOM_DRAW.md) |
| Typed distance | Next point locked to radius circle | Bare number = mm; suffixes `m` / `cm` / `mm` |
| Ortho / snap | Ortho, polar tracking, object snap | Shift = 90° ortho. No DXF object snap |
| Edit outline | Move vertices, stretch walls | Drag whole room (select). No vertex handles |
| Room inspector | Height, workplane, materials | On `RoomV2` but **not in BuildingEditor** (v1 `ProjectEditor` has fields) |
| 3D volume | Extrude true polygon | Extruded floor polygon |
| Openings | Windows / doors | None |
| Furniture | 3D objects + textures | None |

`RoomV2.polygon` is `Vec2[]`. The solver clips the grid with `clipResultsToPolygon`. Draw room writes that polygon; L×W still uses `rectPolygon(0, 0, L, W)`.

### Plans / BIM

- DXF is display-only (no snap / convert-to-room)
- DWG not parsed natively
- IFC import is a text parser (no openings, no export)
- No Metaroom / LiDAR scan path

### Fixtures

- No manufacturer catalog
- No linear / grid / circular arrays
- No automatic placement (intentionally out of v2 scope)
- `rotationDeg` stored; v2 editor has no rotation control
- No lighting scenes / dimming

### Calculation

- One workplane per room (no extra task areas / wall grids)
- Interreflection is a box-room boost, not radiosity
- UGR observers are simplified (look toward room centre)
- No maintenance factor
- No EN 12464 (or other) target library / pass-fail
- No daylight, emergency (EN 1838), street / outdoor / sports

### Visualization & docs

- False color yes; isolines / value charts no
- No raytrace
- PDF is a fixed template; no DOCX / PPT / CSV / CD layouts
- No `.evo` write (proprietary)

## CAD room draw (implemented)

See [ROOM_DRAW.md](./ROOM_DRAW.md). Scene units stay metres; typed lengths are millimetres (`15000` = 15 m). L×W creates a rectangle at `(0, 0)`. Remaining geometry gaps: vertex edit, DXF object snap, room inspector in BuildingEditor.

## Suggested order

1. **P0 done** — Point-to-point draw + typed polar lock + ortho + close; L×W; room translate; 3D polygon extrusion.
2. **P0 leftover** — v2 room inspector; vertex edit.
3. **P1** — Snap, fixture arrays + rotation, isolines, maintenance factor, extra calc surfaces, assist-only standard targets.
4. **P2+** — Daylight, emergency, furniture, catalog, raytrace, outdoor, IFC/Office export.

## Non-claims (unchanged)

Design assist only. Not tender-certified. No proprietary `.evo` write.
