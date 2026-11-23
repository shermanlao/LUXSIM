import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { officialPlanAssetFileUrl } from "./official-content-disposition";

describe("official Import plan download", () => {
  const editor = readFileSync(
    path.join(process.cwd(), "src/components/editor/BuildingEditor.tsx"),
    "utf8"
  );
  const guide = readFileSync(path.join(process.cwd(), "docs/USER_GUIDE.md"), "utf8");

  it("downloads the current underlay asset with the download flag", () => {
    expect(editor).toContain("officialPlanAssetFileUrl");
    expect(editor).toContain("officialPlanAssetFileUrl(assetApiBase, planAsset.id, { download: true })");
    expect(editor).toContain("underlay.assetId");
    expect(editor).toMatch(/Download\s*<\/a>/);
    expect(editor).toContain("function renderCurrentPlanFile");
    expect(editor).toContain("{renderCurrentPlanFile()}");
    expect(editor).toContain("showConstructionPlan && readOnly && underlay");
    // Upload stays hidden in view-only; download is available beside the read-only list.
    expect(editor).toContain("showConstructionPlan && !readOnly");
    expect(officialPlanAssetFileUrl("/api/projects/p", "a1", { download: true })).toContain(
      "?download=1"
    );
    expect(guide).toMatch(/\*\*Download\*\*/);
    expect(guide).toMatch(/already uploaded and stored original file/);
    expect(guide).toMatch(/已上傳並儲存的原檔/);
  });
});
