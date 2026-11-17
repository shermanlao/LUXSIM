import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { resetForm } from "./form-reset";

const root = path.resolve(__dirname, "../..");

function readSrc(...parts: string[]): string {
  return readFileSync(path.join(root, ...parts), "utf8");
}

describe("resetForm", () => {
  it("calls reset when the form element is present", () => {
    const form = { reset: vi.fn() } as unknown as HTMLFormElement;
    resetForm(form);
    expect(form.reset).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the form is missing after a re-render", () => {
    expect(() => resetForm(null)).not.toThrow();
    expect(() => resetForm(undefined)).not.toThrow();
  });
});

describe("LibraryClient upload refresh", () => {
  const src = readSrc("src/components/LibraryClient.tsx");

  it("reloads the list and opens the last successful luminaire after import", () => {
    expect(src).not.toContain("resetForm");
    expect(src).toContain("uploadPhotometryBatch");
    const confirm = src.slice(
      src.indexOf("async function confirmPending"),
      src.indexOf("className=\"mx-auto max-w-7xl"),
    );
    expect(confirm).toContain("await load()");
    expect(confirm).toContain("openDetail(outcome.lastSuccessId)");
    expect(confirm.indexOf("await load()")).toBeLessThan(confirm.indexOf("openDetail(outcome.lastSuccessId)"));
    expect(confirm.indexOf("uploadPhotometryBatch")).toBeLessThan(confirm.indexOf("await load()"));
  });

  it("keeps the Traditional Chinese laboratory-file disclaimer wiring", () => {
    expect(src).toContain("LIBRARY_INTRO_DISCLAIMER");
    expect(src).toContain("selectedLibraryConeDisclaimer");
  });
});
