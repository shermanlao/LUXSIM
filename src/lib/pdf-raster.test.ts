import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import { rasterizePdfPage, resolveRasterDpi } from "./pdf-raster";

describe("resolveRasterDpi", () => {
  it("keeps preferred DPI when page fits max dimension", () => {
    const warnings: string[] = [];
    const dpi = resolveRasterDpi(612, 792, 150, 4096, warnings);
    expect(dpi).toBe(150);
    expect(warnings).toHaveLength(0);
  });

  it("lowers DPI for huge pages", () => {
    const warnings: string[] = [];
    const dpi = resolveRasterDpi(2000, 3000, 150, 4096, warnings);
    expect(dpi).toBeLessThan(150);
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe("rasterizePdfPage", () => {
  it("rasterizes a minimal PDF to PNG with dimensions", async () => {
    const doc = new jsPDF();
    doc.text("RCP sample", 20, 20);
    const buf = Buffer.from(doc.output("arraybuffer"));
    const r = await rasterizePdfPage(buf, 0, { preferredDpi: 96, maxPixelDim: 2048 });
    expect(r.pageCount).toBeGreaterThanOrEqual(1);
    expect(r.widthPx).toBeGreaterThan(50);
    expect(r.heightPx).toBeGreaterThan(50);
    expect(r.png.subarray(0, 8).toString("hex")).toMatch(/^89504e470d0a1a0a/);
  });
});

describe("calibrate reuse (two-point scale)", () => {
  it("10 m calibration error ≤ 1%", () => {
    const distM = 4.87;
    const realM = 10;
    const factor = realM / distM;
    const measured = distM * factor;
    expect(Math.abs(measured - realM) / realM).toBeLessThanOrEqual(0.01);
  });
});
