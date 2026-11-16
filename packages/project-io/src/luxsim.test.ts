import { describe, expect, it } from "vitest";
import type { PhotometricData } from "../../photometry/src/types";
import {
  LUXSIM_LEGACY_PROJECT_EXTENSIONS,
  LUXSIM_PROJECT_EXTENSION,
  LUXSIM_PROJECT_FILE_ACCEPT,
  LUXSIM_PROJECT_MIME,
  LuxsimImportError,
  isLuxsimProjectFilename,
  luxsimProjectDownloadName,
  parseLuxsim,
  prepareLuxsimImport,
  rectPolygon,
  serializeLuxsim,
  type LuxsimProjectFile,
  type ProjectSceneV2,
  type ResultsV2,
} from "./index";

function stubPhoto(catalog: string): PhotometricData {
  return {
    format: "ies",
    manufacturer: "Test",
    catalogNumber: catalog,
    description: `Luminaire ${catalog}`,
    luminousFlux: 1000,
    watts: 10,
    lampCount: 1,
    ballastFactor: 1,
    verticalAngles: [0, 90],
    horizontalAngles: [0],
    intensities: [[100, 0]],
    symmetry: "axial",
  };
}

function sampleScene(overrides: Partial<ProjectSceneV2> = {}): ProjectSceneV2 {
  return {
    version: 2,
    storeys: [{ id: "s1", name: "GF", elevationM: 0, heightM: 3 }],
    rooms: [
      {
        id: "r1",
        storeyId: "s1",
        name: "Office A",
        polygon: rectPolygon(0, 0, 5, 4),
        heightM: 2.8,
        workplaneHeightM: 0.75,
        reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
        calc: {
          gridSpacing: 0.5,
          interreflection: true,
          bounces: 2,
          computeUgr: true,
          maintenanceFactor: 0.8,
          en12464TemplateId: "office",
        },
      },
      {
        id: "r2",
        storeyId: "s1",
        name: "Room 2",
        polygon: [
          { x: 5, y: 0 },
          { x: 8, y: 0 },
          { x: 8, y: 6 },
          { x: 6, y: 6 },
          { x: 6, y: 2 },
          { x: 5, y: 2 },
        ],
        heightM: 2.8,
        workplaneHeightM: 0.75,
        reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
        calc: {
          gridSpacing: 0.5,
          interreflection: true,
          bounces: 2,
          computeUgr: true,
          maintenanceFactor: 0.8,
        },
      },
    ],
    underlays: [],
    fixtureLibraryIds: ["lum-a"],
    instances: [
      {
        instanceId: "i1",
        luminaireId: "lum-a",
        storeyId: "s1",
        roomId: "r1",
        name: "Downlight",
        position: { x: 2.5, y: 2, z: 2.7 },
        rotationDeg: 45,
      },
    ],
    fixtureCodeMap: [
      {
        id: "map-1",
        codeNorm: "DL1",
        aliases: ["DL-1"],
        luminaireId: "lum-a",
        match: "exact",
        active: true,
      },
    ],
    ui: {
      activeStoreyId: "s1",
      activeRoomId: "r1",
      viewMode: "top",
      tool: "select",
      workflowMode: "export",
    },
    ...overrides,
  };
}

const sampleResults: ResultsV2 = {
  version: 2,
  byRoomId: {
    r1: {
      version: 1,
      grid: {
        originX: 0,
        originY: 0,
        spacing: 1,
        nx: 1,
        ny: 1,
        z: 0.75,
        lux: [400],
      },
      summary: {
        eave: 400,
        emin: 400,
        emax: 400,
        uo: 1,
        ugr: 16,
        lpd: 2,
        totalWatts: 10,
        areaM2: 20,
      },
      meta: {
        interreflection: true,
        bounces: 2,
        calculatedAt: "2026-01-01T00:00:00.000Z",
        disclaimer: "test",
      },
    },
  },
  wallsByRoomId: {
    r1: [
      {
        id: "w1",
        roomId: "r1",
        name: "Wall A",
        polyline: [
          { x: 0, y: 0 },
          { x: 5, y: 0 },
        ],
        normals: [
          { x: 0, y: 1 },
          { x: 0, y: 1 },
        ],
        heightM: 2.8,
        insetM: 0.1,
        normal: { x: 0, y: 1 },
        widthM: 5,
        curved: false,
        grid: { originU: 0, originV: 0, spacing: 0.5, nu: 1, nv: 1, lux: [200] },
        summary: { eave: 200, emin: 200, emax: 200, uo: 1, areaM2: 14 },
      },
    ],
  },
};

function sampleFile(overrides: Partial<LuxsimProjectFile> = {}): LuxsimProjectFile {
  return {
    format: "luxsim",
    version: 2,
    name: "Sample office",
    scene: sampleScene(),
    results: sampleResults,
    photometry: { "lum-a": stubPhoto("A") },
    sourceFiles: { "lum-a": { filename: "sample-downlight.ies", text: "IESNA91\nSOURCE A\n" } },
    ...overrides,
  };
}

describe("serializeLuxsim / parseLuxsim", () => {
  it("round-trips a valid exported project, including rooms, fixtures, results, and mapping rules", () => {
    const built = sampleFile();
    const parsed = parseLuxsim(serializeLuxsim(built));
    expect(parsed).toEqual(built);
    expect(parsed.format).toBe("luxsim");
    expect(parsed.scene).toMatchObject({
      version: 2,
      storeys: [{ id: "s1", name: "GF" }],
      rooms: [
        { id: "r1", name: "Office A", polygon: rectPolygon(0, 0, 5, 4) },
        { id: "r2", name: "Room 2" },
      ],
      instances: [
        {
          instanceId: "i1",
          luminaireId: "lum-a",
          position: { x: 2.5, y: 2, z: 2.7 },
          rotationDeg: 45,
        },
      ],
      fixtureCodeMap: [{ id: "map-1", codeNorm: "DL1", luminaireId: "lum-a" }],
    });
    expect((parsed.results as ResultsV2).byRoomId.r1?.summary.eave).toBe(400);
    expect((parsed.results as ResultsV2).wallsByRoomId?.r1?.[0]?.id).toBe("w1");
    expect(parsed.sourceFiles?.["lum-a"]?.text).toContain("SOURCE A");
  });

  it("rejects a file that is not a LUXSIM project", () => {
    expect(() => parseLuxsim(JSON.stringify({ format: "json", name: "x" }))).toThrow(
      "Not a LUXSIM project file"
    );
  });
});

describe("prepareLuxsimImport", () => {
  it("parses a valid export into an equivalent ProjectSceneV2", () => {
    const prepared = prepareLuxsimImport(serializeLuxsim(sampleFile()));
    expect(prepared.name).toBe("Sample office");
    expect(prepared.scene.version).toBe(2);
    expect(prepared.scene.storeys).toEqual(sampleScene().storeys);
    expect(prepared.scene.rooms.map((r) => r.name)).toEqual(["Office A", "Room 2"]);
    expect(prepared.scene.rooms[0]?.polygon).toEqual(rectPolygon(0, 0, 5, 4));
    expect(prepared.scene.instances).toEqual(sampleScene().instances);
    expect(prepared.scene.fixtureCodeMap).toEqual(sampleScene().fixtureCodeMap);
    expect(prepared.results.byRoomId.r1?.summary.eave).toBe(400);
    expect(prepared.results.wallsByRoomId?.r1?.[0]?.summary.eave).toBe(200);
    expect(prepared.photometry["lum-a"]?.catalogNumber).toBe("A");
    expect(prepared.sourceFiles["lum-a"]?.text).toContain("SOURCE A");
    expect(prepared.warnings).toEqual([]);
  });

  it("does not import a website or report footer even if they are stuffed into the file", () => {
    const text = JSON.stringify({
      ...sampleFile(),
      website: "https://example.invalid",
      reportWebsite: "https://footer.invalid",
    });
    const prepared = prepareLuxsimImport(text);
    expect(prepared).not.toHaveProperty("website");
    expect(prepared).not.toHaveProperty("reportWebsite");
    expect(JSON.stringify(prepared)).not.toContain("example.invalid");
    expect(JSON.stringify(prepared)).not.toContain("footer.invalid");
  });

  it("warns when a source file is missing and does not invent bytes", () => {
    const prepared = prepareLuxsimImport(
      serializeLuxsim(sampleFile({ sourceFiles: undefined }))
    );
    expect(prepared.sourceFiles).toEqual({});
    expect(prepared.photometry["lum-a"]?.catalogNumber).toBe("A");
    expect(prepared.warnings).toEqual([
      "Source file for luminaire lum-a is missing from the file and was not invented.",
    ]);
  });

  it("migrates a valid v1 scene to ProjectSceneV2", () => {
    const prepared = prepareLuxsimImport(
      serializeLuxsim({
        format: "luxsim",
        version: 1,
        name: "Legacy room",
        scene: {
          version: 1,
          room: {
            width: 6,
            depth: 4,
            height: 3,
            workplaneHeight: 0.8,
            reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
          },
          gridSpacing: 0.5,
          luminaires: [
            {
              instanceId: "i1",
              luminaireId: "lum-a",
              name: "Downlight",
              position: { x: 1, y: 1, z: 2.8 },
              rotationDeg: 0,
            },
          ],
          calcOptions: { interreflection: true, bounces: 2, computeUgr: true },
        },
        results: null,
        photometry: { "lum-a": stubPhoto("A") },
        sourceFiles: { "lum-a": { filename: "a.ies", text: "IES\n" } },
      })
    );
    expect(prepared.scene.version).toBe(2);
    expect(prepared.scene.storeys[0]?.name).toBe("GF");
    expect(prepared.scene.rooms).toHaveLength(1);
    expect(prepared.scene.rooms[0]?.name).toBe("Room 1");
    expect(prepared.scene.rooms[0]?.polygon).toEqual(rectPolygon(0, 0, 6, 4));
    expect(prepared.scene.rooms[0]?.heightM).toBe(3);
    expect(prepared.scene.instances[0]?.position).toEqual({ x: 1, y: 1, z: 2.8 });
  });

  it("rejects clearly invalid files", () => {
    const rejects = [
      ["not json", "{"],
      ["wrong format", JSON.stringify({ format: "dialux", version: 2, name: "x", scene: sampleScene() })],
      ["missing scene", JSON.stringify({ format: "luxsim", version: 2, name: "x" })],
      ["empty object scene", JSON.stringify({ format: "luxsim", version: 2, name: "x", scene: {} })],
      ["unsupported version", JSON.stringify({ format: "luxsim", version: 3, name: "x", scene: sampleScene() })],
      ["photometry array", JSON.stringify({ ...sampleFile(), photometry: [] })],
      ["luminaireLibrary array", JSON.stringify({ ...sampleFile(), luminaireLibrary: [] })],
      [
        "invalid libraryBeamDeg",
        JSON.stringify({
          ...sampleFile(),
          luminaireLibrary: { "lum-a": { origin: "library_cone", libraryBeamDeg: "wide" } },
        }),
      ],
    ];
    for (const [label, text] of rejects) {
      expect(() => prepareLuxsimImport(text), label).toThrow(LuxsimImportError);
    }
  });

  it("round-trips Generate LDT cone origin, family, and beam, and does not invent them on older files", () => {
    const cone = {
      origin: "library_cone",
      libraryFamily: "circular",
      libraryBeamDeg: 36,
    };
    const built = sampleFile({ luminaireLibrary: { "lum-a": cone } });
    const parsed = parseLuxsim(serializeLuxsim(built));
    expect(parsed.luminaireLibrary?.["lum-a"]).toEqual(cone);
    const prepared = prepareLuxsimImport(serializeLuxsim(built));
    expect(prepared.luminaireLibrary["lum-a"]).toEqual(cone);
    expect(prepared.warnings).toEqual([]);

    const older = sampleFile();
    expect(older.luminaireLibrary).toBeUndefined();
    const olderPrepared = prepareLuxsimImport(serializeLuxsim(older));
    expect(olderPrepared.luminaireLibrary).toEqual({});
    expect(JSON.stringify(olderPrepared)).not.toMatch(/library_cone/);
    expect(olderPrepared.sourceFiles["lum-a"]?.text).toContain("SOURCE A");
  });
});

describe("official .lux project filename", () => {
  it("saves as .lux and still recognises older .luxsim names", () => {
    expect(LUXSIM_PROJECT_EXTENSION).toBe(".lux");
    expect(LUXSIM_PROJECT_MIME).toBe("application/json");
    expect(luxsimProjectDownloadName("Sample office")).toBe("Sample_office.lux");
    expect(luxsimProjectDownloadName("")).toBe("luxsim-project.lux");
    expect([...LUXSIM_LEGACY_PROJECT_EXTENSIONS]).toEqual([".luxsim", ".luxsim.json"]);
    expect(LUXSIM_PROJECT_FILE_ACCEPT).toBe(".lux,.luxsim,.luxsim.json,application/json");
    expect(isLuxsimProjectFilename("Office.lux")).toBe(true);
    expect(isLuxsimProjectFilename("Office.LUX")).toBe(true);
    expect(isLuxsimProjectFilename("Office.luxsim")).toBe(true);
    expect(isLuxsimProjectFilename("Office.luxsim.json")).toBe(true);
    expect(isLuxsimProjectFilename("path/Office.luxsim.JSON")).toBe(true);
    expect(isLuxsimProjectFilename("Office.json")).toBe(false);
    expect(isLuxsimProjectFilename("Office.luxury")).toBe(false);
    expect(isLuxsimProjectFilename("Office.lux.bak")).toBe(false);
  });

  it("opens the same JSON format from a .lux or a .luxsim filename", () => {
    const text = serializeLuxsim(sampleFile());
    const fromLux = prepareLuxsimImport(text);
    const fromLegacy = prepareLuxsimImport(text);
    expect(isLuxsimProjectFilename("Sample_office.lux")).toBe(true);
    expect(isLuxsimProjectFilename("Sample_office.luxsim")).toBe(true);
    expect(fromLux.scene).toEqual(fromLegacy.scene);
    expect(fromLux.results).toEqual(fromLegacy.results);
    expect(fromLux.name).toBe("Sample office");
    expect(JSON.parse(text).format).toBe("luxsim");
  });
});

