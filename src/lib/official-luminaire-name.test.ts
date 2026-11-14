import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { officialLuminaireDisplayName } from "./official-luminaire-name";

const root = path.resolve(__dirname, "../..");

function readSrc(...parts: string[]): string {
  return readFileSync(path.join(root, ...parts), "utf8");
}

describe("officialLuminaireDisplayName", () => {
  it("prefers the photometry description over the file stem when no display name was typed", () => {
    expect(
      officialLuminaireDisplayName({
        userName: "",
        description: "Sample axial downlight 30W",
        catalogNumber: "CAT-1",
        fileName: "sample-downlight.ies",
      }),
    ).toBe("Sample axial downlight 30W");
    expect(
      officialLuminaireDisplayName({
        userName: "   ",
        description: "Sample axial downlight 30W",
        catalogNumber: null,
        fileName: "sample-downlight.ies",
      }),
    ).toBe("Sample axial downlight 30W");
    expect(
      officialLuminaireDisplayName({
        description: "Sample axial downlight 30W",
        fileName: "sample-downlight.ies",
      }),
    ).toBe("Sample axial downlight 30W");
  });

  it("uses a typed display name when the user actually provided one", () => {
    expect(
      officialLuminaireDisplayName({
        userName: "  Method4 retest reupload  ",
        description: "Sample axial downlight 30W",
        catalogNumber: "M4-CONE-36",
        fileName: "M4-CONE-36.ldt",
      }),
    ).toBe("Method4 retest reupload");
  });

  it("falls through to catalog number, then the original file name, never a stripped stem", () => {
    expect(
      officialLuminaireDisplayName({
        userName: null,
        description: "",
        catalogNumber: "M4-CONE-36",
        fileName: "M4-CONE-36.ldt",
      }),
    ).toBe("M4-CONE-36");
    expect(
      officialLuminaireDisplayName({
        userName: null,
        description: null,
        catalogNumber: null,
        fileName: "sample-downlight.ies",
      }),
    ).toBe("sample-downlight.ies");
    expect(
      officialLuminaireDisplayName({
        description: "",
        catalogNumber: "",
        fileName: "sample-downlight.ies",
      }),
    ).not.toBe("sample-downlight");
  });
});

describe("official luminaire name wiring", () => {
  const apiSrc = readSrc("src/app/api/luminaires/route.ts");
  const editorSrc = readSrc("src/components/editor/BuildingEditor.tsx");
  const uploadFn = editorSrc.slice(
    editorSrc.indexOf("async function onUploadPhotometry"),
    editorSrc.indexOf("function addFromLibrary"),
  );

  it("resolves POST /api/luminaires names with the official helper", () => {
    expect(apiSrc).toContain("officialLuminaireDisplayName");
    expect(apiSrc).toMatch(/officialLuminaireDisplayName\s*\(/);
    expect(apiSrc).toMatch(/userName:[\s\S]*form\.get\(\s*["']name["']\s*\)/);
    expect(apiSrc).toMatch(/description:\s*data\.description/);
    expect(apiSrc).toMatch(/catalogNumber:\s*data\.catalogNumber/);
    expect(apiSrc).toMatch(/fileName:\s*file\.name/);
    expect(apiSrc).not.toMatch(/file\.name\.replace\s*\(/);
  });

  it("does not send a filename stem as name from the project Light panel", () => {
    expect(uploadFn).toMatch(/form\.append\(\s*["']file["']/);
    expect(uploadFn).not.toMatch(/form\.append\(\s*["']name["']/);
    expect(uploadFn).not.toMatch(/file\.name\.replace\s*\(\s*\/\\\.\(ies\|ldt\)\$\/i/);
    expect(uploadFn).toContain(
      "Imported “${lum.name}” to project fixture list (not placed)",
    );
    expect(uploadFn).not.toMatch(/instances/);
  });
});
