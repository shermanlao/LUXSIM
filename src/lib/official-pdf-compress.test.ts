import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildFullReportPdf, rectPolygon } from "@luxsim/project-io";
import type { ProjectSceneV2, ResultsV2, RoomV2 } from "@luxsim/project-io";
import {
  REPORT_3D_JPEG_QUALITY,
  REPORT_3D_OVERVIEW_HEIGHT,
  REPORT_3D_OVERVIEW_WIDTH,
  REPORT_3D_ROOM_HEIGHT,
  REPORT_3D_ROOM_WIDTH,
} from "./render-scene-3d";

const root = path.resolve(__dirname, "../..");

function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("official Full PDF image compression", () => {
  it("enables jsPDF stream compression and uses JPEG false-colour and smaller 3D stills", () => {
    const report = read("packages/project-io/src/report.ts");
    expect(report).toMatch(/new jsPDF\(\{\s*compress:\s*true\s*\}\)/);

    const falseColor = read("packages/project-io/src/false-color-snapshot.ts");
    expect(falseColor).toMatch(/toDataURL\("image\/jpeg"/);
    expect(falseColor).toContain("FALSE_COLOR_JPEG_MAX_EDGE = 1100");
    expect(falseColor).toContain("FALSE_COLOR_JPEG_QUALITY = 0.75");

    const editor = read("src/components/editor/BuildingEditor.tsx");
    expect(editor).toContain("gridToFalseColorJpegDataUrlAsync");

    expect(REPORT_3D_OVERVIEW_WIDTH).toBe(1280);
    expect(REPORT_3D_OVERVIEW_HEIGHT).toBe(720);
    expect(REPORT_3D_ROOM_WIDTH).toBe(960);
    expect(REPORT_3D_ROOM_HEIGHT).toBe(680);
    expect(REPORT_3D_JPEG_QUALITY).toBe(0.75);

    const capture = read("src/lib/render-scene-3d.ts");
    expect(capture).toContain("opts.overviewWidth ?? REPORT_3D_OVERVIEW_WIDTH");
    expect(capture).toContain("opts.roomWidth ?? REPORT_3D_ROOM_WIDTH");
    expect(capture).toContain("opts.quality ?? REPORT_3D_JPEG_QUALITY");
    expect(capture).not.toMatch(/overviewWidth \?\? 1920/);
    expect(capture).not.toMatch(/roomWidth \?\? 1400/);
  });

  it("writes compressed streams in a built Full PDF", () => {
    const room: RoomV2 = {
      id: "r1",
      storeyId: "s1",
      name: "Office",
      polygon: rectPolygon(0, 0, 6, 5),
      heightM: 2.8,
      workplaneHeightM: 0.75,
      reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
      calc: { gridSpacing: 0.5, interreflection: false, bounces: 0, computeUgr: false },
    };
    const scene: ProjectSceneV2 = {
      version: 2,
      storeys: [{ id: "s1", name: "L1", elevationM: 0, heightM: 3 }],
      rooms: [room],
      underlays: [],
      fixtureLibraryIds: [],
      instances: [],
      ui: { activeStoreyId: "s1", activeRoomId: "r1", viewMode: "top", tool: "select" },
    };
    const results: ResultsV2 = { version: 2, byRoomId: {} };
    const doc = buildFullReportPdf({
      projectName: "Compress test",
      scene,
      results,
      photometry: {},
      wattsById: {},
      luxsimVersion: "0.1.0",
    });
    const bytes = Buffer.from(doc.output("arraybuffer"));
    const text = bytes.toString("latin1");
    expect(text).toContain("/FlateDecode");
  });
});
