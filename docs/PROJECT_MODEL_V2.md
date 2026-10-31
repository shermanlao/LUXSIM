# Project model v2

LUXSIM projects use `ProjectSceneV2` (`version: 2`) stored in `Project.sceneJson`.

## Hierarchy

- **Storeys** — elevation + default height
- **Rooms** — polygon on a storey (metres), reflectance, calc settings. Drawn CAD-style or via L×W; see [ROOM_DRAW.md](./ROOM_DRAW.md).
- **Underlays** — image / PDF / DXF / IFC reference on a storey. Image underlays store `sourceWidthPx` / `sourceHeightPx` and a uniform `metersPerUnit` (meters per pixel) so the plan keeps the import file’s aspect ratio; calibration scales both axes equally. Shown on Top / Bottom / 3D (3D texture faces up).
- **fixtureLibraryIds** — org luminaires linked into the project (upload does **not** place instances)
- **instances** — placed fixtures with `roomId` / `storeyId`
- **ui** — editor chrome: `activeStoreyId`, `activeRoomId`, `viewMode` (`top` | `bottom` | `front` | `side` | `persp3d`), `tool`, and optional `camera3d` (`position` / `target` orbit pose for 3D). Saved with the project so the active 2D/3D tab and last 3D camera restore on open. **Top** matches the 3D floor plan; **Bottom** is the look-up plan view.

## Results

`resultsJson` shape:

```json
{ "version": 2, "byRoomId": { "<roomId>": { /* CalcResults */ } } }
```

## Migration

v1 single-room scenes are upgraded by `migrateSceneV1toV2` / `normalizeScene` on load.

## Assets

Large files live in `ProjectAsset` + object storage (`storage/`).
