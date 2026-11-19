# Project save reminder

The v2 editor (`BuildingEditor`) does **not** write the project in the background. You save with the toolbar **Save** button, or with **Save** on the save-reminder dialog.

## When you are reminded

- After the configured interval of unsaved persistable changes (name, rooms, fixtures, results, and other document data). The official default is **15 minutes**.
- The timer starts at the first unsaved persistable edit after a successful save. Later keystrokes do not restart it.
- If there are no unsaved changes, the dialog is not shown.
- **Later**, Esc, or clicking the backdrop dismisses the dialog without writing. If the project is still dirty, you are reminded again after another full interval.
- **Save** on the dialog runs the same official save as the toolbar, then dismisses the dialog and resets the timer.

The interval is per user, under **Account settings** (click your email in the header): **Off**, **1 minute**, **5 minutes**, or **15 minutes** (default). Off means no reminder; you can still click **Save**. Existing accounts keep the interval already stored on the user (`autosaveMs`); only the official default for new users is 15 minutes. Site administrators set **Default save reminder for new users** on `/admin/settings`.

The editor does **not** PATCH on a timer, when the tab is hidden, when the window is closing, or after a successful calculation. Those writes used to be automatic autosave.

## What does not start a reminder

Selecting a room, switching view mode or tool, and orbiting the 3D camera do **not** count as persistable edits. Camera / view / selection are still stored on the scene when a real save runs.

Empty diffs (nothing persistable changed) do not PATCH and do not flash “Saving…”.

## Minimum traffic

The client keeps a snapshot of the last successful save (`name` + persistable scene + `JSON.stringify(results)`). The next PATCH sends **only dirty keys**.

Examples:

- Move a fixture → `{ scene }` only (no results, no name)
- Rename the project → `{ name }` only
- Calculate → `{ results }` (and `scene` only if it also changed), written when you click **Save**

The PATCH response is `{ ok, updatedAt }` — it does not echo the full project (GET still returns the full document).

Dragging a room with Select writes `{ scene }` only when you save, like moving a fixture: the room polygon and that room's fixtures move together. Dragging a whole storey (storey selected in Building, then a room fill dragged) likewise writes `{ scene }` only: every room on that storey and the fixtures that belong to those rooms move together. Calculation results are left in place until the user recalculates.

## Code

- Diff helper: [`src/lib/project-autosave.ts`](../src/lib/project-autosave.ts)
- Reminder interval: `GET` / `PATCH /api/account` (`autosaveMs` on the session **User**, meaning the reminder interval)
- API: `PATCH /api/projects/:id`
