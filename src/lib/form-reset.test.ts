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
  const onUpload = src.slice(
    src.indexOf("async function onUpload"),
    src.indexOf("async function openDetail"),
  );

  it("captures the form before await and resets only after a successful upload", () => {
    expect(onUpload).toMatch(/const formEl = e\.currentTarget/);
    expect(onUpload.indexOf("const formEl")).toBeGreaterThanOrEqual(0);
    expect(onUpload.indexOf("const formEl")).toBeLessThan(onUpload.indexOf("await fetch"));
    expect(onUpload).not.toMatch(/e\.currentTarget\.reset\s*\(/);
    expect(onUpload).toContain("resetForm(formEl)");

    const failBlock = onUpload.match(/if\s*\(\s*!res\.ok\s*\)\s*\{[\s\S]*?return;\s*\}/);
    expect(failBlock).not.toBeNull();
    expect(failBlock![0]).not.toContain("resetForm");

    expect(onUpload.indexOf("resetForm(formEl)")).toBeGreaterThan(
      onUpload.indexOf("return;", onUpload.search(/if\s*\(\s*!res\.ok\s*\)/)),
    );
    expect(onUpload).toMatch(/await load\(\)/);
    expect(onUpload).toMatch(/openDetail\(/);
    expect(onUpload.indexOf("resetForm(formEl)")).toBeLessThan(onUpload.indexOf("await load()"));
    expect(onUpload.indexOf("await load()")).toBeLessThan(onUpload.indexOf("openDetail("));
  });

  it("keeps the Traditional Chinese laboratory-file disclaimer wiring", () => {
    expect(src).toContain("LIBRARY_INTRO_DISCLAIMER");
    expect(src).toContain("selectedLibraryConeDisclaimer");
  });
});
