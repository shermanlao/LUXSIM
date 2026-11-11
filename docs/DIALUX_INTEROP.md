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
| DIALux `.evo` | **Export .evo** builds a DIALux evo **12.1**-shaped zip (same layout as a native save): `ArchiveInfo/`, `Project/ProjectData/ProjectData.dat` (ISO-10303-21 + DIALux schema), `ScenegraphScene`, interaction/output stubs |

## `.evo` limits (honest)

- Based on `fixtures/dialux-evo-12.1-reference/` (Sherman’s AED-180297 L9M rooms-only reference). Scenegraph and interaction payloads are copied from that template; **geometry and names** are patched from the LUXSIM v2 scene (`ProjectData.dat`).
- Up to **9 room zones** per export (one DIALux building/storey/room chain per zone — matching the reference multi-room pattern).
- **Contour patching** only applies when the LUXSIM room polygon has the **same vertex count** as that template slot (e.g. simple 4-corner rooms on 4-vertex slots). Otherwise the reference outline is kept so STEP `StoreyContourRepresentationData` vertex lists stay aligned with their `#1238` / `#1233` reference tuples (required for DIALux evo 12.1 to open the file).
- Archive must include the empty **`Project/Textures/`** directory entry (like a native Save As).
- **Luminaire instances and IES inside `.evo`** are not written yet (reference was rooms-only); use PDF/luxsim or place fixtures in DIALux after import.
- Not tender-certified; open in DIALux evo 12.1+ and verify before issue.

### Load failure fix (2026-11-11)

Early exports could not open in DIALux because contour coordinates were replaced with shorter rectangles **without** resizing the paired STEP vertex-reference lists, and the zip omitted `Project/Textures/`. Both break evo 12.1 load validation even when other members match the reference archive.

## Report reference

`fixtures/reference-dialux-report.pdf` — structural checklist for LUXSIM full PDF (not pixel clone).
