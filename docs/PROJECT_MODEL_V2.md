# Project model v2

LUXSIM projects use `ProjectSceneV2` (`version: 2`) stored in `Project.sceneJson`.

## Hierarchy

- **Storeys** — elevation + default height
- **Rooms** — polygon on a storey (metres), reflectance, calc settings (`maintenanceFactor`, optional `en12464TemplateId`). Drawn CAD-style or via L×W; see [ROOM_DRAW.md](./ROOM_DRAW.md).
- **Underlays** — image / PDF / DXF / IFC reference on a storey. PDF pages are rasterized to a derived PNG asset (`pageRasterAssetId`, `rasterDpi`, pixel dimensions). Image underlays store `sourceWidthPx` / `sourceHeightPx` and a uniform `metersPerUnit` (meters per pixel) so the plan keeps the import file’s aspect ratio; calibration scales both axes equally. Shown on Top / Bottom / 3D (3D texture faces up).
- **fixtureLibraryIds** — org luminaires linked into the project (upload does **not** place instances)
- **instances** — placed fixtures with `roomId` / `storeyId`
- **fixtureCodeMap** (optional) — RCP/schedule code → `luminaireId` rules; see `src/lib/fixture-code-map.ts`
- **rcpProposals** (optional) — pending OCR code detections from plan raster (F2.2)
- **ui** — editor chrome: `activeStoreyId`, `activeRoomId`, `viewMode`, `tool`, `workflowMode` (`construction` | `light` | `calculation` | `export`), optional `camera3d`. Saved with the project.

## Results

`resultsJson` shape:

```json
{ "version": 2, "byRoomId": { "<roomId>": { /* CalcResults */ } } }
```

## Migration

v1 single-room scenes are upgraded by `migrateSceneV1toV2` / `normalizeScene` on load.

## Assets

Large files live in `ProjectAsset` + object storage (`storage/`).
