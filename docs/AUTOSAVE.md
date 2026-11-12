# Project autosave

The v2 editor (`BuildingEditor`) writes the project in the background so you do not have to click Save after every change.

## When it writes

- **5 minutes** of idle after the last persistable change (name, rooms, fixtures, results, and other document data) — this is the default
- When the tab is hidden or the window is closing
- Immediately after **Calc room / Calc all** (results must persist)
- **Save** / **Save now** flushes immediately

The interval is per user, under **Account settings** (click your email in the header): **Off**, **1 minute**, **5 minutes** (default), or **15 minutes**. Off still flushes on Save, tab hide, and after a successful calculation. Existing accounts, including `draftman@luxsim.local`, default to 5 minutes.

## What does not start a save

Selecting a room, switching view mode or tool, and orbiting the 3D camera do **not** start an autosave by themselves. Camera / view / selection are still stored on the scene when a real save runs.

Empty diffs (nothing persistable changed) do not PATCH and do not flash “Saving…”.

## Minimum traffic

The client keeps a snapshot of the last successful save (`name` + persistable scene + `JSON.stringify(results)`). The next PATCH sends **only dirty keys**.

Examples:

- Move a fixture → `{ scene }` only (no results, no name)
- Rename the project → `{ name }` only
- Calculate → `{ results }` (and `scene` only if it also changed)

The PATCH response is `{ ok, updatedAt }` — it does not echo the full project (GET still returns the full document).

Rooms cannot be dragged; only fixtures move with the pointer.

## Code

- Diff helper: [`src/lib/project-autosave.ts`](../src/lib/project-autosave.ts)
- Account interval: `GET` / `PATCH /api/account` (`autosaveMs` on the session **User**)
- API: `PATCH /api/projects/:id`
