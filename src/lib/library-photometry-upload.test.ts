import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  buildPendingPhotometryNames,
  combinePhotometryMessages,
  filterPhotometryFiles,
  formatPhotometryUploadErrors,
  isPhotometryFileName,
  photometryNamePromptShape,
  selectPhotometryFiles,
  uploadPhotometryBatch,
} from "./library-photometry-upload";

const root = path.resolve(__dirname, "../..");

function readSrc(...parts: string[]): string {
  return readFileSync(path.join(root, ...parts), "utf8");
}

function named(name: string) {
  return { name };
}

describe("photometry file filter", () => {
  it("accepts only IES, LDT, and GLDF files, case-insensitively", () => {
    expect(isPhotometryFileName("office.ies")).toBe(true);
    expect(isPhotometryFileName("office.IES")).toBe(true);
    expect(isPhotometryFileName("  downlight.Ldt ")).toBe(true);
    expect(isPhotometryFileName("beam.ldt")).toBe(true);
    expect(isPhotometryFileName("product.gldf")).toBe(true);
    expect(isPhotometryFileName("PRODUCT.GLDF")).toBe(true);
    expect(isPhotometryFileName("notes.txt")).toBe(false);
    expect(isPhotometryFileName("photo.ies.bak")).toBe(false);
    expect(isPhotometryFileName("ldt")).toBe(false);

    const { accepted, rejected } = filterPhotometryFiles([
      named("a.ies"),
      named("b.txt"),
      named("c.LDT"),
      named("d.png"),
      named("e.gldf"),
    ]);
    expect(accepted.map((file) => file.name)).toEqual(["a.ies", "c.LDT", "e.gldf"]);
    expect(rejected.map((file) => file.name)).toEqual(["b.txt", "d.png"]);
  });

  it("does nothing for an empty drop and reports rejected files in a mixed drop", () => {
    expect(selectPhotometryFiles([])).toEqual({
      accepted: [],
      rejected: [],
      prompt: null,
      rejectedMessage: null,
    });
    expect(selectPhotometryFiles(null)).toMatchObject({
      prompt: null,
      rejectedMessage: null,
      accepted: [],
      rejected: [],
    });

    const mixed = selectPhotometryFiles([named("ok.ies"), named("skip.pdf")]);
    expect(mixed.accepted.map((file) => file.name)).toEqual(["ok.ies"]);
    expect(mixed.rejected.map((file) => file.name)).toEqual(["skip.pdf"]);
    expect(mixed.rejectedMessage).toBe("skip.pdf is not an IES, LDT, or GLDF file and was skipped.");
    expect(mixed.prompt?.kind).toBe("single");

    const allBad = selectPhotometryFiles([named("a.png"), named("b.doc")]);
    expect(allBad.prompt).toBeNull();
    expect(allBad.rejectedMessage).toBe(
      "These files are not IES, LDT, or GLDF and were skipped: a.png, b.doc",
    );
  });
});

describe("display-name prompt shape", () => {
  it("builds a single-file prompt with an empty optional display name", () => {
    const prompt = photometryNamePromptShape([named("downlight.ldt")]);
    expect(prompt).toEqual({
      kind: "single",
      items: [{ file: named("downlight.ldt"), fileName: "downlight.ldt", displayName: "" }],
    });
    expect(buildPendingPhotometryNames([named("a.ies")])[0]?.displayName).toBe("");
  });

  it("builds a multi-file prompt listing each filename", () => {
    const prompt = photometryNamePromptShape([named("a.ies"), named("b.ldt")]);
    expect(prompt?.kind).toBe("multi");
    expect(prompt?.items.map((item) => item.fileName)).toEqual(["a.ies", "b.ldt"]);
    expect(prompt?.items.every((item) => item.displayName === "")).toBe(true);
  });
});

describe("photometry batch upload", () => {
  it("continues after a failure, keeps earlier successes, and reports the failed file", async () => {
    const postFile = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, luminaireId: "lum-1" })
      .mockResolvedValueOnce({ ok: false, error: "File too large (max 2MB)" })
      .mockResolvedValueOnce({ ok: true, luminaireId: "lum-3" });

    const outcome = await uploadPhotometryBatch(
      [
        { file: new File(["a"], "a.ies"), fileName: "a.ies", displayName: "A" },
        { file: new File(["b"], "b.ldt"), fileName: "b.ldt", displayName: "" },
        { file: new File(["c"], "c.ies"), fileName: "c.ies", displayName: "C" },
      ],
      postFile,
    );

    expect(postFile).toHaveBeenCalledTimes(3);
    expect(postFile.mock.calls[0]?.[1]).toBe("A");
    expect(postFile.mock.calls[1]?.[1]).toBe("");
    expect(outcome.lastSuccessId).toBe("lum-3");
    expect(outcome.results.map((result) => result.ok)).toEqual([true, false, true]);
    expect(outcome.errorMessage).toBe("b.ldt: File too large (max 2MB)");
    expect(formatPhotometryUploadErrors(outcome.results)).toBe("b.ldt: File too large (max 2MB)");
    expect(combinePhotometryMessages("skip.pdf is not an IES, LDT, or GLDF file and was skipped.", outcome.errorMessage)).toBe(
      "skip.pdf is not an IES, LDT, or GLDF file and was skipped.\nb.ldt: File too large (max 2MB)",
    );
  });
});

describe("LibraryClient photometry upload layout", () => {
  const src = readSrc("src/components/LibraryClient.tsx");
  const dialog = readSrc("src/components/LibraryImportNameDialog.tsx");

  it("removes the Upload photometry section and places the list above Generate LDT", () => {
    expect(src).not.toContain("Upload photometry");
    expect(src.indexOf("<table")).toBeGreaterThan(-1);
    expect(src.indexOf("<GenerateLdtForm")).toBeGreaterThan(src.indexOf("<table"));
    expect(src.indexOf("<GenerateLdtForm")).toBeLessThan(src.indexOf("library-preview-drop"));
  });

  it("keeps Import on the polar preview drop section and accepts multiple IES/LDT/GLDF files", () => {
    const previewStart = src.indexOf("library-preview-drop");
    const preview = src.slice(previewStart);
    expect(preview).toContain("Import");
    expect(preview).toContain("Select a luminaire to preview its polar curve.");
    expect(preview).toContain("PolarPreview");
    expect(preview).toContain('accept=".ies,.ldt,.gldf"');
    expect(preview).toContain("multiple");
    expect(preview).toContain("onDrop={onDrop}");
    expect(preview).toContain("onDragOver={onDragOver}");
    expect(src).toContain("Download .gldf");
    expect(src).toContain("/gldf");
    expect(src).toContain("event.preventDefault()");
    expect(src).toContain("window.addEventListener(\"dragover\"");
    expect(src).toContain("window.addEventListener(\"drop\"");
  });

  it("prompts for display names before upload and can cancel without uploading", () => {
    expect(src).toContain("LibraryImportNameDialog");
    expect(src).toContain("setPending");
    expect(src.indexOf("selectPhotometryFiles")).toBeLessThan(src.indexOf("uploadPhotometryBatch(toUpload"));
    expect(src).toContain("setPending(null)");
    expect(dialog).toContain("Cancel");
    expect(dialog).toContain("Display name (optional)");
    expect(dialog).toContain("item.fileName");
    expect(dialog).toContain('role="dialog"');
    expect(dialog).toContain("onCancel");
  });
});
