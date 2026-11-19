import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { generateLibraryCone } from "@luxsim/photometry";
import {
  buildGenerateLdtDownload,
  triggerTextFileDownload,
  type GenerateLdtFormValues,
  type TextFileDownloadHost,
} from "./generate-ldt-download";

const root = path.resolve(__dirname, "../..");

function readSrc(...parts: string[]): string {
  return readFileSync(path.join(root, ...parts), "utf8");
}

const method4Form: GenerateLdtFormValues = {
  family: "circular",
  beamDegrees: 36,
  name: "Method4 generated cone 36deg",
  catalogNumber: "M4-CONE-36",
  lumens: "1800",
  watts: "18",
  cctK: "4000",
  cri: "80",
  size: "Dia90 x H70",
};

function expectedText(values: GenerateLdtFormValues) {
  const lumens = Number(values.lumens.trim());
  return generateLibraryCone({
    family: values.family,
    beamDegrees: values.beamDegrees,
    name: values.name.trim() || undefined,
    catalogNumber: values.catalogNumber.trim() || undefined,
    lumens,
    watts: values.watts.trim() ? Number(values.watts) : null,
    cctK: values.cctK.trim() ? Number(values.cctK) : null,
    cri: values.cri.trim() ? Number(values.cri) : null,
    size: values.size.trim() || undefined,
  });
}

describe("buildGenerateLdtDownload", () => {
  it("allows download when lumens are valid and generation succeeds, without a saved id", () => {
    const got = buildGenerateLdtDownload(method4Form);
    const expected = expectedText(method4Form);
    expect(got.canDownload).toBe(true);
    if (!got.canDownload) return;
    expect(got.filename).toBe("M4-CONE-36.ldt");
    expect(got.text).toBe(expected.text);
    expect(got.text).toBe(generateLibraryCone({
      family: "circular",
      beamDegrees: 36,
      name: "Method4 generated cone 36deg",
      catalogNumber: "M4-CONE-36",
      lumens: 1800,
      watts: 18,
      cctK: 4000,
      cri: 80,
      size: "Dia90 x H70",
    }).text);
    expect(got).not.toHaveProperty("id");
    expect(JSON.stringify(got)).not.toMatch(/\/api\/luminaires\/[^/]+\/ldt/);
  });

  it("prefers catalog number, then display name, and always keeps a .ldt suffix", () => {
    expect(buildGenerateLdtDownload(method4Form).filename).toBe("M4-CONE-36.ldt");
    const byName = buildGenerateLdtDownload({
      ...method4Form,
      catalogNumber: "   ",
      name: "Office downlight 30W",
    });
    expect(byName.canDownload).toBe(true);
    expect(byName.filename).toBe("Office downlight 30W.ldt");
    const nameless = buildGenerateLdtDownload({
      ...method4Form,
      catalogNumber: "",
      name: "   ",
    });
    expect(nameless.canDownload).toBe(true);
    expect(nameless.filename).toBe("library-cone.ldt");
    expect(nameless.filename.endsWith(".ldt")).toBe(true);
  });

  it("blocks download when lumens are missing or invalid, or generation throws", () => {
    for (const lumens of ["", "   ", "0", "-10", "abc"]) {
      const got = buildGenerateLdtDownload({ ...method4Form, lumens });
      expect(got.canDownload).toBe(false);
      expect(got.filename).toBeNull();
      expect(got.text).toBeNull();
    }
    const badBeam = buildGenerateLdtDownload({ ...method4Form, beamDegrees: 37 });
    expect(badBeam.canDownload).toBe(false);
    expect(badBeam.text).toBeNull();
  });

  it("uses the current form text after fields change, not a previously saved file", () => {
    const first = buildGenerateLdtDownload(method4Form);
    const edited = buildGenerateLdtDownload({ ...method4Form, lumens: "2000" });
    expect(first.canDownload && edited.canDownload).toBe(true);
    if (!first.canDownload || !edited.canDownload) return;
    expect(edited.text).toBe(expectedText({ ...method4Form, lumens: "2000" }).text);
    expect(edited.text).not.toBe(first.text);
  });
});

describe("triggerTextFileDownload", () => {
  it("starts a blob download and does not navigate to a saved luminaire id", async () => {
    const anchor = {
      href: "",
      download: "",
      rel: "",
      style: { display: "" },
      click: vi.fn(),
      remove: vi.fn(),
    };
    const body = { appendChild: vi.fn((node: typeof anchor) => node) };
    const host: TextFileDownloadHost = {
      createObjectURL: vi.fn(() => "blob:test-generated-ldt"),
      revokeObjectURL: vi.fn(),
      document: {
        createElement: vi.fn((tag: string) => {
          expect(tag).toBe("a");
          return anchor as unknown as HTMLAnchorElement;
        }) as Document["createElement"],
        body: body as unknown as TextFileDownloadHost["document"]["body"],
      },
    };

    await triggerTextFileDownload("LDT-TEXT", "M4-CONE-36.ldt", host);

    expect(host.createObjectURL).toHaveBeenCalledTimes(1);
    const blob = (host.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob;
    expect(blob).toBeInstanceOf(Blob);
    expect(anchor.href).toBe("blob:test-generated-ldt");
    expect(anchor.download).toBe("M4-CONE-36.ldt");
    expect(anchor.click).toHaveBeenCalledTimes(1);
    expect(body.appendChild).toHaveBeenCalledTimes(1);
    expect(anchor.remove).toHaveBeenCalledTimes(1);
    expect(host.revokeObjectURL).toHaveBeenCalledWith("blob:test-generated-ldt");
    expect(anchor.href).not.toMatch(/\/api\/luminaires\//);
  });
});

describe("Generate LDT form download wiring", () => {
  const formSrc = readSrc("src/components/GenerateLdtForm.tsx");
  const librarySrc = readSrc("src/components/LibraryClient.tsx");
  const editorSrc = readSrc("src/components/editor/BuildingEditor.tsx");

  it("enables Download from the current generated text, not a saved luminaire id", () => {
    expect(formSrc).toContain("buildGenerateLdtDownload");
    expect(formSrc).toContain("triggerTextFileDownload");
    expect(formSrc).toContain("disabled={!prepared.canDownload}");
    expect(formSrc).toContain("onClick={downloadCurrent}");
    expect(formSrc).toMatch(/triggerTextFileDownload\(prepared\.text,\s*prepared\.filename\)/);
    expect(formSrc).not.toMatch(/disabled=\{\s*!saved\s*\}/);
    expect(formSrc).not.toContain("downloadSaved");
    expect(formSrc).not.toMatch(/window\.location\.href\s*=\s*`\/api\/luminaires\/\$\{saved\.id\}\/ldt`/);
    expect(formSrc).not.toMatch(/\/api\/luminaires\/\$\{saved\.id\}\/ldt/);
    // Save still goes through the official API; download must not.
    expect(formSrc).toContain('fetch("/api/luminaires/generate"');
  });

  it("keeps the same form, including compact editor reuse, and does not auto-save on download", () => {
    expect(librarySrc).toMatch(/<GenerateLdtForm[\s\S]*?onCreated=/);
    expect(editorSrc).toMatch(/<GenerateLdtForm[\s\S]*?\bcompact\b/);
    expect(editorSrc).not.toMatch(/Download \.ldt/);
    const downloadFn = formSrc.slice(
      formSrc.indexOf("function downloadCurrent"),
      formSrc.indexOf("const preview"),
    );
    expect(downloadFn).toContain("triggerTextFileDownload");
    expect(downloadFn).not.toMatch(/fetch\s*\(/);
    expect(downloadFn).not.toMatch(/setSaved/);
    expect(downloadFn).not.toContain("/api/luminaires/generate");
    expect(formSrc).toContain("GENERATE_LDT_FORM_DISCLAIMER");
    expect(formSrc).toContain("PolarPreview");
  });
});
