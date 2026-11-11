# DIALux `.evo` export — feasibility (evo 12.1)

## Is a “real” `.evo` possible?

**Yes as a hand-off archive**, not as a full DIALux project writer.

`.evo` is a proprietary **zip bundle** of DIALux-native blobs (`ProjectData.dat` ISO-10303-21 + schema, `ProjectData.xml`, binary `ScenegraphScene`, interaction/output stubs, etc.). LUXSIM is **not** blocked by an obvious cryptographic seal on the container: `ArchiveInfo/ArchiveInfo.xml` `<Hash>089142cd0fb</Hash>` does **not** match MD5/SHA1/SHA256 of `ProjectData.dat`, the full zip, or other members in Sherman’s known-good Save As (likely a build stamp).

Load failures so far were **integrity / packaging** issues, not “wrong file extension”:

| Issue | Symptom | Mitigation in exporter |
|--------|---------|----------------------|
| STEP contour vertex ≠ ref tuple count | evo refuses load | Sync ref lists; skip contour edits when counts differ |
| Missing `Project/Textures/` | 23 vs 24 members | Clone reference zip layout |
| JSZip container (cv=20, no NTFS extra, wrong order, Thumbnail deflated) | Payloads match but archive unlike Save As | `evo-assemble.py` clones local headers + deflate streams verbatim |
| **Local header `elen=36` gaps** (R3) | zipfile opens; DIALux sequential walk fails | Locals packed tight with **`elen=0`**; NTFS extra **CD-only** (see below) |
| `ProjectData.dat` geometry vs unchanged `ScenegraphScene` / `ProjectData.xml` | Cross-blob inconsistency | Default **`geometry: off`** — patch names, 2.8 m height, 0.75 m workplane only |

## Hard limits (today)

- **Arbitrary LUXSIM polygons** in `.evo` require updating `ScenegraphScene`, wall/face topology in STEP, and `ProjectData.xml` object graph together. We have a rooms-only reference template, not a reverse-engineered DIALux writer.
- **Luminaire + IES inside `.evo`** — not implemented (reference was rooms-only).
- **Certified tender output** — not claimed.

## Current export strategy (PR #3)

1. Clone `fixtures/dialux-evo-12.1-reference.evo.zip` (Sherman’s opening Save As).
2. Override only `ArchiveInfo/ArchiveInfo.xml` and `Project/ProjectData/ProjectData.dat` (metadata patch).
3. Room outlines stay **reference L9M** until geometry pipeline exists; LUXSIM room names and calc heights still flow into STEP where safe.

We **cannot** run DIALux in CI. Tests assert:

- Sequential local walk from offset 0 (no gaps; last local end == EOCD cd offset; every local `elen=0`)
- Zero-override clone **byte-identical** to Sherman Save As
- Member order, unchanged `ScenegraphScene` bytes, contour integrity, STEP size band (~204 KB)

**R3 layout bug (2026-11-11):** `evo-assemble.py` sized local copies using `len(ZipInfo.extra)` (36-byte NTFS block from the **central directory**) as if it were local `elen`, truncating each copied record and leaving 36-byte leftover `PK\\x03\\x04` headers between entries. `zipfile` still opened the archive via CD offsets; DIALux’s sequential parser did not.
