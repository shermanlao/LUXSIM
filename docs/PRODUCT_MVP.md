# LUXSIM Product v2

## Scope

DIALux-like **multi-storey** lighting design assist:

- Storeys + multiple rooms
- **BuildingEditor workspace**: left tools, centre Top / Front / Side / 3D viewport, right properties
- Plan underlays (image / PDF / DXF; DWG stored with DXF fallback message)
- Lightweight IFC storey/space import
- Project fixture library + **drag-and-drop** placement (no auto-place)
- Client-side per-room lux / interreflection / UGR
- EN 12464-1 **assist** templates, maintenance factor, Em / Uo / UGR pass-fail hints
- Full multi-page PDF report
- **DIALux verification zip** — multi-room JSON, IES/LDT, DXF, results CSV for desktop cross-check

## Milestones

See plan: Multi-storey DIALux flow (M1–M6).

## Try DIALux verification export

1. Open a project in the editor, place fixtures, run **Calc room** or **Calc all**.
2. Optional: set **EN 12464-1 assist** and **Maintenance factor** on the active room (Properties).
3. Click **DIALux verification (zip)** — unpack and follow `README.txt` / [DIALUX_INTEROP.md](./DIALUX_INTEROP.md).

## Non-claims

Design assist only — not tender-certified. No proprietary native DIALux project write.
