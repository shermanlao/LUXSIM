import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@luxsim/project-io", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@luxsim/project-io")>();
  return { ...actual, downloadBlob: vi.fn() };
});

import {
  downloadBlob,
  LUXSIM_PROJECT_FILE_ACCEPT,
  LUXSIM_PROJECT_MIME,
  isLuxsimProjectFilename,
  luxsimProjectDownloadName,
  prepareLuxsimImport,
  serializeLuxsim,
  type LuxsimProjectFile,
} from "@luxsim/project-io";
import { buildLuxsimProject, exportLuxsimFile } from "./exports-client";
import { missingExportSourceStatus } from "./export-source-files";

const root = path.resolve(__dirname, "../..");

function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

function sampleProject(): LuxsimProjectFile {
  return buildLuxsimProject({
    name: "Sample office",
    scene: {
      version: 2,
      storeys: [{ id: "s1", name: "GF", elevationM: 0, heightM: 3 }],
      rooms: [],
      underlays: [],
      fixtureLibraryIds: [],
      instances: [],
    },
    results: { version: 2, byRoomId: {} },
    photometry: {},
  });
}

describe("official project file extension in the app", () => {
  afterEach(() => {
    vi.mocked(downloadBlob).mockClear();
  });

  it("saves the official project as ProjectName.lux without changing the JSON format", () => {
    const project = sampleProject();
    exportLuxsimFile(project);
    expect(luxsimProjectDownloadName(project.name)).toBe("Sample_office.lux");
    expect(downloadBlob).toHaveBeenCalledOnce();
    const [filename, blob] = vi.mocked(downloadBlob).mock.calls[0]!;
    expect(filename).toBe("Sample_office.lux");
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe(LUXSIM_PROJECT_MIME);
    expect(blob.type).toBe("application/json");
    expect(JSON.parse(serializeLuxsim(project)).format).toBe("luxsim");
  });

  it("opens the same project format from .lux and .luxsim files", () => {
    const text = serializeLuxsim(sampleProject());
    const dir = mkdtempSync(path.join(os.tmpdir(), "luxsim-ext-"));
    const luxPath = path.join(dir, "Sample_office.lux");
    const legacyPath = path.join(dir, "Sample_office.luxsim");
    writeFileSync(luxPath, text);
    writeFileSync(legacyPath, text);
    expect(isLuxsimProjectFilename(luxPath)).toBe(true);
    expect(isLuxsimProjectFilename(legacyPath)).toBe(true);
    expect(prepareLuxsimImport(readFileSync(luxPath, "utf8"))).toEqual(
      prepareLuxsimImport(readFileSync(legacyPath, "utf8"))
    );
  });

  it("labels official save/open controls .lux and accepts legacy .luxsim files", () => {
    const editor = read("src/components/editor/BuildingEditor.tsx");
    const create = read("src/components/CreateProjectButton.tsx");
    const route = read("src/app/api/projects/import-luxsim/route.ts");
    const exportsClient = read("src/lib/exports-client.ts");

    expect(editor).toContain("Save .lux");
    expect(editor).not.toContain("Save .luxsim");
    expect(create).toContain("Open .lux");
    expect(create).not.toContain("Open .luxsim");
    expect(create).toContain("LUXSIM_PROJECT_FILE_ACCEPT");
    expect(LUXSIM_PROJECT_FILE_ACCEPT).toContain(".lux");
    expect(LUXSIM_PROJECT_FILE_ACCEPT).toContain(".luxsim");
    expect(LUXSIM_PROJECT_FILE_ACCEPT).toContain(".luxsim.json");
    expect(LUXSIM_PROJECT_FILE_ACCEPT).toContain("application/json");
    expect(exportsClient).toContain("luxsimProjectDownloadName");
    expect(exportsClient).not.toContain(".luxsim.json");
    expect(route).toContain("A LUXSIM .lux or .luxsim file is required");
    expect(route).not.toContain("A LUXSIM .luxsim.json file is required");
    expect(
      missingExportSourceStatus("luxsim", ["lum-a"], { "lum-a": "Downlight" })
    ).toBe(
      ".lux downloaded, but original IES/LDT files are missing for: Downlight. The file is incomplete."
    );
  });
});
