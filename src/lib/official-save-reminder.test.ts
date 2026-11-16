import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_AUTOSAVE_MS } from "./account-settings";
import {
  SAVE_REMINDER_BODY_EN,
  SAVE_REMINDER_BODY_ZH,
  SAVE_REMINDER_LATER_LABEL,
  SAVE_REMINDER_SAVE_LABEL,
  SAVE_REMINDER_TITLE_EN,
  SAVE_REMINDER_TITLE_ZH,
  saveReminderDue,
  startSaveReminderEpoch,
} from "./save-reminder";

const root = path.resolve(__dirname, "../..");
function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("save reminder timing", () => {
  it("does not start an epoch or come due when there are no unsaved changes", () => {
    expect(startSaveReminderEpoch(false, 1000, 2000)).toBeNull();
    expect(
      saveReminderDue({ dirty: false, intervalMs: 900_000, epochMs: 1000, nowMs: 2_000_000 })
    ).toEqual({ due: false, remainingMs: 900_000 });
  });

  it("starts the interval at the first unsaved edit and does not restart on later keystrokes", () => {
    expect(startSaveReminderEpoch(true, null, 10_000)).toBe(10_000);
    expect(startSaveReminderEpoch(true, 10_000, 11_000)).toBe(10_000);
    const mid = saveReminderDue({
      dirty: true,
      intervalMs: 900_000,
      epochMs: 10_000,
      nowMs: 10_000 + 60_000,
    });
    expect(mid.due).toBe(false);
    expect(mid.remainingMs).toBe(840_000);
  });

  it("comes due after a full interval, and Later starts a new full interval", () => {
    expect(
      saveReminderDue({
        dirty: true,
        intervalMs: 900_000,
        epochMs: 1_000,
        nowMs: 1_000 + 900_000,
      }).due
    ).toBe(true);
    const laterEpoch = 1_000 + 900_000;
    const afterLater = saveReminderDue({
      dirty: true,
      intervalMs: 900_000,
      epochMs: laterEpoch,
      nowMs: laterEpoch + 1_000,
    });
    expect(afterLater.due).toBe(false);
    expect(afterLater.remainingMs).toBe(899_000);
  });

  it("does not come due when the reminder is Off", () => {
    expect(
      saveReminderDue({ dirty: true, intervalMs: 0, epochMs: 1, nowMs: 1_000_000 })
    ).toEqual({ due: false, remainingMs: 0 });
  });
});

describe("official save reminder copy and wiring", () => {
  const editor = read("src/components/editor/BuildingEditor.tsx");
  const dialog = read("src/components/editor/SaveReminderDialog.tsx");
  const nav = read("src/components/NavAuth.tsx");
  const admin = read("src/components/admin/SettingsAdminClient.tsx");
  const api = read("src/app/api/admin/settings/route.ts");
  const account = read("src/lib/account-settings.ts");
  const guide = read("docs/USER_GUIDE.md");

  it("defaults to 15 minutes and uses official bilingual reminder copy", () => {
    expect(DEFAULT_AUTOSAVE_MS).toBe(900_000);
    expect(SAVE_REMINDER_TITLE_EN).toBe("Save your project?");
    expect(SAVE_REMINDER_TITLE_ZH).toBe("要儲存專案嗎？");
    expect(SAVE_REMINDER_BODY_EN).toMatch(/You have unsaved changes/);
    expect(SAVE_REMINDER_BODY_ZH).toMatch(/未儲存的變更/);
    expect(SAVE_REMINDER_SAVE_LABEL).toBe("Save");
    expect(SAVE_REMINDER_LATER_LABEL).toBe("Later");
    expect(dialog).toContain('role="dialog"');
    expect(dialog).toContain("onClick={onLater}");
    expect(dialog).toContain('event.key !== "Escape"');
    expect(dialog).not.toMatch(/DIALux/i);
    expect(account).toContain('error: "Invalid save reminder interval"');
    expect(api).toContain('error: "Invalid save reminder interval"');
  });

  it("replaces silent autosave with a dismissible reminder and relabels account settings", () => {
    expect(editor).toContain("SaveReminderDialog");
    expect(editor).toContain("saveFromReminder");
    expect(editor).toContain("deferSaveReminder");
    expect(editor).not.toMatch(/visibilitychange/);
    expect(editor).not.toMatch(/beforeunload/);
    expect(editor).not.toMatch(/Autosave after idle/);
    expect(editor).not.toMatch(/document\.visibilityState === "hidden"/);
    expect(nav).toContain("Save reminder");
    expect(nav).not.toContain("Autosave duration");
    expect(nav).toMatch(/No reminder/);
    expect(admin).toContain("Default save reminder for new users");
    expect(admin).not.toContain("Default autosave for new users");
    expect(guide).toMatch(/儲存提醒 \/ Save reminder/);
    expect(guide).toMatch(/does not silently autosave/);
    expect(guide).toMatch(/不會在背景自動儲存/);
    expect(guide).toMatch(/default 15 minutes/);
    expect(guide).toMatch(/預設 15 分鐘/);
    expect(guide).toMatch(/\*\*Later\*\*/);
    expect(guide).toMatch(/another full interval/);
    expect(guide).not.toMatch(/DIALux/);
  });
});
