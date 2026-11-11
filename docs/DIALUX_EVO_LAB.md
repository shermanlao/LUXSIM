# DIALux `.evo` load bisection (lab archives)

Generated on the agent VM with `python3 scripts/evo-lab-variants.py`. Output: `/opt/cursor/artifacts/evo-lab/` + `manifest.json`. Layout validator must be `[]` before any DIALux trial.

## R4 vs official — what actually changed

**Only 11 lines** in `ProjectData.dat` (1496 total):

| Lines | Change |
|-------|--------|
| 3 | `FILE_DESCRIPTION` (STEP header) — new LUXSIM text; `#151 ProjectInfoPropertySet` description **unchanged** |
| 4 | `FILE_NAME` — new filename + **ISO** timestamp `2026-11-11T…Z` vs official `11/11/2026 07:41:51` |
| 1014, 1039, 1064, 1089, 1114, 1139, 1164, 1189, 1212 | `StoreyRepresentationData` height `2.7999999999999998` → `2.8` |

**Not changed in R4:** room `CommonInformationPropertySet` names (already matched L9M script), workplane (`0.75` already in template), geometry/contours.

**ArchiveInfo.xml:** new `UniqueName` (random UUID), `Description`, ISO `CreateTime`/`ModifiedTime`. **Title / Version / Branch / Hash unchanged.**

## Identity cross-reference (verified)

`<ArchiveInfo><UniqueName>` appears **only** in:

- `ArchiveInfo/ArchiveInfo.xml`
- `Project/ProjectData/ProjectData.dat` entity `#151 = ProjectInfoPropertySet` (3rd string field)

It does **not** appear in `ProjectData.xml` or `Project/ScenegraphScene`.

**R4 bug:** exporter assigns a **new** `UniqueName` in XML but leaves `#151` on the official uuid `fd46b22e-fd3f-4e27-bfa8-c8c38efd9c3a`. Strongest load-failure candidate.

Secondary suspects: `FILE_NAME` time format; STEP header description vs `#151` description vs `ArchiveInfo` description (three-way mismatch without updating `#151`).

## Lab variants

| File | What it tests |
|------|----------------|
| `00-byte-clone.evo` | **Control** — byte-identical to official Save As (SHA-256 match). Should behave like official. |
| `01-archive-description-only.evo` | `Description` in XML only |
| `02-archive-new-uniquename-only.evo` | New `UniqueName` in XML only — **reproduces R4 uuid desync** without touching `.dat` |
| `03-dat-file-description-only.evo` | STEP `FILE_DESCRIPTION` only — header vs `#151` mismatch |
| `04-dat-storey-heights-only.evo` | Nine `2.799…→2.8` lines only |
| `05-r4-style-both-desync.evo` | Combined R4-like XML + `.dat` with **uuid still desynced** |
| `06-uniquename-synced.evo` | New uuid in **both** XML and `#151` — tests sync hypothesis |
| `07-uniquename-synced-plus-r4-dat.evo` | Synced uuid + R4 STEP header/storey patches |

**Suggested bisection order for Sherman (only after he agrees to try lab files):** `00` → `02` → `06` → `05`.

## Import fallbacks (product, not `.evo`)

Sherman can use DIALux-native imports without a public `.evo` writer spec:

- **DXF** plan underlay (LUXSIM already exports DXF-related workflow via plan upload).
- **IFC** (evo **PRO** on his install) — LUXSIM has lightweight IFC text import.
- **STF** — DIALux supports import but **no public STF file spec**; LUXSIM does not generate compatible STF room layouts.
