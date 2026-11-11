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
| Full PDF report | Cover, project summary, luminaire list, room list, calculation objects, per-room summary (properties + results + working plane / false-color), product polar sheets, coordinate schedule |
| `.luxsim.json` | Native project |
| DIALux pack zip | IES/LDT + schedule + room.json |

## `.evo`

Not supported (proprietary). Use DIALux pack bridge.

## Report reference

`fixtures/reference-dialux-report.pdf` — structural checklist for LUXSIM full PDF (not pixel clone).
