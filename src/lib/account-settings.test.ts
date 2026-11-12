import { describe, expect, it } from "vitest";
import {
  AUTOSAVE_INTERVALS,
  DEFAULT_AUTOSAVE_MS,
  accountPatchForSessionUser,
  parseAutosaveMs,
} from "./account-settings";

describe("autosave intervals", () => {
  it("defaults to 5 minutes", () => {
    expect(DEFAULT_AUTOSAVE_MS).toBe(5 * 60_000);
    expect(AUTOSAVE_INTERVALS.some((o) => o.ms === DEFAULT_AUTOSAVE_MS)).toBe(true);
  });

  it("accepts only Off / 1 / 5 / 15 minutes", () => {
    expect(parseAutosaveMs(0)).toBe(0);
    expect(parseAutosaveMs(60_000)).toBe(60_000);
    expect(parseAutosaveMs(300_000)).toBe(300_000);
    expect(parseAutosaveMs(900_000)).toBe(900_000);
    expect(parseAutosaveMs(800)).toBeNull();
    expect(parseAutosaveMs(60)).toBeNull();
    expect(parseAutosaveMs(-1)).toBeNull();
    expect(parseAutosaveMs("300000")).toBe(300_000);
    expect(parseAutosaveMs(undefined)).toBeNull();
  });
});

describe("accountPatchForSessionUser", () => {
  it("rejects a missing session", () => {
    expect(accountPatchForSessionUser(undefined, { autosaveMs: 0 })).toEqual({
      ok: false,
      status: 401,
      error: "Unauthorized",
    });
  });

  it("updates only the session user and ignores a body userId", () => {
    const out = accountPatchForSessionUser("user_session", {
      autosaveMs: 0,
      userId: "user_other",
      id: "user_other",
    });
    expect(out).toEqual({
      ok: true,
      where: { id: "user_session" },
      data: { autosaveMs: 0 },
    });
    if (out.ok) {
      expect(out.where.id).not.toBe("user_other");
    }
  });

  it("rejects an invalid interval", () => {
    expect(accountPatchForSessionUser("user_session", { autosaveMs: 800 })).toEqual({
      ok: false,
      status: 400,
      error: "Invalid autosave interval",
    });
  });
});
