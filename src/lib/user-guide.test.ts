import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { parseUserGuideMarkdown } from "./user-guide-markdown";
import { LINE_ARRAY_PICK_HINT, LINE_ARRAY_SPACING_Y_REASON } from "./line-array-pick";
import {
  CIRCLE_ARRAY_PICK_HINT,
  CIRCLE_ARRAY_ROTATION_REASON,
  CIRCLE_ARRAY_UNUSED_FIELDS_REASON,
} from "./circle-array-pick";
import {
  POLYGON_ARRAY_HINT,
  POLYGON_ARRAY_ROTATION_REASON,
  POLYGON_ARRAY_UNUSED_FIELDS_REASON,
} from "./polygon-array";

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
    expect(guide).toMatch(/every room on that storey/);
    expect(guide).toMatch(/該層所有房間/);
    expect(guide).toMatch(/A click without movement on a room still selects that room/);
    expect(guide).toMatch(/點一下房間而未拖移，仍會改為選取該房間/);
  });

  it("parses the main headings", () => {
    const headings = blocks.filter((b) => b.type === "h1" || b.type === "h2").map((b) => b.text);
    expect(headings[0]).toMatch(/使用手冊 \/ User guide/);
    expect(headings).toContain("平面圖視野 / Plan view");
    expect(headings).toContain("畫房 / Draw room");
    expect(headings).toContain("樓層標高與層高 / Storey elevation and height");
    expect(headings).toContain("直線排列 / Line array");
    expect(headings).toContain("圓形排列 / Circular array");
    expect(headings).toContain("多邊形排列 / Polygon array");
    expect(headings).toContain("等照度線與數值圖 / Isolines and value labels");
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
    expect(tips).toMatch(/storey is selected in Building/);
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

  it("keeps the Circular array tip and guide in sync with centre pick, radius, and rotation", () => {
    const tips = read("src/lib/ui-tips.ts");
    expect(guide).toMatch(/圓形排列 \/ Circular array/);
    expect(guide).toMatch(/Click once on the \*\*Top\*\* or \*\*Bottom\*\* plan to set the circle centre/);
    expect(guide).toMatch(/在 \*\*Top\*\* 或 \*\*Bottom\*\* 平面圖上點一下，設定圓心/);
    expect(guide).toMatch(/later click replaces the centre/);
    expect(guide).toMatch(/再點一下會改設圓心/);
    expect(guide).toMatch(/\*\*Esc\*\* cancels an unwanted centre pick/);
    expect(guide).toMatch(/按 \*\*Esc\*\* 會取消已選圓心/);
    expect(guide).toMatch(/If you do not pick a centre/);
    expect(guide).toMatch(/若未點選圓心/);
    expect(guide).toMatch(/not aimed at the centre/);
    expect(guide).toMatch(/不會自動指向圓心/);
    expect(guide).toMatch(/Spacing X, Spacing Y and wall offset stay disabled/);
    expect(guide).toMatch(/Spacing X、Spacing Y 與離牆在圓形模式維持停用/);
    expect(tips).toContain('helpKey: "tool.circleArray"');
    expect(tips).toContain("CIRCLE_ARRAY_PICK_HINT");
    expect(tips).toContain("CIRCLE_ARRAY_UNUSED_FIELDS_REASON");
    expect(tips).toContain("CIRCLE_ARRAY_ROTATION_REASON");
    expect(CIRCLE_ARRAY_PICK_HINT).toMatch(/Click once on the Top plan/);
    expect(CIRCLE_ARRAY_UNUSED_FIELDS_REASON).toMatch(/stay disabled/);
    expect(CIRCLE_ARRAY_ROTATION_REASON).toMatch(/not aimed at the centre/);
  });

  it("keeps the Polygon array tip and guide in sync with room-outline placement and rotation", () => {
    const tips = read("src/lib/ui-tips.ts");
    expect(guide).toMatch(/多邊形排列 \/ Polygon array/);
    expect(guide).toMatch(/choose \*\*Polygon\*\* in \*\*Arrange\*/);
    expect(guide).toMatch(/再開右側 \*\*Arrange\*\* 的 \*\*Polygon\*\*（多邊形）/);
    expect(guide).toMatch(/official closed outline/);
    expect(guide).toMatch(/官方封閉輪廓/);
    expect(guide).toMatch(/first corner \(Origin\)/);
    expect(guide).toMatch(/第一個角點（Origin）/);
    expect(guide).toMatch(/perimeter divided by \*\*Count\*/);
    expect(guide).toMatch(/周長除以 \*\*Count\*/);
    expect(guide).toMatch(/do not coincide on the closing vertex/);
    expect(guide).toMatch(/不會重疊在閉合頂點上/);
    expect(guide).toMatch(/sits at the first corner/);
    expect(guide).toMatch(/放在第一個角點/);
    expect(guide).toMatch(/fixture orientation/);
    expect(guide).toMatch(/燈具朝向/);
    expect(guide).toMatch(/not aimed along the tangent or inward/);
    expect(guide).toMatch(/不會自動沿切線或指向室內/);
    expect(guide).toMatch(/Spacing X, Spacing Y and wall offset stay disabled/);
    expect(guide).toMatch(/Spacing X、Spacing Y 與離牆在多邊形模式維持停用/);
    expect(guide).toMatch(/If you do not pick a custom path/);
    expect(guide).toMatch(/若未點選自訂路徑/);
    expect(guide).toMatch(/Clear path/);
    expect(guide).toMatch(/custom path/);
    expect(tips).toContain('helpKey: "tool.polygonArray"');
    expect(tips).toContain("POLYGON_ARRAY_HINT");
    expect(tips).toContain("POLYGON_ARRAY_UNUSED_FIELDS_REASON");
    expect(tips).toContain("POLYGON_ARRAY_ROTATION_REASON");
    expect(POLYGON_ARRAY_HINT).toMatch(/closed outline/);
    expect(POLYGON_ARRAY_UNUSED_FIELDS_REASON).toMatch(/stay disabled/);
    expect(POLYGON_ARRAY_ROTATION_REASON).toMatch(/not aimed along the tangent or inward/);
  });

  it("documents official DXF object snap on Top/Bottom picks", () => {
    expect(guide).toMatch(/snap to endpoints, midpoints, and the nearest point on a segment within 8 CSS pixels/i);
    expect(guide).toMatch(/吸附到線段端點、中點，或線段上最近的一點/);
    expect(guide).toMatch(/8 個 CSS 像素/);
    expect(guide).toMatch(/Auto-converting DXF entities into rooms is not included/);
    expect(guide).toMatch(/不包括由 DXF 自動建立房間/);
    expect(guide).toMatch(/Image and PDF underlays do not get raster snap/);
    expect(guide).toMatch(/圖像或 PDF 底圖不會做像素吸附/);
    expect(guide).toMatch(/DWG is not parsed and is not snappable/);
    const tips = read("src/lib/ui-tips.ts");
    expect(tips).toMatch(/With a DXF underlay, official Top\/Bottom picks snap to endpoints/);
  });

  it("documents isolines and value labels on the plan, in 3D, and in the official PDF", () => {
    expect(guide).toMatch(/等照度線與數值圖 \/ Isolines and value labels/);
    expect(guide).toMatch(/switch between \*\*False colour\*\* and \*\*Isolines\*/);
    expect(guide).toMatch(/切換 \*\*False colour\*\*（偽色）和 \*\*Isolines\*\*（等照度線）/);
    expect(guide).toMatch(/tick \*\*Value labels\*/);
    expect(guide).toMatch(/勾選 \*\*Value labels\*\*（數值圖）/);
    expect(guide).toMatch(/On the \*\*3D\*\* view/);
    expect(guide).toMatch(/在 \*\*3D\*\* 視圖/);
    expect(guide).toMatch(/do not invent numbers/);
    expect(guide).toMatch(/不會發明數字/);
    expect(guide).toMatch(/run \*\*Calculate\*\* first/);
    expect(guide).toMatch(/先執行 \*\*Calculate\*/);
    expect(guide).toMatch(/Full PDF report/);
    expect(guide).toMatch(/if 3D views cannot be captured/);
    expect(guide).toMatch(/即使 3D 視圖未能擷取/);
    expect(guide).toMatch(/does not add a separate 3D-isoline chapter/);
    expect(guide).toMatch(/不會另增一章 3D 等照度線/);
    const tips = read("src/lib/ui-tips.ts");
    expect(tips).toContain('helpKey: "view.planIsolux"');
    expect(tips).toContain("PLAN_ISOLUX_HINT");
  });
});
