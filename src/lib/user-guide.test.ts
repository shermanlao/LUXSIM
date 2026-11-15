import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { parseUserGuideMarkdown } from "./user-guide-markdown";
import { LINE_ARRAY_PICK_HINT, LINE_ARRAY_SPACING_Y_REASON } from "./line-array-pick";

function read(rel: string) {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("user guide", () => {
  const guide = read("docs/USER_GUIDE.md");
  const blocks = parseUserGuideMarkdown(guide);

  it("is a user-facing manual, not a developer note", () => {
    expect(guide).toMatch(/使用手冊/);
    expect(guide).toMatch(/User guide/);
    expect(guide).not.toMatch(/BuildingEditor/);
    expect(guide).not.toMatch(/tool\.drawRoom/);
    expect(guide).not.toMatch(/parseLengthToM/);
  });

  it("documents wheel zoom, reset, Backspace, and Esc", () => {
    expect(guide).toMatch(/zoom toward the cursor/i);
    expect(guide).toMatch(/以游標位置為中心/);
    expect(guide).toMatch(/The page itself does not scroll/);
    expect(guide).toMatch(/不會捲動整頁/);
    expect(guide).toMatch(/Double-click an empty area/);
    expect(guide).toMatch(/雙擊圖面空白處/);
    expect(guide).toMatch(/Switching storeys also resets/);
    expect(guide).toMatch(/one \*\*Backspace\*\* clears that whole length/);
    expect(guide).toMatch(/按一次 \*\*Backspace\*\* 會整段清掉該長度/);
    expect(guide).toMatch(/The next \*\*Backspace\*\* removes the last corner/);
    expect(guide).toMatch(/\*\*Esc\*\* cancels the draft/);
    expect(guide).toMatch(/畫房途中按 \*\*Esc\*\* 會取消草稿/);
    expect(guide).toMatch(/does not exit the browser/);
    expect(guide).toMatch(/不會因此退出全畫面/);
    expect(guide).toMatch(/When you are not drawing, \*\*Esc\*\* can still exit fullscreen/);
    expect(guide).toMatch(/Origin \(first corner\)/);
    expect(guide).toMatch(/Bounding min/);
    expect(guide).toMatch(/Calibrate scale first/);
    expect(guide).toMatch(/Set \*\*Room height\*\* in the \*\*Building\*\* panel/);
    expect(guide).toMatch(/before you create a room/);
    expect(guide).toMatch(/The field stays visible when no room is selected/);
    expect(guide).toMatch(/未選房間時此欄仍可見/);
    expect(guide).toMatch(/預設 2800/);
    expect(guide).toMatch(/Storey elevation/);
    expect(guide).toMatch(/floor-to-floor spacing \(default 3\.0 m\)/);
    expect(guide).toMatch(/elevation \+ storey height/);
    expect(guide).toMatch(/0\.2 m difference/);
    expect(guide).toMatch(/樓層標高/);
    expect(guide).toMatch(/層高/);
    expect(guide).toMatch(/不會移動其他樓層或既有房間/);
    expect(guide).toMatch(/直線排列 \/ Line array/);
    expect(guide).toMatch(/Click two points/);
    expect(guide).toMatch(/點兩下/);
    expect(guide).toMatch(/second click completes/);
    expect(guide).toMatch(/第二次點擊完成線段/);
    expect(guide).toMatch(/later click starts a new line/);
    expect(guide).toMatch(/再點一下會開始一條新線/);
    expect(guide).toMatch(/\*\*Esc\*\* cancels an unfinished start/);
    expect(guide).toMatch(/未完成起點時按 \*\*Esc\*\*/);
    expect(guide).toMatch(/If you do not pick endpoints/);
    expect(guide).toMatch(/若未點選端點/);
    expect(guide).toMatch(/Spacing Y stays disabled/);
    expect(guide).toMatch(/Spacing Y 在直線模式維持停用/);
    expect(guide).toMatch(/one line only/);
    expect(guide).toMatch(/只沿一條線/);
    expect(guide).toMatch(/scrolls inside the rail/);
    expect(guide).toMatch(/會在欄內捲動/);
    expect(guide).toMatch(/You do not need \*\*Fullscreen\*\* just to see the plan/);
    expect(guide).toMatch(/不必開 Fullscreen/);
    expect(guide).toMatch(/2D and 3D canvas stays fully visible/);
    expect(guide).toMatch(/2D／3D 畫布會留在視窗內完整可見/);
    expect(guide).toMatch(/drag the room fill/);
    expect(guide).toMatch(/拖移該房的填色範圍/);
    expect(guide).toMatch(/Fixtures that belong to that room move with it/);
    expect(guide).toMatch(/該房內的燈具會一併移動/);
    expect(guide).toMatch(/without changing its shape/);
    expect(guide).toMatch(/形狀不變/);
    expect(guide).not.toMatch(/cannot be dragged/i);
    expect(guide).not.toMatch(/不能拖移/);
  });

  it("parses the main headings", () => {
    const headings = blocks.filter((b) => b.type === "h1" || b.type === "h2").map((b) => b.text);
    expect(headings[0]).toMatch(/使用手冊 \/ User guide/);
    expect(headings).toContain("平面圖視野 / Plan view");
    expect(headings).toContain("畫房 / Draw room");
    expect(headings).toContain("樓層標高與層高 / Storey elevation and height");
    expect(headings).toContain("直線排列 / Line array");
    expect(headings).toContain("房間屬性 / Room properties");
    expect(blocks.some((b) => b.type === "ol" && b.items.length >= 6)).toBe(true);
    expect(blocks.some((b) => b.type === "ul")).toBe(true);
  });

  it("is linked from the in-app docs home, guide route, and header nav", () => {
    const docsPage = read("src/app/docs/page.tsx");
    const guidePage = read("src/app/docs/guide/page.tsx");
    const nav = read("src/components/NavAuth.tsx");
    expect(docsPage).toContain('href="/docs/guide"');
    expect(docsPage).toMatch(/使用手冊/);
    expect(guidePage).toContain("docs/USER_GUIDE.md");
    expect(guidePage).toContain("UserGuideArticle");
    expect(nav).toContain('href="/docs/guide"');
    expect(nav).toContain("User guide");
    expect(nav).not.toMatch(/href="\/docs"(?!\/guide)/);
  });

  it("keeps the Draw room help tip in sync with Backspace and Esc", () => {
    const tips = read("src/lib/ui-tips.ts");
    expect(tips).toMatch(/Esc cancels/);
    expect(tips).toMatch(/Backspace clears the typed length in one press, then removes the last corner/);
  });

  it("keeps the rectangle tip in sync with room drag", () => {
    const tips = read("src/lib/ui-tips.ts");
    expect(tips).toContain('helpKey: "tool.drawRect"');
    expect(tips).toMatch(/use Select to drag the room on the Top plan/);
    expect(tips).toMatch(/fixtures in that room follow/);
    expect(tips).not.toMatch(/cannot be dragged/i);
  });

  it("keeps the Line array tip in sync with click-to-pick and disabled Spacing Y", () => {
    const tips = read("src/lib/ui-tips.ts");
    expect(tips).toContain('helpKey: "tool.lineArray"');
    expect(tips).toContain("LINE_ARRAY_PICK_HINT");
    expect(tips).toContain("LINE_ARRAY_SPACING_Y_REASON");
    expect(LINE_ARRAY_PICK_HINT).toMatch(/Click two points on the Top plan/);
    expect(LINE_ARRAY_SPACING_Y_REASON).toMatch(/Spacing Y stays disabled/);
  });
});
