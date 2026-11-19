import { readFileSync } from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  buildGldfContainer,
  detectUploadFormat,
  gldfDownloadFileName,
  isGldfFileName,
  parseGldfContainer,
  GLDF_CREATED_WITH,
  GLDF_SCHEMA_LOCATION,
} from "./gldf";

const root = path.resolve(__dirname, "../../..");
const fixtures = path.join(__dirname, "../test-fixtures/gldf");
const official001 = path.join(fixtures, "001_simple_luminaire_ldc");
const official000 = path.join(fixtures, "000_simple_luminaire");
const sampleIes = readFileSync(path.join(root, "fixtures/sample-downlight.ies"), "utf8");

async function zipFromDir(dir: string, files: Array<[string, string | Uint8Array]>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [name, data] of files) zip.file(name, data);
  return zip.generateAsync({ type: "uint8array" });
}

describe("GLDF upload detection", () => {
  it("recognises .gldf alongside IES and LDT", () => {
    expect(isGldfFileName("product.gldf")).toBe(true);
    expect(isGldfFileName("  PRODUCT.GLDF ")).toBe(true);
    expect(isGldfFileName("product.ies")).toBe(false);
    expect(detectUploadFormat("a.gldf")).toBe("gldf");
    expect(detectUploadFormat("a.IES")).toBe("ies");
    expect(detectUploadFormat("a.ldt")).toBe("ldt");
    expect(detectUploadFormat("a.txt")).toBeNull();
    expect(gldfDownloadFileName('Downlight "A".ies')).toBe("Downlight A.gldf");
    expect(gldfDownloadFileName("room.gldf")).toBe("room.gldf");
  });
});

describe("parse official GLDF templates", () => {
  it("imports the official 001 luminaire with embedded EULUMDAT", async () => {
    const productXml = readFileSync(path.join(official001, "product.xml"));
    const ldt = readFileSync(path.join(official001, "ldc/eulumdat.ldt"));
    const bytes = await zipFromDir(official001, [
      ["product.xml", productXml],
      ["ldc/eulumdat.ldt", ldt],
    ]);
    const parsed = await parseGldfContainer(bytes);
    expect(parsed.entries).toHaveLength(1);
    const entry = parsed.entries[0]!;
    expect(entry.format).toBe("ldt");
    expect(entry.photometryFileName).toBe("eulumdat.ldt");
    expect(entry.manufacturer).toBe("Manufacturer XY");
    expect(entry.displayName).toBe("Product name — Variant name");
    expect(entry.catalogNumber).toBe("LightNnumber");
    expect(entry.data.verticalAngles.length).toBeGreaterThan(1);
    expect(entry.data.horizontalAngles.length).toBeGreaterThan(0);
  });

  it("refuses an official product with no photometry file", async () => {
    const productXml = readFileSync(path.join(official000, "product.xml"));
    const bytes = await zipFromDir(official000, [["product.xml", productXml]]);
    await expect(parseGldfContainer(bytes)).rejects.toThrow(
      /no embedded IES or LDT photometry/i,
    );
  });
});

describe("build and round-trip a GLDF container", () => {
  it("writes a 1.0.0-rc.3 container that parses back to the same IES table", async () => {
    const bytes = await buildGldfContainer({
      manufacturer: "Acme Lighting",
      productName: "Sample Downlight",
      catalogNumber: "DL-1",
      format: "ies",
      photometryText: sampleIes,
      uniqueId: "11111111-1111-4111-8111-111111111111",
      createdAt: new Date("2026-11-19T08:00:00Z"),
    });
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);

    const zip = await JSZip.loadAsync(bytes);
    expect(Object.keys(zip.files).filter((name) => !name.endsWith("/")).sort()).toEqual(
      ["ldc/photometry.ies", "product.xml"],
    );
    const xml = await zip.file("product.xml")!.async("string");
    expect(xml).toContain(GLDF_SCHEMA_LOCATION);
    expect(xml).toContain(GLDF_CREATED_WITH);
    expect(xml).toContain('contentType="ldc/ies"');
    expect(xml).toContain("ldc/photometry.ies");
    expect(xml).toContain("Acme Lighting");
    expect(xml).toContain("Sample Downlight");
    expect(xml).not.toMatch(/DIALux/i);

    const parsed = await parseGldfContainer(bytes);
    expect(parsed.entries).toHaveLength(1);
    const entry = parsed.entries[0]!;
    expect(entry.format).toBe("ies");
    expect(entry.data.luminousFlux).toBe(2000);
    expect(entry.data.watts).toBe(30);
    expect(entry.data.intensities[0]?.[0]).toBe(1200);
    expect(entry.manufacturer).toBe("Acme Lighting");
    expect(entry.catalogNumber).toBe("DL-1");
  });

  it("writes LDT photometry as ldc/eulumdat and skips paperspace-unrelated empty zip data", async () => {
    const officialLdt = readFileSync(path.join(official001, "ldc/eulumdat.ldt"), "utf8");
    const bytes = await buildGldfContainer({
      productName: "Official LDT",
      format: "ldt",
      photometryText: officialLdt,
    });
    const zip = await JSZip.loadAsync(bytes);
    const xml = await zip.file("product.xml")!.async("string");
    expect(xml).toContain('contentType="ldc/eulumdat"');
    const parsed = await parseGldfContainer(bytes);
    expect(parsed.entries[0]?.format).toBe("ldt");
    expect(parsed.entries[0]?.data.verticalAngles.length).toBeGreaterThan(1);
  });

  it("rejects a non-zip file and a zip without product.xml", async () => {
    await expect(parseGldfContainer(new TextEncoder().encode("not a zip"))).rejects.toThrow(
      /not a GLDF container/i,
    );
    const empty = await zipFromDir("x", [["readme.txt", "hello"]]);
    await expect(parseGldfContainer(empty)).rejects.toThrow(/no product\.xml/i);
  });
});
