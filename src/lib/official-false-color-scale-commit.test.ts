import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { OFFICIAL_FALSE_COLOR_SCALE } from "@luxsim/project-io";
import { shouldApplyViewFalseColorScale, falseColorScalesEqual } from "./false-color-scale-commit";
import { OFFICIAL_WAIT_COPY } from "./official-wait-dialog";

const root = path.resolve(__dirname, "../..");
function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("official false-colour scale commit", () => {
  it("keeps the legend live and applies the view scale only when the change is finished", () => {
    expect(falseColorScalesEqual({ minLux: 100, maxLux: 2500 }, { minLux: 100, maxLux: 2500 })).toBe(true);
    expect(shouldApplyViewFalseColorScale({ minLux: 100, maxLux: 2500 }, { minLux: 100, maxLux: 2500 })).toBe(
      false
    );
    expect(shouldApplyViewFalseColorScale({ minLux: 0, maxLux: 2500 }, { minLux: 100, maxLux: 2500 })).toBe(true);
    expect(shouldApplyViewFalseColorScale(OFFICIAL_FALSE_COLOR_SCALE, { minLux: 0, maxLux: 2500 })).toBe(false);

    const legend = read("src/components/editor/FalseColorLegend.tsx");
    expect(legend).toContain("function preview(");
    expect(legend).toContain("function commitDraft(");
    expect(legend).toContain("onChange={(e) => preview(Number(e.target.value), current.maxLux)}");
    expect(legend).toContain("onChange={(e) => preview(current.minLux, Number(e.target.value))}");
    expect(legend).not.toMatch(/onChange=\{\(e\) => commit\(/);
    expect(legend).toContain("onPointerUp={commitDraft}");
    expect(legend).toContain("onPointerCancel={commitDraft}");
    expect(legend).toContain("onKeyUp={commitDraft}");
    expect(legend).toContain("onBlur={commitDraft}");
    expect(legend).toContain('if (e.key === "Enter")');

    const editor = read("src/components/editor/BuildingEditor.tsx");
    expect(editor).toContain("falseColorScale={scale}");
    expect(editor).toContain("commitViewFalseColorScale");
    expect(editor).toContain("onChange={(next) => commitViewFalseColorScale(next, true)}");
    expect(editor).toContain("onReset={() => commitViewFalseColorScale(autoScale, false)}");
    expect(editor).toContain("officialWait.run(OFFICIAL_WAIT_COPY.updatingScale");
    expect(OFFICIAL_WAIT_COPY.updatingScale).toEqual({
      titleEn: "Updating scale…",
      titleZh: "正在更新比例尺…",
    });

    const guide = read("docs/USER_GUIDE.md");
    expect(guide).toMatch(/the bar, gradient ticks, and number fields update immediately/);
    expect(guide).toMatch(/刻度條、色階刻度與數值欄會即時更新/);
    expect(guide).toMatch(/Updating scale…/);
    expect(guide).toMatch(/正在更新比例尺…/);
    expect(guide).toMatch(/When the workplane is hidden, Greyscale, False colour, Isolines, and Value labels stay visible, drawn on the floor/);
    expect(guide).toMatch(/工作面隱藏時，這些照度顯示改畫在地板上/);
  });
});
