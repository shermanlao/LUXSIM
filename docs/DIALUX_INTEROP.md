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
| Full PDF report | Cover, summary (incl. 3D storey overview), per-room plan + 3D + false-color when calculated, product sheets, schedule |
| `.luxsim.json` | Native project |
| DIALux pack zip | v2: `rooms.json` (polygons) + `project.json` + schedule + IES/LDT; v1: `room.json` rectangle |

## `.evo`

Not supported (proprietary). Use DIALux pack bridge.

## Report reference

`fixtures/reference-dialux-report.pdf` — structural checklist for LUXSIM full PDF (not pixel clone).
