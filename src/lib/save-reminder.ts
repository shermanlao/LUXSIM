/** Official save-reminder copy and interval arithmetic. Reuses User.autosaveMs as the interval. */

export const SAVE_REMINDER_TITLE_EN = "Save your project?";
export const SAVE_REMINDER_TITLE_ZH = "要儲存專案嗎？";
export const SAVE_REMINDER_BODY_EN =
  "You have unsaved changes. Save the file now so your work is not lost.";
export const SAVE_REMINDER_BODY_ZH = "專案尚有未儲存的變更。請儲存檔案，以免遺失工作。";
export const SAVE_REMINDER_SAVE_LABEL = "Save";
export const SAVE_REMINDER_LATER_LABEL = "Later";

/** Start the interval at the first unsaved persistable edit; keep it across later keystrokes. */
export function startSaveReminderEpoch(
  dirty: boolean,
  currentEpochMs: number | null,
  nowMs: number
): number | null {
  if (!dirty) return null;
  return currentEpochMs ?? nowMs;
}

export function saveReminderDue(input: {
  dirty: boolean;
  intervalMs: number;
  epochMs: number | null;
  nowMs: number;
}): { due: boolean; remainingMs: number } {
  if (!input.dirty || input.intervalMs <= 0 || input.epochMs == null) {
    return { due: false, remainingMs: input.intervalMs > 0 ? input.intervalMs : 0 };
  }
  const remainingMs = Math.max(0, input.intervalMs - (input.nowMs - input.epochMs));
  return { due: remainingMs <= 0, remainingMs };
}
