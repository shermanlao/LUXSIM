import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { photometricColorQualityFields } from "./photometric-preview-fields";

const root = path.resolve(__dirname, "../..");

function readSrc(...parts: string[]): string {
  return readFileSync(path.join(root, ...parts), "utf8");
}

describe("photometricColorQualityFields", () => {
  it("includes CCT and CRI when both are present", () => {
    expect(photometricColorQualityFields({ cctK: 4000, cri: 80 })).toEqual([
      { label: "CCT", value: "4000 K" },
      { label: "CRI", value: "80" },
    ]);
  });

  it("keeps integers as integers and gives non-integers one decimal", () => {
    expect(photometricColorQualityFields({ cctK: 4000.5, cri: 82.3 })).toEqual([
      { label: "CCT", value: "4000.5 K" },
      { label: "CRI", value: "82.3" },
    ]);
  });

  it("includes only the fields that exist", () => {
    expect(photometricColorQualityFields({ cctK: 3000, cri: null })).toEqual([
      { label: "CCT", value: "3000 K" },
    ]);
    expect(photometricColorQualityFields({ cctK: undefined, cri: 90 })).toEqual([
      { label: "CRI", value: "90" },
    ]);
  });

  it("omits both when they are absent, as with the sample IES, and never shows 0 or a blank", () => {
    const missingCases = [
      photometricColorQualityFields({ cctK: null, cri: null }),
      photometricColorQualityFields({ cctK: undefined, cri: undefined }),
      photometricColorQualityFields({}),
      photometricColorQualityFields({ cctK: Number.NaN, cri: Number.POSITIVE_INFINITY }),
    ];
    for (const fields of missingCases) {
      expect(fields).toEqual([]);
      expect(fields.map((field) => field.value).join(" ")).not.toMatch(/\b0\b/);
      expect(fields.some((field) => field.value.trim() === "")).toBe(false);
    }
  });
});

describe("polar preview CCT / CRI wiring", () => {
  const librarySrc = readSrc("src/components/LibraryClient.tsx");
  const editorSrc = readSrc("src/components/editor/BuildingEditor.tsx");
  const componentSrc = readSrc("src/components/PhotometricColorQuality.tsx");

  it("uses the shared helper in the library detail and project fixture-list previews", () => {
    expect(librarySrc).toContain("photometricColorQualityFields");
    expect(librarySrc).toMatch(
      /photometricColorQualityFields\(\s*selected\.photometric\s*\)/,
    );
    expect(editorSrc).toContain("PhotometricColorQuality");
    expect(editorSrc).toMatch(/<PhotometricColorQuality[\s\S]*photo=\{photoCache\[lum\.id\]!\}/);
    expect(componentSrc).toContain("photometricColorQualityFields");
    expect(componentSrc).toMatch(/if\s*\(\s*fields\.length\s*===\s*0\s*\)\s*return\s*null/);
  });
});
