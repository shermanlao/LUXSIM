import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { parseIes } from "../../photometry/src/index";
import { calculate } from "../../solver/src/calculate";
import { roomAreaM2, rectPolygon } from "./geometry";
import { buildFullReportPdf } from "./report";
import {
  aggregateProjectLuminaires,
  enrichSummaryWithPolygonArea,
  roomLpdFromPolygon,
} from "./report-model";
import { clipResultsToPolygon, roomToCalcOptions } from "./room-adapter";
import type { FixtureInstance, ProjectSceneV2, RoomV2 } from "./types";

const fixture = readFileSync(
  path.join(process.cwd(), "fixtures/sample-downlight.ies"),
  "utf8"
);

function lShapedRoom(): RoomV2 {
  return {
    id: "r-l",
    storeyId: "s1",
    name: "Reception",
    polygon: [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 4 },
      { x: 3, y: 4 },
      { x: 3, y: 7 },
      { x: 0, y: 7 },
    ],
    heightM: 2.8,
    workplaneHeightM: 0.75,
    reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
    calc: {
      gridSpacing: 0.5,
      interreflection: false,
      bounces: 0,
      computeUgr: false,
    },
  };
}

describe("report-model polygon LPD", () => {
  it("uses shoelace area instead of axis-aligned bounding box", () => {
    const room = lShapedRoom();
    const bboxArea = 6 * 7;
    const polyArea = roomAreaM2(room);
    expect(polyArea).toBeCloseTo(33, 0);
    expect(polyArea).toBeLessThan(bboxArea);
  });

  it("recomputes LPD from polygon area after clipping", () => {
    const { data } = parseIes(fixture);
    const room = lShapedRoom();
    const inst: FixtureInstance = {
      instanceId: "i1",
      luminaireId: "lum",
      storeyId: "s1",
      roomId: "r-l",
      name: "DL",
      position: { x: 2, y: 2, z: 2.6 },
      rotationDeg: 0,
    };
    const raw = calculate(roomToCalcOptions(room, [inst], { lum: data }, { lum: 30 }));
    expect(raw.summary.areaM2).toBeCloseTo(42, 0);
    const clipped = clipResultsToPolygon(room, raw);
    expect(clipped.summary.areaM2).toBeCloseTo(roomAreaM2(room), 2);
    const lpdBBox = 30 / raw.summary.areaM2;
    const lpdPoly = clipped.summary.lpd!;
    expect(lpdPoly).toBeGreaterThan(lpdBBox);
  });

  it("aggregate luminaire list groups by product", () => {
    const scene: ProjectSceneV2 = {
      version: 2,
      storeys: [{ id: "s1", name: "L1", elevationM: 0, heightM: 3 }],
      rooms: [lShapedRoom()],
      underlays: [],
      fixtureLibraryIds: ["lum"],
      instances: [
        {
          instanceId: "a",
          luminaireId: "lum",
          storeyId: "s1",
          roomId: "r-l",
          name: "A",
          position: { x: 1, y: 1, z: 2.6 },
          rotationDeg: 0,
        },
        {
          instanceId: "b",
          luminaireId: "lum",
          storeyId: "s1",
          roomId: "r-l",
          name: "B",
          position: { x: 2, y: 2, z: 2.6 },
          rotationDeg: 0,
        },
      ],
      ui: {
        activeStoreyId: "s1",
        activeRoomId: "r-l",
        viewMode: "top",
        tool: "select",
      },
    };
    const { data } = parseIes(fixture);
    const rows = aggregateProjectLuminaires(scene, { lum: data }, { lum: 30 });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.count).toBe(2);
    expect(rows[0]!.flux).toBe(2000);
  });
});

describe("buildFullReportPdf", () => {
  it("produces multi-page PDF with project-level sections", () => {
    const { data } = parseIes(fixture);
    const room: RoomV2 = {
      id: "r1",
      storeyId: "s1",
      name: "Office",
      polygon: rectPolygon(0, 0, 6, 5),
      heightM: 2.8,
      workplaneHeightM: 0.75,
      reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
      calc: {
        gridSpacing: 0.5,
        interreflection: true,
        bounces: 2,
        computeUgr: true,
      },
    };
    const inst: FixtureInstance = {
      instanceId: "i1",
      luminaireId: "lum",
      storeyId: "s1",
      roomId: "r1",
      name: "DL",
      position: { x: 3, y: 2.5, z: 2.6 },
      rotationDeg: 0,
    };
    const calc = clipResultsToPolygon(
      room,
      calculate(roomToCalcOptions(room, [inst], { lum: data }, { lum: 30 }))
    );
    const scene: ProjectSceneV2 = {
      version: 2,
      storeys: [{ id: "s1", name: "Building 1 · Storey 1", elevationM: 0, heightM: 3 }],
      rooms: [room],
      underlays: [],
      fixtureLibraryIds: ["lum"],
      instances: [inst],
      ui: { activeStoreyId: "s1", activeRoomId: "r1", viewMode: "top", tool: "select" },
    };
    const doc = buildFullReportPdf({
      projectName: "AED-180297 L9M",
      scene,
      results: { version: 2, byRoomId: { r1: calc } },
      photometry: { lum: data },
      wattsById: { lum: 30 },
      luxsimVersion: "0.1.0",
    });
    const pages =
      (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal?.getNumberOfPages?.() ??
      (doc as unknown as { getNumberOfPages?: () => number }).getNumberOfPages?.() ??
      1;
    expect(pages).toBeGreaterThanOrEqual(10);
    const summary = enrichSummaryWithPolygonArea(room, calc, scene, { lum: data }, { lum: 30 });
    expect(summary.lpd).toBeCloseTo(roomLpdFromPolygon(room, scene, { lum: data }, { lum: 30 })!, 4);
  });
});
