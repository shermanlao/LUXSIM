import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

function readSrc(...parts: string[]): string {
  return readFileSync(path.join(root, ...parts), "utf8");
}

describe("editor Fixture library Generate LDT dialog", () => {
  const editorSrc = readSrc("src/components/editor/BuildingEditor.tsx");
  const dialogSrc = readSrc("src/components/editor/GenerateLdtDialog.tsx");
  const formSrc = readSrc("src/components/GenerateLdtForm.tsx");
  const librarySrc = readSrc("src/components/LibraryClient.tsx");
  const css = readSrc("src/app/globals.css");

  const fixtureStart = editorSrc.indexOf('cad-section-title">Fixture library');
  const fixtureSection = editorSrc.slice(
    fixtureStart,
    editorSrc.indexOf("</aside>", fixtureStart),
  );

  it("keeps Add from org library and two buttons under it, without an always-visible parameter form", () => {
    expect(fixtureSection).toContain("Add from org library");
    expect(fixtureSection).toContain("Upload IES / LDT / GLDF");
    expect(fixtureSection).toMatch(/>\s*Generate LDT\s*</);
    expect(fixtureSection).toContain("setGenerateLdtOpen(true)");
    expect(fixtureSection).toContain("fileRef.current?.click()");
    // Resting panel must not mount the parameter form or its field labels.
    expect(fixtureSection).not.toContain("<GenerateLdtForm");
    expect(fixtureSection).not.toContain("Lumen (required)");
    expect(fixtureSection).not.toContain("Library beam");
    expect(fixtureSection).not.toContain("Generate and save into library");
    // Upload control remains available via a visually hidden file input.
    expect(fixtureSection).toMatch(/type="file"/);
    expect(fixtureSection).toMatch(/accept="\.ies,\.ldt,\.gldf"/);
  });

  it("opens Generate LDT in a modal that reuses the compact form and closes after create", () => {
    expect(editorSrc).toContain("GenerateLdtDialog");
    expect(editorSrc).toContain("generateLdtOpen");
    expect(dialogSrc).toMatch(/role="dialog"/);
    expect(dialogSrc).toContain('aria-modal="true"');
    expect(dialogSrc).toContain("generate-ldt-backdrop");
    expect(dialogSrc).toContain("Generate LDT");
    expect(dialogSrc).toContain("Cancel");
    expect(dialogSrc).toMatch(/<GenerateLdtForm[\s\S]*?\bcompact\b/);
    expect(dialogSrc).toMatch(/tone="cad"/);
    expect(dialogSrc).toContain("onClose()");
    expect(dialogSrc).toMatch(/onCreated=\{async/);
    expect(formSrc).toContain("hideHeading");
    expect(formSrc).toContain("OfficialWaitDialog");
    expect(formSrc).toContain("OFFICIAL_WAIT_COPY.generatingLdt");
  });

  it("hides upload, Generate LDT, and Add from org library in view-only", () => {
    expect(fixtureSection).toMatch(/\{!readOnly && \(/);
    // The org-library / upload / generate block is inside the same !readOnly gate.
    const gated = fixtureSection.slice(fixtureSection.indexOf("{!readOnly && ("));
    expect(gated).toContain("Add from org library");
    expect(gated).toContain("Upload IES / LDT / GLDF");
    expect(gated).toMatch(/>\s*Generate LDT\s*</);
    expect(editorSrc).toMatch(/\{!readOnly && \([\s\S]*?<GenerateLdtDialog/);
  });

  it("leaves the Luminaire library page inline Generate LDT form unchanged", () => {
    expect(librarySrc).toMatch(/<GenerateLdtForm[\s\S]*?onCreated=/);
    expect(librarySrc).not.toContain("GenerateLdtDialog");
    expect(librarySrc).not.toContain("setGenerateLdtOpen");
  });

  it("stacks the dialog above the canvas and the wait dialog above the modal", () => {
    expect(css).toMatch(/\.generate-ldt-backdrop\s*\{[^}]*z-index:\s*200/s);
    expect(css).toMatch(/\.official-wait-backdrop\s*\{[^}]*z-index:\s*210/s);
    expect(dialogSrc).not.toMatch(/DIALux|evo/i);
    expect(fixtureSection).not.toMatch(/DIALux|evo/i);
  });
});
