import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  canUseOfficialSavePicker,
  officialSaveBlob,
  OFFICIAL_SAVE_TYPES,
  type OfficialSavePicker,
} from "./official-save-file";

const root = path.resolve(__dirname, "../..");

describe("official save-path dialog", () => {
  it("writes through the save picker when the user chooses a path", async () => {
    const writable = { write: vi.fn(async () => {}), close: vi.fn(async () => {}) };
    const picker: OfficialSavePicker = vi.fn(async () => ({
      createWritable: async () => writable,
    }));
    const download = vi.fn();
    const blob = new Blob(["pdf"], { type: "application/pdf" });
    const result = await officialSaveBlob(blob, {
      suggestedName: "Office-report.pdf",
      types: [OFFICIAL_SAVE_TYPES.pdf],
      host: { showSaveFilePicker: picker, download },
    });
    expect(result).toBe("saved");
    expect(picker).toHaveBeenCalledTimes(1);
    expect(writable.write).toHaveBeenCalledWith(blob);
    expect(writable.close).toHaveBeenCalledTimes(1);
    expect(download).not.toHaveBeenCalled();
  });

  it("does not write a file when the user cancels the path dialog", async () => {
    const picker: OfficialSavePicker = vi.fn(async () => {
      const error = new Error("The user aborted a request.");
      error.name = "AbortError";
      throw error;
    });
    const download = vi.fn();
    const result = await officialSaveBlob(new Blob(["x"]), {
      suggestedName: "Office.lxm",
      types: [OFFICIAL_SAVE_TYPES.lxm],
      host: { showSaveFilePicker: picker, download },
    });
    expect(result).toBe("cancelled");
    expect(download).not.toHaveBeenCalled();
  });

  it("falls back to a download when a save picker is not available", async () => {
    const download = vi.fn();
    const blob = new Blob(["zip"]);
    const result = await officialSaveBlob(blob, {
      suggestedName: "Office-verification-pack.zip",
      types: [OFFICIAL_SAVE_TYPES.zip],
      host: { download },
    });
    expect(canUseOfficialSavePicker(undefined)).toBe(false);
    expect(result).toBe("downloaded");
    expect(download).toHaveBeenCalledWith(blob, "Office-verification-pack.zip");
  });

  it("wires the official exports to the save-path dialog", () => {
    const editor = readFileSync(path.join(root, "src/components/editor/BuildingEditor.tsx"), "utf8");
    expect(editor).toContain("officialSaveBlob");
    expect(editor).toContain("OFFICIAL_SAVE_TYPES.pdf");
    const exportsClient = readFileSync(path.join(root, "src/lib/exports-client.ts"), "utf8");
    expect(exportsClient).toContain("OFFICIAL_SAVE_TYPES.lxm");
    expect(exportsClient).toContain("OFFICIAL_SAVE_TYPES.zip");
    const ldt = readFileSync(path.join(root, "src/lib/generate-ldt-download.ts"), "utf8");
    expect(ldt).toContain("officialSaveBlob");
    expect(ldt).toContain("OFFICIAL_SAVE_TYPES.ldt");
  });
});
