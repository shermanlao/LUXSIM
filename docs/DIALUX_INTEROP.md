# DIALux interoperability

## Imports

| Format | Support |
|--------|---------|
| IES / LDT | Photometry → project fixture list |
| Image / PDF | Plan underlay + scale calibration (image aspect = source pixels; `metersPerUnit` is meters/pixel) |
| DXF | Line/polyline underlay |
| DWG | Stored; convert to DXF externally in this build |
| IFC | Storeys + spaces (text parser); draw/edit rooms after |
| `.lux` (also `.luxsim`, `.luxsim.json`) | Open on the projects list; creates a new workspace project from a valid official export (scene, results, photometry / source files when present, plus optional Generate LDT `origin` / `libraryFamily` / `libraryBeamDeg`). Invalid files are rejected. Older files without those library fields still import and are not given invented cone metadata. Underlay / CAD binaries are not in this format. Website / report footer fields are ignored. |

## Exports

| Format | Support |
|--------|---------|
| Full PDF report | Cover, project summary, luminaire list, room list, calculation objects, per-room summary (properties + results + working plane / false-color), product polar sheets, coordinate schedule |
| `.lux` | Official native project filename (same JSON format as older `.luxsim` / `.luxsim.json`; optional `luminaireLibrary` map preserves Generate LDT cone origin / family / beam when present in the source library) |
| DIALux verification zip | Multi-room `rooms.json`, `schedule.csv`, `luminaires/` (IES/LDT), `geometry.dxf` (walls + fixtures + grid points), `results-summary.csv`, optional `results-grid.csv` |

### DIALux verification zip (one click)

In **BuildingEditor** → Properties → **DIALux verification (zip)** after you calculate at least one room (optional but recommended for CSV comparison).

Pack contents:

1. **rooms.json** — all storeys/rooms with floor polygons, heights, reflectances, workplane.
2. **schedule.csv** — world-metre fixture positions with room/storey ids.
3. **luminaires/** — IES/LDT text for fixtures used in the project.
4. **geometry.dxf** — room outlines, fixture markers, non-zero calc grid points (layers `LUXSIM_*`).
5. **results-summary.csv** — per-room Eave/Uo/UGR plus EN 12464-1 **assist** pass/fail when a template is set.
6. **results-grid.csv** — grid point lux (when results exist).

Workflow: recreate rooms in **desktop DIALux**, import photometry, place from schedule, compare to LUXSIM CSV/DXF. LUXSIM does not write proprietary native project files.

## Native DIALux project files

Not supported (proprietary). Use the verification zip bridge above.

## Report reference

`fixtures/reference-dialux-report.pdf` — structural checklist for LUXSIM full PDF (not pixel clone).
