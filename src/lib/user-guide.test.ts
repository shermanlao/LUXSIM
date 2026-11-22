import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { filterGuideBlocks, localizeGuideHeading, parseUserGuideMarkdown } from "./user-guide-markdown";
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


  it("documents DWG conversion and Import plan at the top of the left panel", () => {
    expect(guide).toMatch(/Import plan\*\* is at the top of the left panel/);
    expect(guide).toMatch(/左側面板最上方是 \*\*Import plan\*\*/);
    expect(guide).toMatch(/In view-only, Import plan stays hidden/);
    expect(guide).toMatch(/唯讀檢視時，\*\*Import plan\*\* 會隱藏/);
    expect(guide).toMatch(/Plan layers/);
    expect(guide).toMatch(/1\.5 mm/);
    expect(guide).toMatch(/128×/);
    expect(guide).toMatch(/A DWG import is converted and then works like a DXF underlay/);
    expect(guide).toMatch(/匯入 DWG 後會轉換成與 DXF 相同的描線/);
    expect(guide).not.toMatch(/DWG is not parsed/);
    expect(guide).not.toMatch(/不會解析 DWG/);
    expect(guide).not.toMatch(/DIALux/);
    expect(guide).not.toMatch(/conversion is not available in this build/);
  });

  it("documents Draw storey contour, Undo and Redo, and plan layer Apply", () => {
    expect(guide).toMatch(/Draw storey contour/);
    expect(guide).toMatch(/樓層輪廓/);
    expect(guide).toMatch(/The contour is not a room/);
    expect(guide).toMatch(/輪廓不是房間/);
    expect(guide).toMatch(/\*\*Undo\*\* and \*\*Redo\*\* buttons/);
    expect(guide).toMatch(/\*\*Undo\*\* 與 \*\*Redo\*\* 按鈕/);
    expect(guide).toMatch(/12 CSS pixels/);
    expect(guide).toMatch(/12 個 CSS 像素/);
  });

  it("documents wheel zoom, reset, Backspace, and Esc", () => {
    expect(guide).toMatch(/zoom \(toward the cursor on the plan and elevation views\)/i);
    expect(guide).toMatch(/以游標位置為中心/);
    expect(guide).toMatch(/The page itself does not scroll/);
    expect(guide).toMatch(/不會捲動整頁/);
    expect(guide).toMatch(/middle mouse button/i);
    expect(guide).toMatch(/滑鼠中鍵/);
    expect(guide).toMatch(/Do not pan with the left button/);
    expect(guide).toMatch(/不要用左鍵平移/);
    expect(guide).toMatch(/\*\*Front\*\*/);
    expect(guide).toMatch(/\*\*Side\*\*/);
    expect(guide).toMatch(/\*\*3D\*\*/);
    expect(guide).toMatch(/floating controls/);
    expect(guide).toMatch(/浮在圖面左上角/);
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
    expect(guide).toMatch(/Rooms cannot be dragged as a whole/);
    expect(guide).toMatch(/不能整間拖移/);
    expect(guide).toMatch(/storey cannot be dragged on the plan/);
    expect(guide).toMatch(/整層也不能用拖曳來平移/);
    expect(guide).toMatch(/corner handle/);
    expect(guide).toMatch(/角點控制點/);
    expect(guide).toMatch(/middle mouse button/);
    expect(guide).toMatch(/滑鼠中鍵/);
  });

  it("parses the main headings", () => {
    const headings = blocks.filter((b) => b.type === "h1" || b.type === "h2").map((b) => b.text);
    expect(headings[0]).toMatch(/使用手冊 \/ User guide/);
    expect(headings).toContain("工作區名稱 / Workspace name");
    expect(headings).toContain("平面圖視野 / Plan view");
    expect(headings).toContain("畫房 / Draw room");
    expect(headings).toContain("樓層輪廓 / Draw storey contour");
    expect(headings).toContain("復原與重做 / Undo and Redo");
    expect(headings).toContain("樓層標高與層高 / Storey elevation and height");
    expect(headings).toContain("按圖則燈碼佈燈 / Place from plan codes");
    expect(headings).toContain("直線排列 / Line array");
    expect(headings).toContain("圓形排列 / Circular array");
    expect(headings).toContain("多邊形排列 / Polygon array");
    expect(headings).toContain("自動佈燈 / Automatic placement");
    expect(headings).toContain("計算樓層 / Calc storey");
    expect(headings).toContain("等照度線與數值圖 / Isolines and value labels");
    expect(headings).toContain("房間屬性 / Room properties");
    expect(headings).toContain("燈具庫 / Luminaire library");
    expect(blocks.some((b) => b.type === "ol" && b.items.length >= 6)).toBe(true);
    expect(blocks.some((b) => b.type === "ul")).toBe(true);
  });

  it("documents Place from plan codes in Light mode", () => {
    expect(guide).toMatch(/按圖則燈碼佈燈 \/ Place from plan codes/);
    expect(guide).toMatch(/\*\*Place from plan codes\*\*/);
    expect(guide).toMatch(/\*\*Scan plan codes\*\*/);
    expect(guide).toMatch(/掃描圖則燈碼/);
    expect(guide).toMatch(/it does not change rooms/i);
    expect(guide).toMatch(/房間不會被改動|不會改動房間/);
    expect(guide).toMatch(/Accepted but unmapped or ambiguous rows block commit/);
    expect(guide).toMatch(/已接受但未對應或多項匹配的列會阻止提交/);
    expect(guide).toMatch(/Points outside every room on the current storey are skipped/);
    expect(guide).toMatch(/落在本層任何房間之外的點會略過/);
    expect(guide).toMatch(/Replace prior plan-code fixtures/);
    expect(guide).toMatch(/取代先前按燈碼佈置的燈具|Replace prior plan-code fixtures\*\*（預設關閉）/);
    expect(guide).toMatch(/hidden on a view-only project/i);
    expect(guide).toMatch(/唯讀專案會隱藏此操作/);
    expect(guide).toMatch(/Detect from plan/);
    expect(guide).toMatch(/Import schedule/);
    expect(guide).not.toMatch(/DIALux/);
  });

  it("documents that only a workspace Owner can rename the workspace", () => {
    expect(guide).toMatch(/工作區的 Owner 可在 \[Workspace members\]\(\/workspace\/members\) 頁將工作區重新命名/);
    expect(guide).toMatch(/按名稱旁的鉛筆圖示/);
    expect(guide).toMatch(/Click the pencil icon next to the name/);
    expect(guide).toMatch(/Member 不能更改工作區名稱，也打不開此頁/);
    expect(guide).toMatch(/The workspace Owner can rename the workspace on the \[Workspace members\]\(\/workspace\/members\) page/);
    expect(guide).toMatch(/Members cannot rename the workspace, and they cannot open this page/);
    expect(guide).not.toMatch(/\bHost\b/);

    const admin = read("docs/ADMIN.md");
    expect(admin).toMatch(/rename the workspace on the Workspace members page/);
    expect(admin).toMatch(/They cannot rename the workspace/);
    expect(admin).not.toMatch(/\bHost\b/);
  });

  it("documents library photometry drop, display names, and multi-file import", () => {
    expect(guide).toMatch(/燈具庫 \/ Luminaire library/);
    expect(guide).toMatch(/可把一個或多個 IES、LDT 或 GLDF/);
    expect(guide).toMatch(/或按該區上的 \*\*Import\*\* 選擇檔案/);
    expect(guide).toMatch(/單檔時可選填一個 \*\*Display name\*\*/);
    expect(guide).toMatch(/多檔時每個 IES、LDT 或 GLDF 各有一列/);
    expect(guide).toMatch(/drop one or more IES, LDT, or GLDF/);
    expect(guide).toMatch(/Download \.gldf/);
    expect(guide).toMatch(/IES、LDT 或 GLDF/);
    expect(guide).toMatch(/\*\*Download \.gldf\*\*/);
    expect(guide).toMatch(/\*\*Import\*\* button on the same section/);
    expect(guide).toMatch(/For more than one file, each IES, LDT, or GLDF has its own \*\*Display name\*\* field/);
    expect(guide).toMatch(/If one file in a batch fails, already-imported files are kept/);
    expect(guide).not.toMatch(/Upload photometry/);
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

  it("keeps the rectangle tip in sync with corner handles and no fill drag", () => {
    const tips = read("src/lib/ui-tips.ts");
    expect(tips).toContain('helpKey: "tool.drawRect"');
    expect(tips).toMatch(/corner handle/);
    expect(tips).toMatch(/not translated by dragging the fill/);
    expect(tips).toMatch(/Select \/ move/);
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
    expect(guide).toMatch(/Click once on the \*\*Top\*\* plan to set the circle centre/);
    expect(guide).toMatch(/在 \*\*Top\*\* 平面圖上點一下，設定圓心/);
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

  it("documents Automatic placement in Light mode Arrange", () => {
    const tips = read("src/lib/ui-tips.ts");
    expect(guide).toMatch(/自動佈燈 \/ Automatic placement/);
    expect(guide).toMatch(/choose \*\*Automatic placement\*\* in \*\*Arrange\*/);
    expect(guide).toMatch(/再開右側 \*\*Arrange\*\* 的 \*\*Automatic placement\*\*（自動佈燈）/);
    expect(guide).toMatch(/hidden on a view-only project/i);
    expect(guide).toMatch(/唯讀專案會隱藏此操作/);
    expect(guide).toMatch(/lumen method/i);
    expect(guide).toMatch(/流明法/);
    expect(guide).toMatch(/S\/Hm/);
    expect(guide).toMatch(/距高比/);
    expect(guide).toMatch(/L-shaped/);
    expect(guide).toMatch(/L 形/);
    expect(guide).toMatch(/Planning automatic placement…/);
    expect(guide).toMatch(/正在規劃自動佈燈…/);
    expect(guide).toMatch(/Estimate only/);
    expect(guide).toMatch(/僅供估算/);
    expect(guide).toMatch(/not a substitute for \*\*Calc\*/);
    expect(guide).toMatch(/不能代替 \*\*Calc\*/);
    expect(guide).not.toMatch(/DIALux/);
    expect(tips).toContain('helpKey: "tool.automaticPlacement"');
    expect(tips).toContain("AUTOMATIC_PLACEMENT_HINT");
  });

  it("documents official DXF object snap on Top picks", () => {
    expect(guide).toMatch(/snap to endpoints, midpoints, and the nearest point on a segment within 8 CSS pixels/i);
    expect(guide).toMatch(/吸附到線段端點、中點，或線段上最近的一點/);
    expect(guide).toMatch(/8 個 CSS 像素/);
    expect(guide).toMatch(/Create rooms from DXF\*\* makes rooms from closed polylines, from simple closed loops of connected lines, and from each minimal room face in a T-junction or shared-wall network/);
    expect(guide).toMatch(/Create rooms from DXF\*\* 為每條封閉折線、由相連線段組成的簡單閉合迴路，以及 T 形交匯或共用牆網絡中的每個最小房間面，在該層各建立一間房間/);
    expect(guide).toMatch(/if one room lies fully inside another with no connecting wall, only the inner room is kept/);
    expect(guide).toMatch(/若一間房完全落在另一間之內且沒有連牆，只保留內房/);
    expect(guide).toMatch(/Image and PDF underlays do not get raster snap/);
    expect(guide).toMatch(/圖像或 PDF 底圖不會做像素吸附/);
    expect(guide).toMatch(/A DWG import is converted and then works like a DXF underlay/);
    expect(guide).toMatch(/匯入的 DWG 會先轉換成與 DXF 相同的描線，之後可顯示、吸附/);
    expect(guide).not.toMatch(/DWG is not parsed/);
    expect(guide).not.toMatch(/不會解析 DWG/);
    const tips = read("src/lib/ui-tips.ts");
    expect(tips).toMatch(/With a DXF underlay, or a converted DWG underlay, official Top picks snap to endpoints/);
  });

  it("documents official Calibrate scale on a DXF underlay", () => {
    expect(guide).toMatch(/uses the drawing’s declared units \(for example millimetres\)/);
    expect(guide).toMatch(/shows the file name and the upload date and time \(Hong Kong time\)/);
    expect(guide).toMatch(/若圖紙標明單位（例如公釐），會自動換成公尺/);
    expect(guide).toMatch(/顯示檔名和上傳日期時間（香港時間）/);
    expect(guide).toMatch(/resizes the DXF drawing and the snap points together/);
    expect(guide).toMatch(/DXF 描線與吸附點會一併按同一比例縮放/);
    expect(guide).toMatch(/Draw room stays allowed without a prior calibrate/);
    expect(guide).toMatch(/不必先校正即可畫房/);
  });

  it("documents Create rooms from DXF on closed polylines, simple line loops, and wall networks", () => {
    expect(guide).toMatch(/Create rooms from DXF\*\* makes rooms from closed polylines, from simple closed loops of connected lines, and from each minimal room face in a T-junction or shared-wall network on that storey/);
    expect(guide).toMatch(/會在該層為每條封閉折線、由相連線段組成的簡單閉合迴路，以及 T 形交匯或共用牆網絡中的每個最小房間面，各建立一間房間/);
    expect(guide).toMatch(/if one room lies fully inside another with no connecting wall, only the inner room is kept/);
    expect(guide).toMatch(/若一間房完全落在另一間之內且沒有連牆，只保留內房/);
    expect(guide).toMatch(/official defaults \(maintenance factor 0\.80, no EN template inherited from the selected room\)/);
    expect(guide).toMatch(/官方預設（維護係數 0\.80，不繼承所選房間的 EN 範本）/);
    expect(guide).toMatch(/Scale follows the current \*\*Calibrate scale\*\*/);
    expect(guide).toMatch(/比例跟隨目前的 \*\*Calibrate scale\*\*/);
    expect(guide).toMatch(/Existing rooms are left unchanged/);
    expect(guide).toMatch(/既有房間不會被改寫/);
    expect(guide).not.toMatch(/Auto-converting DXF entities into rooms is not included/);
    expect(guide).not.toMatch(/不包括由 DXF 自動建立房間/);
    const tips = read("src/lib/ui-tips.ts");
    expect(tips).toContain('helpKey: "tool.createRoomsFromDxf"');
    expect(tips).toMatch(/rooms from closed polylines, from simple closed loops of connected lines, and from each minimal room face in a T-junction or shared-wall network/);
    expect(tips).toMatch(/if one room lies fully inside another with no connecting wall, only the inner room is kept/);
    expect(guide).toMatch(/CIRCLE, ARC, ELLIPSE, SPLINE \(including a spline that has only fit points\), old POLYLINE, and LWPOLYLINE bulges are also traced \(curves as polygons\)/);
    expect(guide).toMatch(/CIRCLE、ARC、ELLIPSE、SPLINE（包括只有擬合點的 SPLINE）、舊式 POLYLINE 與 LWPOLYLINE 凸度也會描繪（曲線以多邊形近似）/);
    expect(guide).toMatch(/A non-mesh 3D POLYLINE is traced in plan \(Z is ignored\)/);
    expect(guide).toMatch(/非網格的 3D POLYLINE 會按平面描繪（忽略 Z）/);
    expect(guide).toMatch(/Paperspace entities \(group 67 = 1\) are not displayed, snapped, bounded, or used to create rooms/);
    expect(guide).toMatch(/圖紙空間實體（群組碼 67 = 1）不會顯示、吸附、計入範圍，也不會用來建立房間/);
    expect(guide).toMatch(/Polygon-mesh and polyface-mesh POLYLINE entities are also traced in plan \(Z is ignored\)/);
    expect(guide).toMatch(/多邊形網格與多面網格 POLYLINE 也會按平面描繪（忽略 Z），並可用來建立房間/);
    expect(guide).toMatch(/A 3D extrusion \(groups 210\/220\/230\) on CIRCLE, ARC, ELLIPSE, LWPOLYLINE, and 2D POLYLINE is applied when tracing in plan/);
    expect(guide).toMatch(/CIRCLE、ARC、ELLIPSE、LWPOLYLINE 與二維 POLYLINE 的 3D extrusion（群組碼 210\/220\/230）會在平面描繪時套用/);
    expect(guide).toMatch(/or a DWG that has been converted to the same linework/);
    expect(guide).toMatch(/或是已轉換並含描線的 DWG/);
    expect(guide).not.toMatch(/DWG is not parsed/);
    expect(guide).not.toMatch(/CIRCLE, ARC, and old POLYLINE entities are not traced/);
    expect(tips).toMatch(/CIRCLE, ARC, ELLIPSE, SPLINE \(including a spline that has only fit points\), old POLYLINE, and LWPOLYLINE bulges are also traced \(curves as polygons\)/);
    expect(tips).toMatch(/A non-mesh 3D POLYLINE is traced in plan \(Z is ignored\)/);
    expect(tips).toMatch(/Paperspace entities \(group 67 = 1\) are not displayed, snapped, bounded, or used to create rooms/);
    expect(tips).toMatch(/Polygon-mesh and polyface-mesh POLYLINE entities are also traced in plan \(Z is ignored\)/);
    expect(tips).toMatch(/A 3D extrusion \(groups 210\/220\/230\) on CIRCLE, ARC, ELLIPSE, LWPOLYLINE, and 2D POLYLINE is applied when tracing in plan/);
    expect(tips).not.toMatch(/CIRCLE, ARC, and old POLYLINE entities are not traced/);
  });

  it("documents Union rooms for overlapping or edge-adjacent rooms", () => {
    expect(guide).toMatch(/use \*\*Union rooms\*\* in Construction tools/);
    expect(guide).toMatch(/可在 Construction tools 按 \*\*Union rooms\*\*/);
    expect(guide).toMatch(/first \(surviving\) room/);
    expect(guide).toMatch(/作為保留的第一間/);
    expect(guide).toMatch(/The first room keeps its id, name, maintenance factor, EN template, height/);
    expect(guide).toMatch(/第一間房會保留其識別碼、名稱、維護係數、EN 範本、高度/);
    expect(guide).toMatch(/only touch at a point or not at all/);
    expect(guide).toMatch(/只在點上相觸或完全不相接/);
    expect(guide).toMatch(/union would contain a hole/);
    expect(guide).toMatch(/合併結果會形成洞/);
    expect(guide).toMatch(/reassigned to the surviving room/);
    expect(guide).toMatch(/改歸保留房間/);
    expect(guide).toMatch(/Alignment is not included/);
    expect(guide).toMatch(/對齊不包括在內/);
    const tips = read("src/lib/ui-tips.ts");
    expect(tips).toContain('helpKey: "tool.unionRooms"');
    expect(tips).toMatch(/first \(surviving\) room/);
    expect(tips).toMatch(/Alignment is not included/);
  });

  it("documents Subtract rooms for cutting one room by another on the same storey", () => {
    expect(guide).toMatch(/use \*\*Subtract rooms\*\* in Construction tools/);
    expect(guide).toMatch(/可在 Construction tools 按 \*\*Subtract rooms\*\*/);
    expect(guide).toMatch(/first \(kept\) room/);
    expect(guide).toMatch(/作為保留並被切割的第一間/);
    expect(guide).toMatch(/The cutter room stays in place and is not deleted/);
    expect(guide).toMatch(/切割器房間會留在原位，不會被刪除/);
    expect(guide).toMatch(/do not overlap in area \(edge-touch or disjoint is not a cut\)/);
    expect(guide).toMatch(/面積沒有重疊（只沿邊相觸或完全不相接不算切割）/);
    expect(guide).toMatch(/would split into two or more disjoint pieces/);
    expect(guide).toMatch(/裂成兩塊或以上互不相連的部分/);
    expect(guide).toMatch(/would contain a hole/);
    expect(guide).toMatch(/形成洞/);
    expect(guide).toMatch(/no longer lie in the cut outline are unassigned/);
    expect(guide).toMatch(/已不在切割後輪廓內的燈具會取消房間歸屬/);
    expect(guide).toMatch(/Alignment is not included/);
    expect(guide).toMatch(/此增量不包括對齊/);
    const tips = read("src/lib/ui-tips.ts");
    expect(tips).toContain('helpKey: "tool.subtractRooms"');
    expect(tips).toMatch(/cutter stays in place and is not deleted/);
    expect(tips).toMatch(/would split into two or more pieces/);
    expect(tips).toMatch(/would contain a hole/);
  });

  it("documents Intersect rooms for keeping the overlapping area of two rooms", () => {
    expect(guide).toMatch(/use \*\*Intersect rooms\*\* in Construction tools/);
    expect(guide).toMatch(/可在 Construction tools 按 \*\*Intersect rooms\*\*/);
    expect(guide).toMatch(/first \(kept\) room/);
    expect(guide).toMatch(/作為保留的第一間/);
    expect(guide).toMatch(/outline becomes the intersection as a single simple ring/);
    expect(guide).toMatch(/輪廓改為兩房重疊範圍的單一外輪廓/);
    expect(guide).toMatch(/second room is removed after a successful intersect/);
    expect(guide).toMatch(/成功後第二間房會被移除/);
    expect(guide).toMatch(/do not overlap in area \(edge-touch or disjoint is not an intersection\)/);
    expect(guide).toMatch(/面積沒有重疊（只沿邊相觸或完全不相接不算交集）/);
    expect(guide).toMatch(/would split into two or more disjoint pieces/);
    expect(guide).toMatch(/裂成兩塊或以上互不相連的部分/);
    expect(guide).toMatch(/still lie in the intersection are assigned to the surviving room/);
    expect(guide).toMatch(/仍在交集輪廓內的燈具會改歸保留房間/);
    expect(guide).toMatch(/Alignment is not included/);
    expect(guide).toMatch(/此增量不包括對齊/);
    const tips = read("src/lib/ui-tips.ts");
    expect(tips).toContain('helpKey: "tool.intersectRooms"');
    expect(tips).toMatch(/overlapping area as a single simple ring/);
    expect(tips).toMatch(/second room is removed after a successful intersect/);
    expect(tips).toMatch(/Alignment is not included/);
  });

  it("documents XOR rooms for keeping the exclusive parts of two rooms", () => {
    expect(guide).toMatch(/use \*\*XOR rooms\*\* in Construction tools/);
    expect(guide).toMatch(/可在 Construction tools 按 \*\*XOR rooms\*\*/);
    expect(guide).toMatch(/first XOR second/);
    expect(guide).toMatch(/第一間 XOR 第二間/);
    expect(guide).toMatch(/outline becomes the symmetric difference as a single simple ring/);
    expect(guide).toMatch(/輪廓改為對稱差的單一外輪廓/);
    expect(guide).toMatch(/second room is removed after a successful XOR/);
    expect(guide).toMatch(/成功後第二間房會被移除/);
    expect(guide).toMatch(/do not overlap in area \(edge-touch or disjoint is not an XOR\)/);
    expect(guide).toMatch(/面積沒有重疊（只沿邊相觸或完全不相接不算 XOR）/);
    expect(guide).toMatch(/typical when both rooms have a remainder/);
    expect(guide).toMatch(/兩房都留下剩餘部分時通常如此/);
    expect(guide).toMatch(/A bite that shares the first room’s outer boundary can succeed/);
    expect(guide).toMatch(/若第二間房是咬住第一間外輪廓的一角或一邊/);
    expect(guide).toMatch(/still lie in the XOR outline are assigned to the surviving room/);
    expect(guide).toMatch(/仍在 XOR 輪廓內的燈具會改歸保留房間/);
    expect(guide).toMatch(/Alignment is not included/);
    expect(guide).toMatch(/此增量不包括對齊/);
    const tips = read("src/lib/ui-tips.ts");
    expect(tips).toContain('helpKey: "tool.xorRooms"');
    expect(tips).toMatch(/symmetric difference \(first XOR second\)/);
    expect(tips).toMatch(/second room is removed after a successful XOR/);
    expect(tips).toMatch(/Alignment is not included/);
  });

  it("documents Align rooms for lining a room up to a reference on the same storey", () => {
    expect(guide).toMatch(/use \*\*Align rooms\*\* in Construction tools/);
    expect(guide).toMatch(/可在 Construction tools 按 \*\*Align rooms\*\*/);
    expect(guide).toMatch(/it is the reference \(it stays put\)/);
    expect(guide).toMatch(/該房會作為參考（不移動）/);
    expect(guide).toMatch(/matching edge or centre of its bounding box lines up with the reference/);
    expect(guide).toMatch(/使其包圍盒的對應邊或中心與參考房間對齊/);
    expect(guide).toMatch(/Both rooms are kept/);
    expect(guide).toMatch(/兩間房都會保留/);
    expect(guide).toMatch(/Fixtures assigned to the moved room follow the same translation/);
    expect(guide).toMatch(/屬於被移動房間的燈具會跟隨同一平移/);
    expect(guide).toMatch(/the room is already aligned/);
    expect(guide).toMatch(/該房已經對齊/);
    expect(guide).toMatch(/Even spacing \/ distribute is not included/);
    expect(guide).toMatch(/此增量不包括均勻分布/);
    const tips = read("src/lib/ui-tips.ts");
    expect(tips).toContain('helpKey: "tool.alignRooms"');
    expect(tips).toMatch(/reference and stays put/);
    expect(tips).toMatch(/Even spacing \/ distribute is not included/);
  });

  it("documents Distribute rooms for even gaps between bounding boxes", () => {
    expect(guide).toMatch(/use \*\*Distribute rooms\*\* in Construction tools/);
    expect(guide).toMatch(/可在 Construction tools 按 \*\*Distribute rooms\*\*/);
    expect(guide).toMatch(/click at least three rooms on the plan, then press \*\*Enter\*\*/);
    expect(guide).toMatch(/點選至少三間房，然後按 \*\*Enter\*\* 套用/);
    expect(guide).toMatch(/ordered by the leading edge of the bounding box/);
    expect(guide).toMatch(/房間按包圍盒的前緣/);
    expect(guide).toMatch(/The first and last rooms in that order stay put/);
    expect(guide).toMatch(/該順序的第一間與最後一間留在原位/);
    expect(guide).toMatch(/gaps between consecutive bounding boxes are equal/);
    expect(guide).toMatch(/相鄰包圍盒之間的間隙相等/);
    expect(guide).toMatch(/fewer than three rooms are selected/);
    expect(guide).toMatch(/選取少於三間/);
    expect(guide).toMatch(/already evenly spaced/);
    expect(guide).toMatch(/已經均勻分布/);
    const tips = read("src/lib/ui-tips.ts");
    expect(tips).toContain('helpKey: "tool.distributeRooms"');
    expect(tips).toMatch(/first and last rooms in that order stay put/);
    expect(tips).toMatch(/gaps between consecutive bounding boxes are equal/);
  });

  it("documents Fillet corner for rounding one selected room corner", () => {
    expect(guide).toMatch(/use \*\*Fillet corner\*\* in Construction tools/);
    expect(guide).toMatch(/可在 Construction tools 按 \*\*Fillet corner\*\*/);
    expect(guide).toMatch(/radius in millimetres/);
    expect(guide).toMatch(/輸入半徑（毫米/);
    expect(guide).toMatch(/click a corner handle of that room to fillet that corner/);
    expect(guide).toMatch(/點該房的角點控制點即可修圓該角/);
    expect(guide).toMatch(/A mid-edge insert handle is not a fillet target/);
    expect(guide).toMatch(/邊上的插入控制點不是修圓目標/);
    expect(guide).toMatch(/the radius is too large for the adjacent edges or arcs/);
    expect(guide).toMatch(/半徑對相鄰兩邊或圓弧過大/);
    expect(guide).toMatch(/no longer lie in the filleted outline have their room assignment cleared/);
    expect(guide).toMatch(/已不在修圓後輪廓內的燈具會取消房間歸屬/);
    expect(guide).toMatch(/straight wall can be filleted against an existing arc/);
    expect(guide).toMatch(/直線邊可對已有圓弧/);
    expect(guide).toMatch(/still stored as a simple polygon/);
    expect(guide).toMatch(/仍存成無洞的簡單多邊形/);
    expect(guide).not.toMatch(/does not fillet every corner at once/);
    expect(guide).not.toMatch(/不會一次修全部角/);
    const tips = read("src/lib/ui-tips.ts");
    expect(tips).toContain('helpKey: "tool.filletCorner"');
    expect(tips).toMatch(/click a corner handle of a room on the current storey/);
    expect(tips).toMatch(/A mid-edge insert handle is not a fillet target/);
    expect(tips).not.toMatch(/Filleting every corner at once is not included/);
  });

  it("documents Fillet all corners for rounding every remaining sharp corner in one command", () => {
    expect(guide).toMatch(/use \*\*Fillet all corners\*\* in Construction tools/);
    expect(guide).toMatch(/可在 Construction tools 按 \*\*Fillet all corners\*\*/);
    expect(guide).toMatch(/same field used by \*\*Fillet corner\*\*/);
    expect(guide).toMatch(/與 \*\*Fillet corner\*\* 相同的半徑欄/);
    expect(guide).toMatch(/clicking the button applies immediately/);
    expect(guide).toMatch(/按按鈕即立即套用，不必再點角點控制點/);
    expect(guide).toMatch(/Already-straight or already-filleted corners are skipped/);
    expect(guide).toMatch(/已接近直線或已修圓的角會被略過/);
    expect(guide).toMatch(/two fillets would overlap on the same edge or arc/);
    expect(guide).toMatch(/同一邊或同一圓弧上兩個圓角的修剪段會重疊/);
    expect(guide).toMatch(/no partial fillet/);
    expect(guide).toMatch(/不套用部分圓角/);
    const tips = read("src/lib/ui-tips.ts");
    expect(tips).toContain('helpKey: "tool.filletAllCorners"');
    expect(tips).toMatch(/applies immediately; you do not pick a corner handle/);
    expect(tips).toMatch(/two fillets would overlap on the same edge or arc/);
    expect(tips).toMatch(/every remaining corner is already straight \(no sharp corner to fillet\)/);
  });

  it("documents Copy storey for duplicating the current storey in the same building", () => {
    expect(guide).toMatch(/use \*\*Copy storey\*\* in the \*\*Building\*\* panel/);
    expect(guide).toMatch(/可在左側 \*\*Building\*\* 按 \*\*Copy storey\*\*/);
    expect(guide).toMatch(/named \*\*Copy of \{name\}\*\*/);
    expect(guide).toMatch(/新樓層名稱為 \*\*Copy of \{名稱\}\*\*/);
    expect(guide).toMatch(/source elevation \+ source storey height/);
    expect(guide).toMatch(/來源標高 \+ 來源層高/);
    expect(guide).toMatch(/steps up by the source storey height until a free slot is found/);
    expect(guide).toMatch(/再按來源層高往上尋找空位/);
    expect(guide).toMatch(/Underlays and calculation results are not copied/);
    expect(guide).toMatch(/底圖與計算結果不會被複製/);
    expect(guide).toMatch(/the new storey is selected so the plan shows it/);
    expect(guide).toMatch(/成功後會選取新樓層/);
    const tips = read("src/lib/ui-tips.ts");
    expect(tips).toContain('helpKey: "tool.copyStorey"');
    expect(tips).toMatch(/Copy of \{name\}/);
    expect(tips).toMatch(/Underlays and calculation results are not copied/);
  });

  it("documents isolines and value labels on the plan, in 3D, and in the official PDF", () => {
    expect(guide).toMatch(/等照度線與數值圖 \/ Isolines and value labels/);
    expect(guide).toMatch(/turn \*\*False colour\*\*, \*\*Isolines\*\*, and \*\*Value labels\*\* on or off independently/);
    expect(guide).toMatch(/分別開啟或關閉 \*\*False colour\*\*（偽色）、\*\*Isolines\*\*（等照度線）和 \*\*Value labels\*\*（數值圖）/);
    expect(guide).toMatch(/same button style and can overlay/);
    expect(guide).toMatch(/是同一種按鈕，可以疊加/);
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
    expect(guide).toMatch(/Greyscale scale/);
    expect(guide).toMatch(/灰階模式，刻度條改為灰色漸層/);
    expect(guide).toMatch(/Workplane \(m\)/);
    expect(guide).toMatch(/工作面（計算平面）的高度跟隨/);
    expect(guide).toMatch(/When the workplane is hidden, Greyscale, False colour, Isolines, and Value labels stay visible, drawn on the floor/);
    expect(guide).toMatch(/工作面隱藏時，這些照度顯示改畫在地板上/);
    expect(guide).toMatch(/3D wall false colour \(or greyscale illuminance\) is drawn only on the inward illuminated face, and the outside of the wall stays grey/);
    expect(guide).toMatch(/3D 牆身假色（或灰階照度）只畫在向內的受光面上，外牆保持灰色/);
    expect(guide).not.toMatch(/visible from both sides/);
    expect(guide).not.toMatch(/雙面可見/);
    expect(guide).not.toMatch(/middle of the wall thickness/);
    expect(guide).not.toMatch(/牆厚中間/);
    expect(guide).toMatch(/without hiding the room floor, walls, or fixtures/);
    expect(guide).toMatch(/不會隱藏房間地板、牆身或燈具/);
    expect(guide).toMatch(/does not isolate a room/);
    expect(guide).toMatch(/不會因此把房間單獨隔離/);
    expect(guide).toMatch(/There is no Bottom view button/);
    expect(guide).toMatch(/沒有 Bottom 視圖按鈕/);
    expect(guide).toMatch(/re-rasterizing every room or rebuilding isolux models/);
    expect(guide).toMatch(/不會在拖曳或縮放途中重繪所有房間的偽色圖/);
    const tips = read("src/lib/ui-tips.ts");
    expect(tips).toContain('helpKey: "view.planIsolux"');
    expect(tips).toContain("PLAN_ISOLUX_HINT");
  });

  it("parses guide figures and keeps a Chinese / English language toggle", () => {
    expect(guide).toContain("![平面視野控制 / Plan view controls](/docs/guide/plan-view-controls.svg)");
    expect(guide).toContain("![房間角點控制點 / Room corner and edge handles](/docs/guide/room-handles.svg)");
    expect(guide).toContain("![顯示開關 / Greyscale, False colour, Isolines and Value labels](/docs/guide/display-toggles.svg)");
    expect(guide).toContain("![偽色與等照度線疊加 / False colour with isolines and value labels](/docs/guide/isolux-overlay.svg)");
    expect(guide).toContain("![畫房步驟 / Draw room on the plan](/docs/guide/draw-room.svg)");
    expect(guide).toContain("![自動佈燈 / Automatic placement](/docs/guide/automatic-placement.svg)");
    for (const name of [
      "plan-view-controls.svg",
      "room-handles.svg",
      "display-toggles.svg",
      "isolux-overlay.svg",
      "draw-room.svg",
      "automatic-placement.svg",
      "calc-storey.svg",
    ]) {
      expect(existsSync(path.join(process.cwd(), "public/docs/guide", name))).toBe(true);
    }

    const sample = [
      "# 使用手冊 / User guide",
      "",
      "這是中文說明。",
      "",
      "This is the English explanation.",
      "",
      "![平面視野控制 / Plan view controls](/docs/guide/plan-view-controls.svg)",
    ].join("\n");
    const parsed = parseUserGuideMarkdown(sample);
    expect(parsed.some((block) => block.type === "img" && block.src === "/docs/guide/plan-view-controls.svg")).toBe(
      true
    );
    const zh = filterGuideBlocks(parsed, "zh");
    const en = filterGuideBlocks(parsed, "en");
    expect(zh.some((block) => block.type === "p" && "text" in block && block.text.includes("中文說明"))).toBe(true);
    expect(zh.some((block) => block.type === "p" && "text" in block && block.text.includes("English explanation"))).toBe(
      false
    );
    expect(en.some((block) => block.type === "p" && "text" in block && block.text.includes("English explanation"))).toBe(
      true
    );
    expect(en.some((block) => block.type === "p" && "text" in block && block.text.includes("中文說明"))).toBe(false);
    expect(localizeGuideHeading("使用手冊 / User guide", "zh")).toBe("使用手冊");
    expect(localizeGuideHeading("使用手冊 / User guide", "en")).toBe("User guide");

    const article = read("src/lib/user-guide-markdown.tsx");
    expect(article).toContain("data-guide-lang-toggle");
    expect(article).toContain("中文");
    expect(article).toContain("English");
    expect(article).toContain("GUIDE_LANG_STORAGE_KEY");
  });

  it("documents Calc storey for the active storey", () => {
    expect(guide).toMatch(/計算樓層 \/ Calc storey/);
    expect(guide).toMatch(/\*\*Calc storey\*\*/);
    expect(guide).toMatch(/Calculating storey…/);
    expect(guide).toMatch(/正在計算樓層…/);
    expect(guide).toMatch(/active storey/i);
    expect(guide).toMatch(/目前樓層/);
    expect(guide).toMatch(/other storeys/i);
    expect(guide).toMatch(/其他樓層/);
    expect(guide).toMatch(/missing photometry/i);
    expect(guide).toMatch(/缺配光/);
    expect(guide).toMatch(/view-only|唯讀/);
    expect(guide).toContain("![計算樓層 / Calc storey](/docs/guide/calc-storey.svg)");
    expect(existsSync(path.join(process.cwd(), "public/docs/guide/calc-storey.svg"))).toBe(true);
  });
});
