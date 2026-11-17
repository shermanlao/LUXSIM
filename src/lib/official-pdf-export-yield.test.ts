import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { rectPolygon } from "@luxsim/project-io";
import {
  buildFullReportPdf,
  buildFullReportPdfAsync,
  collectOfficialIsoluxSnapshotsAsync,
} from "@luxsim/project-io";
import type { ProjectSceneV2, ResultsV2, RoomV2 } from "@luxsim/project-io";
import {
  captureOfficialReport3dViewsAsync,
} from "./official-pdf-3d-capture";

const root = path.resolve(__dirname, "../..");
function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

function pageCount(doc: { internal?: { getNumberOfPages?: () => number }; getNumberOfPages?: () => number }): number {
  return doc.internal?.getNumberOfPages?.() ?? doc.getNumberOfPages?.() ?? 1;
}

function twoRoomScene(): { scene: ProjectSceneV2; results: ResultsV2 } {
  const room = (id: string, name: string, x: number): RoomV2 => ({
    id,
    storeyId: "s1",
    name,
    polygon: rectPolygon(x, 0, 4, 3),
    heightM: 2.8,
    workplaneHeightM: 0.75,
    reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
    calc: { gridSpacing: 0.5, interreflection: false, bounces: 0, computeUgr: false },
  });
  const scene: ProjectSceneV2 = {
    version: 2,
    storeys: [{ id: "s1", name: "L1", elevationM: 0, heightM: 3 }],
    rooms: [room("r1", "Office 1", 0), room("r2", "Office 2", 5)],
    underlays: [],
    fixtureLibraryIds: [],
    instances: [],
    ui: { activeStoreyId: "s1", activeRoomId: "r1", viewMode: "top", tool: "select" },
  };
  return { scene, results: { version: 2, byRoomId: {} } };
}

describe("Full PDF export stays responsive", () => {
  it("wires yielding export helpers in the official editor path", () => {
    const editor = read("src/components/editor/BuildingEditor.tsx");
    const exportFn = editor.slice(editor.indexOf("async function exportFullPdf"));
    expect(exportFn).toContain("officialWaitYield");
    expect(exportFn).toContain("gridToFalseColorJpegDataUrlAsync");
    expect(exportFn).toContain("collectOfficialIsoluxSnapshotsAsync");
    expect(exportFn).toContain("captureOfficialReport3dViewsAsync");
    expect(exportFn).toContain("renderAllReport3dViewsAsync");
    expect(exportFn).toContain("buildFullReportPdfAsync");
    expect(exportFn.indexOf("collectOfficialIsoluxSnapshotsAsync")).toBeLessThan(
      exportFn.indexOf("captureOfficialReport3dViewsAsync")
    );
    expect(exportFn.indexOf("isoluxSnapshots,")).toBeLessThan(exportFn.indexOf("officialSaveBlob"));

    const hook = read("src/components/useOfficialWaitDialog.tsx");
    expect(hook).toContain("flushSync");
    expect(hook).toContain("officialWaitBeforeWork");

    const capture = read("src/lib/render-scene-3d.ts");
    expect(capture).toContain("export async function renderAllReport3dViewsAsync");
    expect(capture).toContain("createOffscreenReportRenderer");
    expect(capture).toContain("await yieldTo()");
  });

  it("yields once per room when collecting isolux snapshots", async () => {
    const { scene, results } = twoRoomScene();
    let yields = 0;
    const snaps = await collectOfficialIsoluxSnapshotsAsync(
      scene,
      results,
      () => "data:image/png,x",
      async () => {
        yields += 1;
      }
    );
    expect(yields).toBe(2);
    expect(snaps).toEqual({});
  });

  it("yields between official report chapters and keeps the same page count", async () => {
    const { scene, results } = twoRoomScene();
    const input = {
      projectName: "Yield test",
      scene,
      results,
      photometry: {},
      wattsById: {},
      luxsimVersion: "0.1.0",
    };
    let yields = 0;
    const asyncDoc = await buildFullReportPdfAsync(input, async () => {
      yields += 1;
    });
    const syncDoc = buildFullReportPdf(input);
    expect(yields).toBeGreaterThan(6);
    expect(pageCount(asyncDoc)).toBe(pageCount(syncDoc));
  });

  it("awaits an async 3D render without inventing stills", async () => {
    const captured = await captureOfficialReport3dViewsAsync({
      captureAvailable: () => true,
      render: async () => ({
        projectGreyscale: "data:image/jpeg,g",
        projectFalseColor: "data:image/jpeg,f",
        roomGreyscale: {},
        roomFalseColor: {},
      }),
    });
    expect(captured.omitted).toBe(false);
    expect(captured.reason).toBe("included");
    expect(captured.views.projectPerspectiveGreyscale).toBe("data:image/jpeg,g");

    const omitted = await captureOfficialReport3dViewsAsync({
      captureAvailable: () => false,
      render: async () => {
        throw new Error("must not render when capture is unavailable");
      },
    });
    expect(omitted.omitted).toBe(true);
    expect(omitted.reason).toBe("unavailable");
  });

  it("documents that Full PDF export keeps the page responsive", () => {
    const guide = read("docs/USER_GUIDE.md");
    expect(guide).toMatch(/頁面保持可回應/);
    expect(guide).toMatch(/page stays responsive/);
    expect(guide).toMatch(/Exporting PDF report…/);
    expect(guide).toMatch(/正在匯出 PDF 報告…/);
    expect(guide).toMatch(/報告中的圖片會壓縮，讓 Full PDF 檔案維持在較小體積/);
    expect(guide).toMatch(/Report images are compressed so the Full PDF file stays small/);
  });
});
