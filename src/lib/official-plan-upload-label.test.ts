import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  officialFormatPlanUploadAt,
  OFFICIAL_PLAN_UPLOAD_TIME_ZONE,
} from "./official-plan-upload-label";

describe("officialFormatPlanUploadAt", () => {
  it("formats a UTC instant in Asia/Hong_Kong on a 24-hour clock", () => {
    expect(OFFICIAL_PLAN_UPLOAD_TIME_ZONE).toBe("Asia/Hong_Kong");
    expect(officialFormatPlanUploadAt("2026-11-19T08:27:03.458Z")).toBe(
      "19 Nov 2026, 16:27"
    );
    expect(officialFormatPlanUploadAt(new Date("2026-11-19T08:27:03.458Z"))).toBe(
      "19 Nov 2026, 16:27"
    );
  });

  it("returns an empty string for a missing or invalid date", () => {
    expect(officialFormatPlanUploadAt(null)).toBe("");
    expect(officialFormatPlanUploadAt(undefined)).toBe("");
    expect(officialFormatPlanUploadAt("")).toBe("");
    expect(officialFormatPlanUploadAt("not-a-date")).toBe("");
  });
});

describe("official Import plan upload record", () => {
  const editor = readFileSync(
    path.join(process.cwd(), "src/components/editor/BuildingEditor.tsx"),
    "utf8"
  );

  it("shows the imported file name and upload date after import, not only the empty file input", () => {
    const aside = editor.indexOf('data-cad-left-rail=""');
    const buildingTitle = editor.indexOf(
      '<p className="cad-section-title">Building</p>'
    );
    const window = editor.slice(aside, buildingTitle);
    expect(editor).toContain("function renderCurrentPlanFile");
    expect(editor).toContain("officialFormatPlanUploadAt");
    expect(editor).toContain("planAsset.fileName");
    expect(editor).toContain("planAsset.createdAt");
    expect(editor).toMatch(/Uploaded /);
    expect(window).toContain("renderCurrentPlanFile()");
    expect(editor).toMatch(/createdAt\?: string/);
    expect(editor).toContain("officialMetersPerUnitFromAssetMeta(meta) ?? meta.metersPerUnit");
  });
});
