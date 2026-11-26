import { describe, expect, it } from "vitest";
import type { PhotometricData } from "@luxsim/photometry";
import {
  LuxsimImportError,
  embedLuxsimAsset,
  missingLuxsimAssetWarning,
  parseLuxsim,
  rectPolygon,
  serializeLuxsim,
  type ProjectSceneV2,
  type ResultsV2,
  type Underlay,
} from "@luxsim/project-io";
import { buildLuxsimProject } from "./exports-client";
import {
  GOLDEN_PROJECT_ID,
  importLuxsimToWorkspace,
  type ImportAssetRow,
  type ImportLuxsimDeps,
  type ImportLuminaireRow,
  type ImportProjectRow,
} from "./import-luxsim";
import { isLibraryCone, LUMINAIRE_ORIGIN_LIBRARY_CONE } from "./luminaire-origin";

function stubPhoto(catalog: string): PhotometricData {
  return {
    format: "ies",
    manufacturer: "Test",
    catalogNumber: catalog,
    description: `Luminaire ${catalog}`,
    luminousFlux: 1500,
    watts: 12,
    lampCount: 1,
    ballastFactor: 1,
    verticalAngles: [0, 90],
    horizontalAngles: [0],
    intensities: [[120, 0]],
    symmetry: "axial",
  };
}

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
        totalWatts: 12,
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

const sourceA = { filename: "sample-downlight.ies", text: "IESNA91\nSOURCE A\n" };

function exportedText(overrides: Partial<Parameters<typeof buildLuxsimProject>[0]> = {}) {
  return serializeLuxsim(
    buildLuxsimProject({
      name: "Round-trip office",
      scene,
      results,
      photometry: { "lum-a": stubPhoto("A") },
      sourceFiles: { "lum-a": sourceA },
      ...overrides,
    })
  );
}

type Memory = {
  deps: ImportLuxsimDeps;
  luminaires: ImportLuminaireRow[];
  files: Record<string, string>;
  binaryFiles: Record<string, Buffer>;
  assets: ImportAssetRow[];
  projects: Array<ImportProjectRow & { id: string }>;
  failProject?: Error;
};

function memoryDeps(
  existing: Array<{ id: string; orgId: string }> = [],
  options: { failProject?: Error } = {}
): Memory {
  const luminaires: ImportLuminaireRow[] = existing.map((row) => ({
    id: row.id,
    orgId: row.orgId,
    name: row.id,
    sourceFormat: "ies",
    fileKey: "",
    originalName: "existing.ies",
    photometricJson: "{}",
    watts: null,
    lumens: null,
  }));
  const files: Record<string, string> = {};
  const binaryFiles: Record<string, Buffer> = {};
  const assets: ImportAssetRow[] = [];
  const projects: Array<ImportProjectRow & { id: string }> = [];
  let n = 0;
  const mem: Memory = {
    luminaires,
    files,
    binaryFiles,
    assets,
    projects,
    failProject: options.failProject,
    deps: {
      findLuminaire: async (id) => {
        const found = luminaires.find((row) => row.id === id);
        return found ? { id: found.id, orgId: found.orgId } : null;
      },
      createLuminaire: async (row) => {
        if (luminaires.some((existingRow) => existingRow.id === row.id)) {
          throw new Error(`duplicate luminaire ${row.id}`);
        }
        luminaires.push(row);
        return { id: row.id };
      },
      deleteLuminaire: async (id) => {
        const index = luminaires.findIndex((row) => row.id === id);
        if (index >= 0) luminaires.splice(index, 1);
      },
      createProject: async (row) => {
        if (mem.failProject) throw mem.failProject;
        n += 1;
        const project = { id: `prj_${n}`, ...row };
        if (project.id === GOLDEN_PROJECT_ID) {
          throw new Error("test assigned the golden id");
        }
        projects.push(project);
        return { id: project.id, name: project.name, orgId: project.orgId };
      },
      saveTextFile: async (category, filename, content) => {
        const key = category === "assets" ? `assets/mem-${filename}` : `luminaires/mem-${filename}`;
        files[key] = content;
        return key;
      },
      saveBinaryFile: async (category, filename, data) => {
        const key = `${category}/mem-${filename}`;
        binaryFiles[key] = Buffer.from(data);
        return key;
      },
      createAsset: async (row) => {
        assets.push(row);
        return { id: row.id };
      },
      deleteAsset: async (id) => {
        const index = assets.findIndex((row) => row.id === id);
        if (index >= 0) assets.splice(index, 1);
      },
      deleteProject: async (id) => {
        const index = projects.findIndex((row) => row.id === id);
        if (index >= 0) projects.splice(index, 1);
        for (let i = assets.length - 1; i >= 0; i--) {
          if (assets[i]?.projectId === id) assets.splice(i, 1);
        }
      },
      removeFile: async (fileKey) => {
        delete files[fileKey];
        delete binaryFiles[fileKey];
      },
    },
  };
  return mem;
}

describe("importLuxsimToWorkspace", () => {
  it("creates a new workspace project whose scene matches a valid exported file", async () => {
    const text = exportedText();
    const parsed = parseLuxsim(text);
    const mem = memoryDeps();
    const imported = await importLuxsimToWorkspace({
      orgId: "org-1",
      text,
      deps: mem.deps,
    });

    expect(imported.project.id).not.toBe(GOLDEN_PROJECT_ID);
    expect(imported.project.orgId).toBe("org-1");
    expect(imported.project.name).toBe("Round-trip office");
    expect(imported.scene.version).toBe(2);
    expect(imported.scene.storeys).toEqual(scene.storeys);
    expect(imported.scene.rooms[0]?.polygon).toEqual(rectPolygon(0, 0, 8, 6));
    expect(imported.scene.instances[0]?.position).toEqual({ x: 4, y: 3, z: 2.7 });
    expect(imported.scene.fixtureCodeMap?.[0]?.codeNorm).toBe("DL1");
    expect(imported.results.byRoomId.r1?.summary.eave).toBe(200);
    expect(imported.warnings).toEqual([]);
    expect(mem.projects).toHaveLength(1);
    expect(mem.projects[0]?.id).not.toBe(GOLDEN_PROJECT_ID);
    expect(JSON.parse(mem.projects[0]!.sceneJson)).toEqual(imported.scene);
    expect(JSON.parse(mem.projects[0]!.resultsJson!)).toEqual(imported.results);
    expect(mem.luminaires).toHaveLength(1);
    expect(mem.luminaires[0]?.id).toBe("lum-a");
    expect(mem.files["luminaires/mem-sample-downlight.ies"]).toBe(sourceA.text);
    expect(JSON.parse(mem.luminaires[0]!.photometricJson).catalogNumber).toBe("A");
    expect(parsed.scene).toMatchObject({
      rooms: scene.rooms,
      instances: scene.instances,
      fixtureCodeMap: scene.fixtureCodeMap,
    });
  });

  it("reuses a luminaire already in the workspace and does not overwrite it", async () => {
    const mem = memoryDeps([{ id: "lum-a", orgId: "org-1" }]);
    const imported = await importLuxsimToWorkspace({
      orgId: "org-1",
      text: exportedText(),
      deps: mem.deps,
    });
    expect(imported.scene.fixtureLibraryIds).toEqual(["lum-a"]);
    expect(mem.luminaires).toHaveLength(1);
    expect(mem.luminaires[0]?.originalName).toBe("existing.ies");
    expect(mem.files).toEqual({});
    expect(mem.projects).toHaveLength(1);
  });

  it("remaps fixture ids when the original luminaire id belongs to another workspace", async () => {
    const mem = memoryDeps([{ id: "lum-a", orgId: "other-org" }]);
    const imported = await importLuxsimToWorkspace({
      orgId: "org-1",
      text: exportedText(),
      deps: mem.deps,
    });
    expect(imported.scene.fixtureLibraryIds[0]).not.toBe("lum-a");
    expect(imported.scene.instances[0]?.luminaireId).toBe(imported.scene.fixtureLibraryIds[0]);
    expect(imported.scene.fixtureCodeMap?.[0]?.luminaireId).toBe(
      imported.scene.fixtureLibraryIds[0]
    );
    expect(imported.scene.rooms).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "r1", name: "Office A" }),
    ]));
    expect(mem.luminaires.filter((row) => row.orgId === "org-1")).toHaveLength(1);
    expect(mem.files["luminaires/mem-sample-downlight.ies"]).toBe(sourceA.text);
  });

  it("warns when the source file is missing, still restores photometry, and does not invent bytes", async () => {
    const mem = memoryDeps();
    const imported = await importLuxsimToWorkspace({
      orgId: "org-1",
      text: exportedText({ sourceFiles: undefined }),
      deps: mem.deps,
    });
    expect(imported.warnings).toEqual([
      "Source file for luminaire lum-a is missing from the file and was not invented.",
    ]);
    expect(mem.luminaires[0]?.photometricJson).toContain("Luminaire A");
    expect(mem.luminaires[0]?.fileKey).toBe("");
    expect(mem.files).toEqual({});
    expect(mem.projects).toHaveLength(1);
  });

  it("rejects an invalid file before writing a project or luminaire", async () => {
    const mem = memoryDeps();
    await expect(
      importLuxsimToWorkspace({
        orgId: "org-1",
        text: JSON.stringify({ format: "luxsim", version: 2, name: "Broken" }),
        deps: mem.deps,
      })
    ).rejects.toBeInstanceOf(LuxsimImportError);
    expect(mem.projects).toEqual([]);
    expect(mem.luminaires).toEqual([]);
    expect(mem.files).toEqual({});
  });

  it("rolls back luminaires and source files if project creation fails", async () => {
    const mem = memoryDeps([], { failProject: new Error("disk full") });
    await expect(
      importLuxsimToWorkspace({
        orgId: "org-1",
        text: exportedText(),
        deps: mem.deps,
      })
    ).rejects.toThrow("disk full");
    expect(mem.projects).toEqual([]);
    expect(mem.luminaires).toEqual([]);
    expect(mem.files).toEqual({});
  });

  it("ignores website fields in the file when creating the project", async () => {
    const mem = memoryDeps();
    const packed = JSON.parse(exportedText()) as Record<string, unknown>;
    packed.website = "https://should-not-import.example";
    packed.reportWebsite = "https://footer.example";
    await importLuxsimToWorkspace({
      orgId: "org-1",
      text: JSON.stringify(packed),
      deps: mem.deps,
    });
    expect(JSON.stringify(mem.projects[0])).not.toContain("should-not-import.example");
    expect(JSON.stringify(mem.projects[0])).not.toContain("footer.example");
  });

  it("restores a Generate LDT cone so the library still recognizes it, including after id remap", async () => {
    const cone = {
      origin: LUMINAIRE_ORIGIN_LIBRARY_CONE,
      libraryFamily: "linear",
      libraryBeamDeg: 120,
    };
    const text = exportedText({ luminaireLibrary: { "lum-a": cone } });
    const parsed = JSON.parse(text) as { luminaireLibrary?: Record<string, unknown> };
    expect(parsed.luminaireLibrary?.["lum-a"]).toEqual(cone);

    const fresh = memoryDeps();
    const imported = await importLuxsimToWorkspace({
      orgId: "org-1",
      text,
      deps: fresh.deps,
    });
    expect(imported.project.id).not.toBe(GOLDEN_PROJECT_ID);
    expect(fresh.luminaires).toHaveLength(1);
    expect(isLibraryCone(fresh.luminaires[0])).toBe(true);
    expect(fresh.luminaires[0]?.origin).toBe(LUMINAIRE_ORIGIN_LIBRARY_CONE);
    expect(fresh.luminaires[0]?.libraryFamily).toBe("linear");
    expect(fresh.luminaires[0]?.libraryBeamDeg).toBe(120);
    expect(fresh.luminaires[0]?.originalName).toBe("sample-downlight.ies");

    const remapped = memoryDeps([{ id: "lum-a", orgId: "other-org" }]);
    const moved = await importLuxsimToWorkspace({
      orgId: "org-1",
      text,
      deps: remapped.deps,
    });
    const created = remapped.luminaires.find((row) => row.orgId === "org-1");
    expect(created).toBeDefined();
    expect(created?.id).not.toBe("lum-a");
    expect(moved.scene.fixtureLibraryIds[0]).toBe(created?.id);
    expect(isLibraryCone(created)).toBe(true);
    expect(created?.libraryFamily).toBe("linear");
    expect(created?.libraryBeamDeg).toBe(120);
  });

  it("still imports an older file that omits luminaireLibrary and does not invent cone metadata", async () => {
    const text = exportedText();
    expect(JSON.parse(text).luminaireLibrary).toBeUndefined();
    expect(text).not.toMatch(/library_cone/);
    const mem = memoryDeps();
    const imported = await importLuxsimToWorkspace({
      orgId: "org-1",
      text,
      deps: mem.deps,
    });
    expect(imported.project.id).not.toBe(GOLDEN_PROJECT_ID);
    expect(imported.scene.rooms[0]?.name).toBe("Office A");
    expect(mem.projects).toHaveLength(1);
    expect(mem.luminaires).toHaveLength(1);
    expect(isLibraryCone(mem.luminaires[0])).toBe(false);
    expect(mem.luminaires[0]?.origin).not.toBe(LUMINAIRE_ORIGIN_LIBRARY_CONE);
    expect(mem.luminaires[0]?.origin).toBeUndefined();
    expect(mem.luminaires[0]?.libraryFamily).toBeUndefined();
    expect(mem.luminaires[0]?.libraryBeamDeg).toBeUndefined();
  });

  it("restores underlay files, calibration, and placement into a clean workspace and remaps asset ids", async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0a, 0xff, 0x00, 0x11]);
    const rasterBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x22, 0x33]);
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]);
    const dxfText = "0\nSECTION\n0\nEOF\n";
    const underlays: Underlay[] = [
      {
        id: "u-img",
        storeyId: "s1",
        assetId: "asset-img",
        kind: "image",
        opacity: 0.6,
        metersPerUnit: 0.03,
        scaleCalibrated: true,
        offsetX: 2.5,
        offsetY: -1.25,
        rotationDeg: 30,
        sourceWidthPx: 400,
        sourceHeightPx: 200,
        flipX: true,
        flipY: false,
      },
      {
        id: "u-pdf",
        storeyId: "s1",
        assetId: "asset-pdf",
        kind: "pdf",
        opacity: 0.8,
        metersPerUnit: 0.01,
        scaleCalibrated: true,
        offsetX: 0.5,
        offsetY: 0.75,
        rotationDeg: 0,
        sourceWidthPx: 800,
        sourceHeightPx: 600,
        pageIndex: 1,
        pageRasterAssetId: "asset-raster",
        rasterDpi: 96,
        pdfPageCount: 3,
      },
      {
        id: "u-dxf",
        storeyId: "s1",
        assetId: "asset-dxf",
        kind: "dxf",
        opacity: 0.9,
        metersPerUnit: 0.001,
        scaleCalibrated: true,
        offsetX: 12,
        offsetY: 8,
        rotationDeg: 0,
        dxfEntities: [{ type: "line", points: [{ x: 0, y: 0 }, { x: 2, y: 0 }] }],
      },
    ];
    const text = exportedText({
      scene: { ...scene, underlays },
      assets: {
        "asset-img": embedLuxsimAsset({ fileName: "plan.png", kind: "image", bytes: pngBytes, metaJson: '{"widthPx":400}' })!,
        "asset-pdf": embedLuxsimAsset({ fileName: "plan.pdf", kind: "pdf", bytes: pdfBytes })!,
        "asset-raster": embedLuxsimAsset({ fileName: "plan-page.png", kind: "image", bytes: rasterBytes })!,
        "asset-dxf": embedLuxsimAsset({ fileName: "plan.dxf", kind: "dxf", text: dxfText })!,
      },
    });
    const mem = memoryDeps();
    const imported = await importLuxsimToWorkspace({
      orgId: "org-1",
      text,
      deps: mem.deps,
    });

    expect(imported.warnings).toEqual([]);
    expect(imported.project.id).not.toBe(GOLDEN_PROJECT_ID);
    expect(mem.assets).toHaveLength(4);
    expect(mem.luminaires).toHaveLength(1);
    expect(mem.files["luminaires/mem-sample-downlight.ies"]).toBe(sourceA.text);

    const image = imported.scene.underlays.find((row) => row.id === "u-img")!;
    const pdf = imported.scene.underlays.find((row) => row.id === "u-pdf")!;
    const dxf = imported.scene.underlays.find((row) => row.id === "u-dxf")!;
    expect(image.kind).toBe("image");
    expect(image.opacity).toBe(0.6);
    expect(image.metersPerUnit).toBe(0.03);
    expect(image.scaleCalibrated).toBe(true);
    expect(image.offsetX).toBe(2.5);
    expect(image.offsetY).toBe(-1.25);
    expect(image.rotationDeg).toBe(30);
    expect(image.flipX).toBe(true);
    expect(image.sourceWidthPx).toBe(400);
    expect(image.sourceHeightPx).toBe(200);
    expect(image.assetId).not.toBe("asset-img");
    expect(pdf.assetId).not.toBe("asset-pdf");
    expect(pdf.pageRasterAssetId).not.toBe("asset-raster");
    expect(pdf.pageRasterAssetId).toBe(
      mem.assets.find((row) => row.fileName === "plan-page.png")?.id
    );
    expect(pdf.pageIndex).toBe(1);
    expect(pdf.rasterDpi).toBe(96);
    expect(dxf.dxfEntities?.[0]?.type).toBe("line");
    expect(dxf.metersPerUnit).toBe(0.001);

    const imgRow = mem.assets.find((row) => row.id === image.assetId);
    const pdfRow = mem.assets.find((row) => row.id === pdf.assetId);
    const rasterRow = mem.assets.find((row) => row.id === pdf.pageRasterAssetId);
    const dxfRow = mem.assets.find((row) => row.id === dxf.assetId);
    expect(imgRow?.kind).toBe("image");
    expect(imgRow?.metaJson).toBe('{"widthPx":400}');
    expect(pdfRow?.kind).toBe("pdf");
    expect(rasterRow?.kind).toBe("image");
    expect(dxfRow?.kind).toBe("dxf");
    expect(Array.from(mem.binaryFiles[imgRow!.fileKey]!)).toEqual(Array.from(pngBytes));
    expect(Array.from(mem.binaryFiles[pdfRow!.fileKey]!)).toEqual(Array.from(pdfBytes));
    expect(Array.from(mem.binaryFiles[rasterRow!.fileKey]!)).toEqual(Array.from(rasterBytes));
    expect(mem.files[dxfRow!.fileKey]).toBe(dxfText);
  });

  it("opens a scene with underlay metadata but no embedded files, warns, and does not invent a drawing", async () => {
    const underlays: Underlay[] = [
      {
        id: "u-img",
        storeyId: "s1",
        assetId: "asset-img",
        kind: "image",
        opacity: 0.7,
        metersPerUnit: 0.02,
        scaleCalibrated: true,
        offsetX: 1,
        offsetY: 2,
        rotationDeg: 0,
        sourceWidthPx: 100,
        sourceHeightPx: 80,
      },
    ];
    const mem = memoryDeps();
    const imported = await importLuxsimToWorkspace({
      orgId: "org-1",
      text: exportedText({ scene: { ...scene, underlays }, assets: undefined }),
      deps: mem.deps,
    });
    expect(imported.warnings).toContain(missingLuxsimAssetWarning("asset-img"));
    expect(imported.scene.underlays[0]?.assetId).toBe("asset-img");
    expect(imported.scene.underlays[0]?.metersPerUnit).toBe(0.02);
    expect(mem.assets).toEqual([]);
    expect(Object.keys(mem.binaryFiles)).toEqual([]);
    expect(mem.projects).toHaveLength(1);
    expect(mem.files["luminaires/mem-sample-downlight.ies"]).toBe(sourceA.text);
  });
});
