import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { OFFICIAL_WAIT_COPY } from "./official-wait-dialog";
import { formatCalcBusyStatus } from "./editor-calc-rooms";

const editor = readFileSync(
  path.join(process.cwd(), "src/components/editor/BuildingEditor.tsx"),
  "utf8"
);

describe("official Calc storey wiring", () => {
  it("exposes Calc storey beside Calc room and Calc all, gated like them", () => {
    expect(editor).toContain('onClick={() => void runCalc("room")}');
    expect(editor).toContain('onClick={() => void runCalc("storey")}');
    expect(editor).toContain('onClick={() => void runCalc("all")}');
    expect(editor).toContain('"Calc storey"');
    expect(editor).toContain("Calc storey / 計算樓層");
    expect(editor).toContain("formatCalcBusyStatus(scope)");
    expect(editor).toContain("officialWait.run(OFFICIAL_WAIT_COPY.calculating");
    expect(OFFICIAL_WAIT_COPY.calculating).toEqual({
      titleEn: "Calculating…",
      titleZh: "正在計算…",
    });
    expect(formatCalcBusyStatus("storey")).toBe("Calculating storey… / 正在計算樓層…");
    // Still inside the same !readOnly ribbon group as Calc room / Calc all.
    const roomIdx = editor.indexOf('onClick={() => void runCalc("room")}');
    const storeyIdx = editor.indexOf('onClick={() => void runCalc("storey")}');
    const allIdx = editor.indexOf('onClick={() => void runCalc("all")}');
    expect(roomIdx).toBeGreaterThan(-1);
    expect(storeyIdx).toBeGreaterThan(roomIdx);
    expect(allIdx).toBeGreaterThan(storeyIdx);
  });
});
