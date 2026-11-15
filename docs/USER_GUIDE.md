# 使用手冊 / User guide

LUXSIM 是照明設計輔助工具，不是標書認證計算。編輯器按鈕目前以英文為主，下文用這些英文名稱說明操作。

LUXSIM is a lighting design assist tool, not a tender-certified calculation. The names below match the English labels in the editor.

在 [Projects](/projects) 開啟專案後即可使用編輯器。本頁說明平面圖視野和畫房操作，包括近日補上、用家需要記住的快捷鍵。工具旁的「？」按鈕也有簡短提示。

Open a project from [Projects](/projects) to use the editor. This page explains plan view and room drawing, including the latest shortcuts. The **?** buttons next to tools also show short tips.

## 平面圖視野 / Plan view

在 **Top** 或 **Bottom** 視圖：

- 在圖面上滾動滑鼠滾輪，會以游標位置為中心放大或縮小，不會捲動整頁。
- 雙擊圖面空白處，會回到預設的置中適合視野。
- 切換樓層時，視野也會回到這個預設。
- 畫房途中，自動套圖保持鎖定，點擊位置不會因為草稿而偏移；滾輪縮放仍可使用，並以游標為中心。
- 目前不能用拖曳來平移圖面。

On the **Top** or **Bottom** view:

- Scroll the mouse wheel on the plan to zoom toward the cursor. The page itself does not scroll.
- Double-click an empty area of the plan to return to the default centred fit.
- Switching storeys also resets the view to that default fit.
- While you are drawing a room, the automatic fit stays locked so click positions remain stable. Wheel zoom still works toward the cursor.
- Click-and-drag panning is not available yet.

放大後，圖面角落會提示 *double-click empty area to reset*。

When zoomed in, the plan shows the hint *double-click empty area to reset*.

## 畫房 / Draw room

在 **Construction** 模式，選 **Draw room**，於 **Top** 或 **Bottom** 視圖操作：

1. 左鍵逐點點出房間角點。
2. 用鍵盤輸入長度（預設單位是毫米）。下一個角點會鎖在以上一點為圓心、該長度為半徑的圓上，游標只決定方向。
3. 按住 **Shift** 可限制為水平或垂直。
4. 靠近第一個角點時再點一下，或按 **Enter**，即可封閉房間。
5. 若已輸入並鎖定長度，按一次 **Backspace** 會整段清掉該長度，再按一次才撤回上一個角點。
6. 畫房途中按 **Esc** 會取消草稿。即使瀏覽器處於全畫面，也不會因此退出全畫面。沒有草稿時，**Esc** 仍可用來退出全畫面。

If the plan underlay is an image or PDF that has not been calibrated, drawing a room or creating a rectangle is blocked until you use **Calibrate scale**. The status bar then says: *Calibrate scale first — the plan underlay is a preview size until you set a real distance.* You can draw with no underlay, a DXF underlay, or a calibrated plan.

房間建立後不能拖移位置，請在預定位置畫出。燈具可用 **Select / move** 拖移。

在左側 **Building** 面板可設定 **Room height**（毫米，預設 2800）。未選房間時此欄仍可見，會用於下一間用 **Draw room** 或 **Create rectangle** 建立的房間。若已選房間，改此欄也會更新該房的天花板高度，其他房間不變。

矩形房間：在工具列輸入 **Length** 和 **Width**（毫米，或加 `m` / `cm` 後綴）後建立，房間會放在樓層原點 `(0, 0)`。高度取自 **Room height**。

On **Construction**, choose **Draw room** on the **Top** or **Bottom** view:

1. Left-click each corner.
2. Type a length (millimetres by default). The next point is locked to a circle of that radius around the last corner; the pointer only sets the direction.
3. Hold **Shift** to constrain to horizontal or vertical.
4. Click near the first corner, or press **Enter** when close to it, to close the room.
5. If a length is typed and locked, one **Backspace** clears that whole length. The next **Backspace** removes the last corner.
6. **Esc** cancels the draft while you are drawing. It does not exit the browser’s fullscreen view. When you are not drawing, **Esc** can still exit fullscreen.

Rooms cannot be dragged after they are created, so draw them in the intended place. Use **Select / move** to drag fixtures.

Set **Room height** in the **Building** panel (millimetres, default 2800) before you create a room. The field stays visible when no room is selected and is used for the next room you draw or create with **Draw room** or **Create rectangle**. If a room is selected, changing it also updates that room’s ceiling. Other rooms stay as they are.

For a simple rectangle, enter **Length** and **Width** in millimetres (or with an `m` / `cm` suffix). The room is placed at the storey origin `(0, 0)`. Height comes from **Room height**.

## 房間屬性 / Room properties

選取房間後，右側 **Properties** 會顯示：

- **Area** — 房間面積
- **Origin (first corner)** — 第一個角點的位置
- **Bounding min** — 只在第一個角點不是外接矩形的最小角時顯示

After you select a room, **Properties** shows **Area**, **Origin (first corner)**, and **Bounding min** when the first corner is not the bounding-box minimum.

其他功能（計算、燈具庫、報告匯出等）可先使用編輯器工具旁的「？」提示。本手冊會隨新操作繼續補上。

Other tools, calculation, the library, and exports are described by the **?** tips next to those controls. This guide will be extended as further operations are documented.
