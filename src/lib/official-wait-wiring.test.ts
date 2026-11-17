import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { OFFICIAL_WAIT_COPY } from "./official-wait-dialog";

const root = path.resolve(__dirname, "../..");
function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("official wait dialog wiring", () => {
  it("shows the reusable dialog for official slow editor and project operations", () => {
    const editor = read("src/components/editor/BuildingEditor.tsx");
    expect(editor).toContain("useOfficialWaitDialog");
    expect(editor).toContain("{officialWait.dialog}");
    expect(editor).toContain("officialWait.run(OFFICIAL_WAIT_COPY.calculating");
    expect(editor).toContain("officialWait.run(OFFICIAL_WAIT_COPY.exportingPdf");
    expect(editor).toContain("officialWait.run(OFFICIAL_WAIT_COPY.importingPlan");
    expect(editor).toContain("officialWait.run(OFFICIAL_WAIT_COPY.rasterizingPdf");
    expect(editor).toContain("officialWait.run(OFFICIAL_WAIT_COPY.importingPhotometry");
    expect(editor).toContain("officialWait.run(OFFICIAL_WAIT_COPY.saving");
    expect(editor).toContain("officialWait.run(OFFICIAL_WAIT_COPY.detectingCodes");
    expect(editor).toContain("officialWait.run(OFFICIAL_WAIT_COPY.committingRcp");
    expect(editor).toContain("officialWait.run(OFFICIAL_WAIT_COPY.importingSchedule");
    expect(editor).toContain("officialWait.run(OFFICIAL_WAIT_COPY.placingFixtures");
    expect(editor).toContain("officialWait.run(OFFICIAL_WAIT_COPY.creatingRoomsFromDxf");
    expect(editor).toContain("officialWait.run(OFFICIAL_WAIT_COPY.exportingVerification");
    expect(editor).toContain("officialWait.run(OFFICIAL_WAIT_COPY.savingProjectFile");
    expect(editor).toContain("<OfficialWaitDialog {...OFFICIAL_WAIT_COPY.loading3d} />");
    // Live interactions must not be gated by the modal.
    expect(editor).not.toMatch(/officialWait\.run\([^)]*pan/i);
    expect(editor).not.toMatch(/officialWait\.show\(/);

    const create = read("src/components/CreateProjectButton.tsx");
    expect(create).toContain("OfficialWaitDialog");
    expect(create).toContain("OFFICIAL_WAIT_COPY.creatingProject");
    expect(create).toContain("OFFICIAL_WAIT_COPY.openingProjectFile");
    expect(create).toContain("ProjectLoadingDialog");

    const library = read("src/components/LibraryClient.tsx");
    expect(library).toContain("OfficialWaitDialog");
    expect(library).toContain("OFFICIAL_WAIT_COPY.importingPhotometry");

    const ldt = read("src/components/GenerateLdtForm.tsx");
    expect(ldt).toContain("OfficialWaitDialog");
    expect(ldt).toContain("OFFICIAL_WAIT_COPY.generatingLdt");

    expect(OFFICIAL_WAIT_COPY.creatingProject.titleEn).toBe("Creating project…");
    expect(OFFICIAL_WAIT_COPY.openingProjectFile.titleZh).toBe("正在開啟專案檔…");
  });
});
