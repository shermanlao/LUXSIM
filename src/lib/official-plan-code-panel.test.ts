import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { OFFICIAL_WAIT_COPY } from "./official-wait-dialog";
import { PLAN_CODE_REFUSE_NO_PLAN, PLAN_CODE_REFUSE_NO_LABELS, PLAN_CODE_REFUSE_NO_VISIBLE } from "./plan-code-place";

const root = path.resolve(__dirname, "../..");
function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Place from plan codes editor wiring", () => {
  it("exposes a Light-mode operation next to Detect and schedule import", () => {
    const editor = read("src/components/editor/BuildingEditor.tsx");
    const panel = read("src/components/editor/PlanCodePlacePanel.tsx");
    expect(panel).toContain("Place from plan codes / 按圖則燈碼佈燈");
    expect(panel).toContain("Scan plan codes / 掃描圖則燈碼");
    expect(panel).toContain("Replace prior plan-code fixtures");
    expect(panel).toContain("Calc after commit / 提交後計算");
    expect(panel).not.toMatch(/DIALux/i);
    expect(editor).toContain("PlanCodePlacePanel");
    expect(editor).toContain("workflow === \"light\" && !readOnly");
    expect(editor).toContain("officialWait.run(OFFICIAL_WAIT_COPY.scanningPlanCodes");
    expect(editor).toContain("officialWait.run(OFFICIAL_WAIT_COPY.committingPlanCodes");
    expect(editor).toContain("PLAN_CODE_REFUSE_NO_PLAN");
    expect(editor).toContain("/plan-text-labels");
    expect(editor).toContain("requestFixtureWrite");
    expect(OFFICIAL_WAIT_COPY.scanningPlanCodes).toEqual({
      titleEn: "Scanning plan codes…",
      titleZh: "正在掃描圖則燈碼…",
    });
    expect(OFFICIAL_WAIT_COPY.committingPlanCodes.titleZh).toBe("正在按圖則燈碼放置燈具…");
    expect(PLAN_CODE_REFUSE_NO_PLAN).toMatch(/DXF/);
    expect(PLAN_CODE_REFUSE_NO_LABELS).toMatch(/燈碼/);
    expect(PLAN_CODE_REFUSE_NO_VISIBLE).toMatch(/可見圖層/);
  });
});
