import { describe, expect, it } from "vitest";
import { buildFullReportPdf, planReportSections } from "./report";
import { pdfIncludes3dDrawingMarkers, pdfIncludesEmbeddedImages } from "./view-3d-render";
import { defaultSceneV2, migrateSceneV1toV2 } from "./migrate";
import { rectPolygon } from "./geometry";
import type { ProjectSceneV2, ResultsV2 } from "./types";
import { calculate } from "../../solver/src/calculate";
import { roomToCalcOptions, clipResultsToPolygon } from "./room-adapter";
import type { SceneJson } from "./types";
import { parseIes } from "../../photometry/src/index";
import { readFileSync } from "fs";
import path from "path";

function mkMultiRoomScene(roomCount: number): ProjectSceneV2 {
  const scene = defaultSceneV2();
  const storeyId = scene.storeys[0]!.id;
  for (let i = 0; i < roomCount; i += 1) {
    const w = 4 + (i % 3);
    const d = 3 + (i % 2);
    const ox = (i % 3) * 6;
    const oy = Math.floor(i / 3) * 5;
    scene.rooms.push({
      id: `room_${i}`,
      storeyId,
      name: `Space ${i + 1}`,
      polygon: rectPolygon(ox, oy, w, d),
      heightM: 2.8,
      workplaneHeightM: 0.75,
      reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
      calc: {
        gridSpacing: 0.5,
        interreflection: true,
        bounces: 2,
        computeUgr: false,
      },
    });
  }
  return scene;
}

describe("planReportSections", () => {
  it("omits product sheets from TOC when library has no photometry", () => {
    const scene = mkMultiRoomScene(3);
    const plan = planReportSections({
      projectName: "Test",
      scene,
      results: { version: 2, byRoomId: {} },
      photometry: {},
    });
    expect(plan.tocEntries).not.toContain("3. Product sheets");
    expect(plan.tocEntries[plan.tocEntries.length - 1]).toBe("3. Luminaire schedule appendix");
  });
});

describe("buildFullReportPdf", () => {
  it("TOC matches body for multi-room project without product sheets", () => {
    const scene = mkMultiRoomScene(9);
    const byRoomId: ResultsV2["byRoomId"] = {};
    for (const room of scene.rooms) {
      const opts = roomToCalcOptions(room, [], {}, {});
      let res = calculate(opts);
      res = clipResultsToPolygon(room, res);
      byRoomId[room.id] = res;
    }
    const doc = buildFullReportPdf({
      projectName: "L9M",
      orgName: "QA Studio",
      scene,
      results: { version: 2, byRoomId },
      photometry: {},
    });
    const raw = doc.output("arraybuffer");
    const pdfText = new TextDecoder("latin1").decode(raw);
    expect(pdfText).toContain("2. Room");
    expect(pdfText).not.toMatch(/3\. Product sheets/);
    expect(pdfText).toContain("3. Luminaire schedule appendix");
    expect(pdfText).toContain("Eave 0.0 lx");
    expect(pdfText).toContain("QA Studio");
    expect(pdfIncludes3dDrawingMarkers(pdfText)).toBe(true);
    expect(pdfText).toContain("3D perspective");
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(12);
  });

  it("embeds PNG 3D snapshots when provided", () => {
    const scene = mkMultiRoomScene(2);
    const tinyPng =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const storeyId = scene.storeys[0]!.id;
    const byRoomId: Record<string, string> = {};
    for (const r of scene.rooms) byRoomId[r.id] = tinyPng;

    const doc = buildFullReportPdf({
      projectName: "Snap",
      scene,
      results: { version: 2, byRoomId: {} },
      photometry: {},
      threeDSnapshots: {
        byStoreyId: { [storeyId]: tinyPng },
        byRoomId,
      },
    });
    const pdfText = new TextDecoder("latin1").decode(doc.output("arraybuffer"));
    expect(pdfIncludesEmbeddedImages(pdfText)).toBe(true);
    expect(pdfIncludes3dDrawingMarkers(pdfText)).toBe(true);
  });

  it("includes product section in TOC when photometry exists", () => {
    const v1: SceneJson = {
      version: 1,
      room: {
        width: 4,
        depth: 4,
        height: 2.8,
        reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
        workplaneHeight: 0.75,
      },
      gridSpacing: 0.5,
      luminaires: [
        {
          instanceId: "i1",
          luminaireId: "lum1",
          name: "DL",
          position: { x: 2, y: 2, z: 2.6 },
          rotationDeg: 0,
        },
      ],
      calcOptions: { interreflection: true, bounces: 2, computeUgr: true },
    };
    const scene = migrateSceneV1toV2(v1);
    const ies = readFileSync(
      path.join(process.cwd(), "fixtures/sample-downlight.ies"),
      "utf8"
    );
    const { data: photo } = parseIes(ies);
    const room = scene.rooms[0]!;
    const inst = scene.instances;
    const opts = roomToCalcOptions(room, inst, { lum1: photo }, { lum1: 30 });
    let res = calculate(opts);
    res = clipResultsToPolygon(room, res);

    const doc = buildFullReportPdf({
      projectName: "One room",
      scene,
      results: { version: 2, byRoomId: { [room.id]: res } },
      photometry: { lum1: photo },
    });
    const pdfText = new TextDecoder("latin1").decode(doc.output("arraybuffer"));
    expect(pdfText).toContain("3. Product sheets");
    expect(pdfText).toContain("4. Global luminaire schedule");
    expect(pdfText).toContain("Eave");
  });
});
