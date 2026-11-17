import { describe, expect, it } from "vitest";
import { buildFullReportPdf, officialProductSheetColumns, REPORT_FONT, reportPdfPlainText } from "./index";
import type { ProjectSceneV2, ResultsV2 } from "./types";

function pdfText(doc: ReturnType<typeof buildFullReportPdf>): string {
  return reportPdfPlainText(doc);
}

const scene: ProjectSceneV2 = {
  version: 2,
  storeys: [{ id: "s1", name: "Storey 1", elevationM: 0, heightM: 2.8 }],
  rooms: [
    {
      id: "r1",
      storeyId: "s1",
      name: "Office",
      polygon: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 0, y: 4 },
      ],
      heightM: 2.8,
      workplaneHeightM: 0.75,
      reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
      calc: { gridSpacing: 0.5, interreflection: false, bounces: 0, computeUgr: false },
    },
  ],
  underlays: [],
  fixtureLibraryIds: ["lum1"],
  instances: [
    {
      instanceId: "i1",
      luminaireId: "lum1",
      storeyId: "s1",
      roomId: "r1",
      name: "L1 1",
      position: { x: 1.2, y: 2.3, z: 2.45 },
      rotationDeg: 0,
    },
  ],
  ui: { activeStoreyId: "s1", activeRoomId: "r1", viewMode: "top", tool: "select" },
};

const results: ResultsV2 = { version: 2, byRoomId: {} };

describe("official report layout", () => {
  it("keeps the plan symbol to the right of the product table", () => {
    const cols = officialProductSheetColumns(170);
    expect(cols.tableX + cols.tableW).toBeLessThanOrEqual(cols.symbolX);
    expect(cols.symbolX + cols.symbolW).toBeLessThanOrEqual(20 + 170);
    expect(cols.symbolW).toBeLessThan(cols.tableW);
  });

  it("uses one typeface, a schedule table, and a cover QR when a share URL is set", () => {
    const doc = buildFullReportPdf({
      projectName: "Studio 5",
      scene,
      results,
      photometry: {},
      shareUrl: "https://example.test/view/token-abc",
    });
    const text = pdfText(doc);
    expect(text).toContain("Luminaire schedule");
    expect(text).not.toContain("Luminaire schedule appendix");
    expect(text).toContain("Name");
    expect(text).toContain("Storey");
    expect(text).toContain("View this project");
    expect(text).toContain("https://example.test/view/token-abc");
    const raw = Buffer.from(doc.output("arraybuffer")).toString("latin1");
    const fonts = Object.keys(doc.getFontList());
    expect(fonts).toContain(REPORT_FONT);
    expect(raw.includes("SourceSans3") || raw.includes(REPORT_FONT)).toBe(true);
  });
});
