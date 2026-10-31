# DIALux interoperability

## Imports

| Format | Support |
|--------|---------|
| IES / LDT | Photometry → project fixture list |
| Image / PDF | Plan underlay + scale calibration (image aspect = source pixels; `metersPerUnit` is meters/pixel) |
| DXF | Line/polyline underlay |
| DWG | Stored; convert to DXF externally in this build |
| IFC | Storeys + spaces (text parser); draw/edit rooms after |

## Exports

| Format | Support |
|--------|---------|
| Full PDF report | Cover, summary, per-room, product polar sheets, schedule |
| `.luxsim.json` | Native project |
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
