# Project autosave

The v2 editor (`BuildingEditor`) writes the project in the background so you do not have to click Save after every change.

## When it writes

- **800 ms** after the last change to name, scene, or results
- When the tab is hidden or the window is closing
- Immediately after **Calc room / Calc all** (results must persist)
- **Save now** flushes immediately

## Minimum traffic

The client keeps a snapshot of the last successful save (`name` + `JSON.stringify(scene)` + `JSON.stringify(results)`). The next PATCH sends **only dirty keys**.

Examples:

- Drag a room → `{ scene }` only (no results, no name)
- Rename the project → `{ name }` only
- Calculate → `{ results }` (and `scene` only if it also changed)

The PATCH response is `{ ok, updatedAt }` — it does not echo the full project (GET still returns the full document).

Camera orbit is stored in a ref and attached only when a save runs, so orbiting does not PATCH every frame.

## Code

- Diff helper: [`src/lib/project-autosave.ts`](../src/lib/project-autosave.ts)
- API: `PATCH /api/projects/:id`
