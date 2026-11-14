import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  GENERATE_LDT_FORM_DISCLAIMER,
  LIBRARY_INTRO_DISCLAIMER,
  SELECTED_LIBRARY_CONE_DISCLAIMER,
  selectedLibraryConeDisclaimer,
} from "./library-cone-disclaimer";

const root = path.resolve(__dirname, "../..");

function readSrc(...parts: string[]): string {
  return readFileSync(path.join(root, ...parts), "utf8");
}

const formSrc = readSrc("src/components/GenerateLdtForm.tsx");
const librarySrc = readSrc("src/components/LibraryClient.tsx");
const editorSrc = readSrc("src/components/editor/BuildingEditor.tsx");
const stampSrc = readSrc("packages/photometry/src/stamp-ldt.ts");
const synthesizeSrc = readSrc("packages/photometry/src/synthesize-cone.ts");

const ENGLISH_FORM = "This is not a laboratory file";
const ENGLISH_FORM_LEAD =
  "Build a calculated library cone when you do not have a measured IES or LDT";
const ENGLISH_INTRO = "when you do not have a laboratory file";
const ENGLISH_SELECTED = "calculated photometry, not a measured laboratory file";
const CHINESE_FORM = "這不是實驗室檔";
const CHINESE_SELECTED = "不是實測實驗室檔";
const CHINESE_LAB_FILE = "實驗室檔";

describe("library-cone bilingual laboratory-file disclaimer", () => {
  it("keeps the official English sentences and adds Traditional Chinese beside them", () => {
    expect(GENERATE_LDT_FORM_DISCLAIMER).toContain(ENGLISH_FORM_LEAD);
    expect(GENERATE_LDT_FORM_DISCLAIMER).toContain(ENGLISH_FORM);
    expect(GENERATE_LDT_FORM_DISCLAIMER).toContain(CHINESE_FORM);
    expect(GENERATE_LDT_FORM_DISCLAIMER).toMatch(/ \/ /);

    expect(LIBRARY_INTRO_DISCLAIMER).toContain(
      "Import a measured IES / LDT, or generate a calculated library cone",
    );
    expect(LIBRARY_INTRO_DISCLAIMER).toContain(ENGLISH_INTRO);
    expect(LIBRARY_INTRO_DISCLAIMER).toContain(CHINESE_LAB_FILE);
    expect(LIBRARY_INTRO_DISCLAIMER).toMatch(/ \/ /);

    expect(SELECTED_LIBRARY_CONE_DISCLAIMER).toContain(ENGLISH_SELECTED);
    expect(SELECTED_LIBRARY_CONE_DISCLAIMER).toContain(CHINESE_SELECTED);
    expect(SELECTED_LIBRARY_CONE_DISCLAIMER).toMatch(/ \/ /);

    expect(
      selectedLibraryConeDisclaimer("Library cone · 36°"),
    ).toBe(
      "Library cone · 36° — calculated photometry, not a measured laboratory file. / 計算配光，不是實測實驗室檔。",
    );
  });

  it("shows the bilingual disclaimer on the Generate LDT form, including compact editor reuse", () => {
    expect(formSrc).toContain("GENERATE_LDT_FORM_DISCLAIMER");
    expect(formSrc).toMatch(
      /<p className=\{`text-\[var\(--muted\)\] \$\{compact \? "text-\[10px\]" : "text-sm"\}`\}>\s*\{GENERATE_LDT_FORM_DISCLAIMER\}\s*<\/p>/,
    );
    // Compact typography still uses the same copy; there is no English-only branch.
    expect(formSrc).not.toMatch(/compact\s*\?\s*["'`][^"'`]*laboratory file/);
    expect(editorSrc).toMatch(/<GenerateLdtForm[\s\S]*?\bcompact\b/);
    expect(editorSrc).not.toMatch(/This is not a laboratory file/);
  });

  it("shows the bilingual disclaimer on the library intro and selected-cone line", () => {
    expect(librarySrc).toContain("LIBRARY_INTRO_DISCLAIMER");
    expect(librarySrc).toContain("selectedLibraryConeDisclaimer");
    expect(librarySrc).toMatch(/\{LIBRARY_INTRO_DISCLAIMER\}/);
    expect(librarySrc).toMatch(
      /selectedLibraryConeDisclaimer\(libraryConeLabel\(selected\)/,
    );
    expect(librarySrc).not.toMatch(
      /calculated photometry, not a measured laboratory file\.`/,
    );
    expect(librarySrc).not.toMatch(
      /when you do not have a laboratory file\.\s*$/m,
    );
  });

  it("does not start a language pack, and leaves LDT file-header labels in English", () => {
    for (const src of [formSrc, librarySrc, editorSrc]) {
      expect(src).not.toMatch(/next-intl|useTranslation|i18n\.|language pack/i);
    }
    expect(stampSrc).toContain("LUXSIM library cone");
    expect(synthesizeSrc).toContain("LUXSIM calculated library cone");
    expect(stampSrc).not.toMatch(/實驗室/);
    expect(synthesizeSrc).not.toMatch(/實驗室/);
  });
});
