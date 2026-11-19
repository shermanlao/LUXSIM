import { describe, expect, it } from "vitest";
import { WORKSPACE_NAME_MAX_LENGTH, parseWorkspaceName } from "./workspace-name";

describe("parseWorkspaceName", () => {
  it("trims leading and trailing whitespace", () => {
    expect(parseWorkspaceName("  Acme Studio  ")).toEqual({ ok: true, name: "Acme Studio" });
  });

  it("rejects a missing or non-string value without inventing a name", () => {
    expect(parseWorkspaceName(undefined)).toEqual({ ok: false, error: "Workspace name is required" });
    expect(parseWorkspaceName(null)).toEqual({ ok: false, error: "Workspace name is required" });
    expect(parseWorkspaceName(12)).toEqual({ ok: false, error: "Workspace name is required" });
    expect(parseWorkspaceName({ name: "Acme" })).toEqual({
      ok: false,
      error: "Workspace name is required",
    });
  });

  it("rejects an empty or whitespace-only name without inventing a fallback", () => {
    expect(parseWorkspaceName("")).toEqual({ ok: false, error: "Workspace name cannot be empty" });
    expect(parseWorkspaceName("   ")).toEqual({ ok: false, error: "Workspace name cannot be empty" });
    expect(parseWorkspaceName("\n\t")).toEqual({ ok: false, error: "Workspace name cannot be empty" });
  });

  it("rejects a name longer than the documented limit", () => {
    const tooLong = "A".repeat(WORKSPACE_NAME_MAX_LENGTH + 1);
    expect(tooLong.length).toBe(101);
    expect(parseWorkspaceName(tooLong)).toEqual({
      ok: false,
      error: "Workspace name cannot be longer than 100 characters",
    });
  });

  it("accepts a name at the documented limit after trim", () => {
    const exact = "B".repeat(WORKSPACE_NAME_MAX_LENGTH);
    expect(parseWorkspaceName(exact)).toEqual({ ok: true, name: exact });
    expect(parseWorkspaceName(`  ${exact}  `)).toEqual({ ok: true, name: exact });
  });
});
