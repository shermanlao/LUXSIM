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
import { calculateRoomWalls } from "./wall-surfaces";
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

describe("Lighting Plan section", () => {
  function officeScene() {
    const { data } = parseIes(fixture);
    const room: RoomV2 = {
      id: "r1",
      storeyId: "s1",
      name: "Office",
      polygon: rectPolygon(0, 0, 6, 5),
      heightM: 2.8,
      workplaneHeightM: 0.75,
      reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
      calc: { gridSpacing: 0.5, interreflection: true, bounces: 2, computeUgr: true },
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
      storeys: [{ id: "s1", name: "L9M", elevationM: 0, heightM: 3 }],
      rooms: [room],
      underlays: [],
      fixtureLibraryIds: ["lum"],
      instances: [inst],
      ui: { activeStoreyId: "s1", activeRoomId: "r1", viewMode: "top", tool: "select" },
    };
    return { data, room, inst, calc, scene };
  }

  function pdfText(doc: ReturnType<typeof buildFullReportPdf>): string {
    return Buffer.from(doc.output("arraybuffer")).toString("latin1");
  }

  it("includes a Lighting Plan section after Calculation objects", () => {
    const { data, calc, scene } = officeScene();
    const doc = buildFullReportPdf({
      projectName: "AED-180297 L9M",
      scene,
      results: { version: 2, byRoomId: { r1: calc } },
      photometry: { lum: data },
      wattsById: { lum: 30 },
      luxsimVersion: "0.1.0",
    });
    const text = pdfText(doc);
    expect(text).toContain("5. Lighting Plan");
    expect(text).toContain("6. 3D views");
    expect(text).toContain("7. Per-room summary and working plane");
    expect(text).toContain("Lighting Plan");
    expect(text).toContain("Scale 1:");
    expect(text).toContain("Legend");
    expect(text).toContain("Mounting height 2.60 m");
    const pages =
      (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal?.getNumberOfPages?.() ?? 0;
    expect(pages).toBeGreaterThanOrEqual(11);
  });

  it("still draws a room plan when there are no fixture instances", () => {
    const { data, calc, scene, room } = officeScene();
    scene.instances = [];
    const doc = buildFullReportPdf({
      projectName: "Empty fixtures",
      scene,
      results: { version: 2, byRoomId: { r1: calc } },
      photometry: { lum: data },
    });
    const text = pdfText(doc);
    expect(text).toContain("Lighting Plan");
    expect(text).toContain(room.name);
    expect(text).toContain("Scale 1:");
  });
});

describe("3D views section", () => {
  const TINY_JPEG =
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAAgADADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD2OiiigAooooAKKKKACiiigAooooAKKKKAP//Z";

  function officeScene() {
    const { data } = parseIes(fixture);
    const room: RoomV2 = {
      id: "r1",
      storeyId: "s1",
      name: "Office",
      polygon: rectPolygon(0, 0, 6, 5),
      heightM: 2.8,
      workplaneHeightM: 0.75,
      reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
      calc: { gridSpacing: 0.5, interreflection: true, bounces: 2, computeUgr: true },
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
      storeys: [{ id: "s1", name: "L9M", elevationM: 0, heightM: 3 }],
      rooms: [room],
      underlays: [],
      fixtureLibraryIds: ["lum"],
      instances: [inst],
      ui: { activeStoreyId: "s1", activeRoomId: "r1", viewMode: "top", tool: "select" },
    };
    return { data, room, inst, calc, scene };
  }

  function pdfText(doc: ReturnType<typeof buildFullReportPdf>): string {
    return Buffer.from(doc.output("arraybuffer")).toString("latin1");
  }

  it("adds a 3D views section and labelled per-room pair when both images are provided", () => {
    const { data, calc, scene } = officeScene();
    const doc = buildFullReportPdf({
      projectName: "AED-180297 L9M",
      scene,
      results: { version: 2, byRoomId: { r1: calc } },
      photometry: { lum: data },
      wattsById: { lum: 30 },
      luxsimVersion: "0.1.0",
      projectPerspectiveGreyscale: TINY_JPEG,
      projectPerspectiveFalseColor: TINY_JPEG,
      persp3dGreyscale: { r1: TINY_JPEG },
      persp3dFalseColor: { r1: TINY_JPEG },
    });
    const text = pdfText(doc);
    expect(text).toContain("6. 3D views");
    expect(text).toContain("3D views");
    expect(text).toContain("3D greyscale");
    expect(text).toContain("3D false colour");
    expect(text).not.toContain("Created with DIALux");
    const pages =
      (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal?.getNumberOfPages?.() ?? 0;
    expect(pages).toBeGreaterThanOrEqual(12);
  });

  it("still builds a multi-page PDF when 3D images are omitted", () => {
    const { data, calc, scene } = officeScene();
    const doc = buildFullReportPdf({
      projectName: "AED-180297 L9M",
      scene,
      results: { version: 2, byRoomId: { r1: calc } },
      photometry: { lum: data },
      wattsById: { lum: 30 },
      luxsimVersion: "0.1.0",
    });
    const text = pdfText(doc);
    expect(text).toContain("6. 3D views");
    expect(text).toContain("Lighting Plan");
    const pages =
      (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal?.getNumberOfPages?.() ?? 0;
    expect(pages).toBeGreaterThanOrEqual(11);
  });
});

describe("wall calculation surfaces in the report", () => {
  function officeScene() {
    const { data } = parseIes(fixture);
    const room: RoomV2 = {
      id: "r1",
      storeyId: "s1",
      name: "Office",
      polygon: rectPolygon(0, 0, 6, 5),
      heightM: 2.8,
      workplaneHeightM: 0.75,
      reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
      calc: { gridSpacing: 0.5, interreflection: true, bounces: 2, computeUgr: true },
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
    const walls = calculateRoomWalls({
      room,
      instances: [inst],
      photometry: { lum: data },
      wattsById: { lum: 30 },
    });
    const scene: ProjectSceneV2 = {
      version: 2,
      storeys: [{ id: "s1", name: "L9M", elevationM: 0, heightM: 3 }],
      rooms: [room],
      underlays: [],
      fixtureLibraryIds: ["lum"],
      instances: [inst],
      ui: { activeStoreyId: "s1", activeRoomId: "r1", viewMode: "top", tool: "select" },
    };
    return { data, room, inst, calc, walls, scene };
  }

  function pdfText(doc: ReturnType<typeof buildFullReportPdf>): string {
    return Buffer.from(doc.output("arraybuffer")).toString("latin1");
  }

  it("lists wall surfaces on Calculation objects and the per-room Summary", () => {
    const { data, calc, walls, scene } = officeScene();
    expect(walls.length).toBe(4);
    const doc = buildFullReportPdf({
      projectName: "AED-180297 L9M",
      scene,
      results: { version: 2, byRoomId: { r1: calc }, wallsByRoomId: { r1: walls } },
      photometry: { lum: data },
      wattsById: { lum: 30 },
      luxsimVersion: "0.1.0",
    });
    const text = pdfText(doc);
    expect(text).toContain("Working planes and wall surfaces");
    expect(text).toContain("Wall surfaces");
    expect(text).toContain("vertical illuminance");
    // PDF string literals escape parentheses as \(
    expect(text.includes("Wall 1 (Office)") || text.includes("Wall 1 \\(Office\\)")).toBe(true);
    expect(text).toContain("Eavg");
    expect(text).toContain("Emin");
    expect(text).toContain("Emax");
    expect(text).toContain("Uo");
    expect(text).not.toContain("Created with DIALux");
    // Workplane section is still present; no per-wall isolux pages.
    expect(text.includes("Working plane (Office)") || text.includes("Working plane \\(Office\\)")).toBe(true);
    expect(text).not.toMatch(/Isolux diagram \(Wall /);
  });
});

