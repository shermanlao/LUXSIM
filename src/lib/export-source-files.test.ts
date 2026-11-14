import { describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import type { PhotometricData } from "@luxsim/photometry";
import {
  buildDialuxPack,
  parseLuxsim,
  rectPolygon,
  serializeLuxsim,
  type ProjectSceneV2,
  type ResultsV2,
} from "@luxsim/project-io";
import { buildLuxsimProject } from "./exports-client";
import {
  collectOfficialExportSources,
  missingExportSourceStatus,
  officialExportLuminaireIds,
  type ExportSourceFile,
} from "./export-source-files";

function stubPhoto(catalog: string): PhotometricData {
  return {
    format: "ies",
    manufacturer: "Test",
    catalogNumber: catalog,
    description: "stub",
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

const photoA = stubPhoto("A");
const photoB = stubPhoto("B");
const sourceA: ExportSourceFile = { filename: "sample-downlight.ies", text: "IESNA91\nSOURCE A\n" };
const sourceB: ExportSourceFile = { filename: "M4-CONE-36.ldt", text: "LDT SOURCE B\n" };

const scene: ProjectSceneV2 = {
  version: 2,
  storeys: [{ id: "s1", name: "GF", elevationM: 0, heightM: 3 }],
  rooms: [
    {
      id: "r1",
      storeyId: "s1",
      name: "Office A",
      polygon: rectPolygon(0, 0, 8, 6),
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
      position: { x: 4, y: 3, z: 2.7 },
      rotationDeg: 0,
    },
  ],
  ui: {
    activeStoreyId: "s1",
    activeRoomId: "r1",
    viewMode: "top",
    tool: "select",
    workflowMode: "export",
  },
};

const results: ResultsV2 = {
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
        lux: [200],
      },
      summary: {
        eave: 200,
        emin: 200,
        emax: 200,
        uo: 1,
        ugr: 19,
        lpd: 4,
        totalWatts: 10,
        areaM2: 48,
      },
      meta: {
        interreflection: true,
        bounces: 2,
        calculatedAt: "2026-01-01T00:00:00.000Z",
        disclaimer: "test",
      },
    },
  },
};

describe("officialExportLuminaireIds", () => {
  it("includes library ids and any extra instance luminaire once", () => {
    expect(
      officialExportLuminaireIds({
        fixtureLibraryIds: ["lum-a"],
        instances: [
          { luminaireId: "lum-a" },
          { luminaireId: "lum-b" },
          { luminaireId: "lum-b" },
        ],
      })
    ).toEqual(["lum-a", "lum-b"]);
  });
});

describe("collectOfficialExportSources", () => {
  it("keeps a cached source when photometry is already warm and does not reload", async () => {
    const loadLuminaire = vi.fn(async () => {
      throw new Error("should not refetch a complete cache");
    });
    const collected = await collectOfficialExportSources({
      luminaireIds: ["lum-a"],
      photoCache: { "lum-a": photoA },
      sourceCache: { "lum-a": sourceA },
      libraryCache: { "lum-a": { origin: "upload" } },
      loadLuminaire,
    });
    expect(loadLuminaire).not.toHaveBeenCalled();
    expect(collected.sourceFiles["lum-a"]).toEqual(sourceA);
    expect(collected.photometry["lum-a"]).toEqual(photoA);
    expect(collected.luminaireLibrary).toEqual({});
    expect(collected.missingSourceIds).toEqual([]);
  });

  it("does not drop cached sources on a later scene-only collect", async () => {
    const loadLuminaire = vi.fn(async () => {
      throw new Error("should not refetch after a scene-only change");
    });
    const collected = await collectOfficialExportSources({
      luminaireIds: ["lum-a"],
      photoCache: { "lum-a": photoA, "lum-b": photoB },
      sourceCache: { "lum-a": sourceA, "lum-b": sourceB },
      libraryCache: { "lum-a": { origin: "upload" }, "lum-b": { origin: "upload" } },
      loadLuminaire,
    });
    expect(loadLuminaire).not.toHaveBeenCalled();
    expect(collected.sourceFiles).toEqual({ "lum-a": sourceA, "lum-b": sourceB });
    expect(collected.luminaireLibrary).toEqual({});
  });

  it("refetches the source when photometry is cached but sourceCache was not committed", async () => {
    const loadLuminaire = vi.fn(async () => ({ photometric: photoA, source: sourceA }));
    const collected = await collectOfficialExportSources({
      luminaireIds: ["lum-a"],
      photoCache: { "lum-a": photoA },
      sourceCache: {},
      loadLuminaire,
    });
    expect(loadLuminaire).toHaveBeenCalledTimes(1);
    expect(collected.sourceFiles["lum-a"]).toEqual(sourceA);
    expect(collected.missingSourceIds).toEqual([]);
  });

  it("uses freshly loaded sources even when both caches are empty", async () => {
    const collected = await collectOfficialExportSources({
      luminaireIds: ["lum-a"],
      photoCache: {},
      sourceCache: {},
      loadLuminaire: async () => ({ photometric: photoA, source: sourceA }),
    });
    expect(collected.sourceFiles["lum-a"]).toEqual(sourceA);
    expect(collected.photometry["lum-a"]).toEqual(photoA);
    expect(collected.missingSourceIds).toEqual([]);
  });

  it("lists missing ids and does not invent source text when a file cannot be recovered", async () => {
    const collected = await collectOfficialExportSources({
      luminaireIds: ["lum-a"],
      photoCache: { "lum-a": photoA },
      sourceCache: {},
      loadLuminaire: async () => ({ photometric: photoA, source: null }),
    });
    expect(collected.sourceFiles["lum-a"]).toBeUndefined();
    expect(collected.missingSourceIds).toEqual(["lum-a"]);
    expect(missingExportSourceStatus("dialux", collected.missingSourceIds, { "lum-a": "Downlight" })).toContain(
      "Downlight"
    );
  });
});

describe("official pack builders with collected sources", () => {
  it("includes the cached original file in the verification zip and .luxsim", async () => {
    const collected = await collectOfficialExportSources({
      luminaireIds: officialExportLuminaireIds(scene),
      photoCache: { "lum-a": photoA },
      sourceCache: { "lum-a": sourceA },
      libraryCache: { "lum-a": { origin: "upload" } },
      loadLuminaire: async () => {
        throw new Error("cache should still be valid");
      },
    });

    const blob = await buildDialuxPack({
      projectName: "Test",
      scene,
      results,
      sourceFiles: collected.sourceFiles,
      luminaireNames: { "lum-a": "Downlight" },
    });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const ies = await zip.file("luminaires/sample-downlight.ies")?.async("string");
    expect(ies).toBe(sourceA.text);
    const readme = await zip.file("README.txt")!.async("string");
    expect(readme).not.toMatch(/http:\/\/|https:\/\/|reportWebsite|lightx\.com/i);
    expect(readme).not.toMatch(/\.evo/);
    expect(readme).not.toMatch(/original IES\/LDT files are missing/i);

    const project = buildLuxsimProject({
      name: "Test",
      scene,
      results,
      photometry: collected.photometry,
      sourceFiles: collected.sourceFiles,
    });
    const parsed = parseLuxsim(serializeLuxsim(project));
    expect(parsed.sourceFiles?.["lum-a"]).toEqual(sourceA);
    const text = serializeLuxsim(project);
    expect(text).not.toMatch(/reportWebsite/);
    expect(text).not.toMatch(/https?:\/\//);
  });

  it("fails if a stale empty cache is used to build a pack that should still have the file", async () => {
    const collected = await collectOfficialExportSources({
      luminaireIds: ["lum-a"],
      photoCache: { "lum-a": photoA },
      sourceCache: {},
      loadLuminaire: async () => ({ photometric: photoA, source: sourceA }),
    });
    expect(collected.sourceFiles["lum-a"]).toEqual(sourceA);

    const staleBlob = await buildDialuxPack({
      projectName: "Test",
      scene,
      results,
      sourceFiles: {},
      luminaireNames: { "lum-a": "Downlight" },
    });
    const staleZip = await JSZip.loadAsync(await staleBlob.arrayBuffer());
    expect(staleZip.file("luminaires/sample-downlight.ies")).toBeNull();

    const freshBlob = await buildDialuxPack({
      projectName: "Test",
      scene,
      results,
      sourceFiles: collected.sourceFiles,
      luminaireNames: { "lum-a": "Downlight" },
    });
    const freshZip = await JSZip.loadAsync(await freshBlob.arrayBuffer());
    expect(await freshZip.file("luminaires/sample-downlight.ies")!.async("string")).toBe(sourceA.text);
  });
});

describe("Generate LDT library metadata in official export", () => {
  const coneMeta = {
    origin: "library_cone" as const,
    libraryFamily: "circular",
    libraryBeamDeg: 36,
  };

  it("keeps Generate LDT cone metadata from the library cache without refetching", async () => {
    const loadLuminaire = vi.fn(async () => {
      throw new Error("should not refetch complete cache including library metadata");
    });
    const collected = await collectOfficialExportSources({
      luminaireIds: ["lum-a"],
      photoCache: { "lum-a": photoA },
      sourceCache: { "lum-a": sourceA },
      libraryCache: { "lum-a": coneMeta },
      loadLuminaire,
    });
    expect(loadLuminaire).not.toHaveBeenCalled();
    expect(collected.luminaireLibrary["lum-a"]).toEqual(coneMeta);
  });

  it("loads Generate LDT cone metadata when the library cache is missing", async () => {
    const collected = await collectOfficialExportSources({
      luminaireIds: ["lum-a"],
      photoCache: { "lum-a": photoA },
      sourceCache: { "lum-a": sourceA },
      loadLuminaire: async () => ({
        photometric: photoA,
        source: sourceA,
        ...coneMeta,
      }),
    });
    expect(collected.luminaireLibrary["lum-a"]).toEqual(coneMeta);
  });

  it("does not invent Generate LDT cone metadata for a generic upload", async () => {
    const collected = await collectOfficialExportSources({
      luminaireIds: ["lum-a"],
      photoCache: { "lum-a": photoA },
      sourceCache: { "lum-a": sourceA },
      loadLuminaire: async () => ({
        photometric: photoA,
        source: sourceA,
        origin: "upload",
      }),
    });
    expect(collected.luminaireLibrary["lum-a"]).toBeUndefined();
    const project = buildLuxsimProject({
      name: "Upload only",
      scene,
      results,
      photometry: collected.photometry,
      sourceFiles: collected.sourceFiles,
      luminaireLibrary: collected.luminaireLibrary,
    });
    expect(project.luminaireLibrary).toBeUndefined();
    const text = serializeLuxsim(project);
    expect(text).not.toMatch(/library_cone/);
    expect(text).not.toMatch(/libraryFamily/);
    expect(text).not.toMatch(/libraryBeamDeg/);
  });

  it("fails if a Generate LDT cone is exported without its library metadata", async () => {
    const collected = await collectOfficialExportSources({
      luminaireIds: officialExportLuminaireIds(scene),
      photoCache: { "lum-a": photoA },
      sourceCache: { "lum-a": sourceA },
      libraryCache: { "lum-a": coneMeta },
      loadLuminaire: async () => {
        throw new Error("cache should still be valid");
      },
    });
    const project = buildLuxsimProject({
      name: "Cone office",
      scene,
      results,
      photometry: collected.photometry,
      sourceFiles: collected.sourceFiles,
      luminaireLibrary: collected.luminaireLibrary,
    });
    const parsed = parseLuxsim(serializeLuxsim(project));
    expect(parsed.luminaireLibrary?.["lum-a"]).toEqual(coneMeta);
    expect(serializeLuxsim(project)).not.toMatch(/reportWebsite/);
  });
});
