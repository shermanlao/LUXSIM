# 使用手冊 / User guide

LUXSIM 是照明設計輔助工具，不是標書認證計算。編輯器按鈕目前以英文為主，下文用這些英文名稱說明操作。

LUXSIM is a lighting design assist tool, not a tender-certified calculation. The names below match the English labels in the editor.

在 [Projects](/projects) 開啟專案後即可使用編輯器。本頁說明平面圖視野、畫房、拖移房間，以及直線排列的端點點選、圓形排列和多邊形排列，包括近日補上、用家需要記住的快捷鍵。工具旁的「？」按鈕也有簡短提示。

Open a project from [Projects](/projects) to use the editor. This page explains plan view, room drawing, how to drag a room, how to pick Line array endpoints, and how to place a Circular or Polygon array, including the latest shortcuts. The **?** buttons next to tools also show short tips.

## 平面圖視野 / Plan view

在 **Top** 或 **Bottom** 視圖：

- 在圖面上滾動滑鼠滾輪，會以游標位置為中心放大或縮小，不會捲動整頁。
- 雙擊圖面空白處，會回到預設的置中適合視野。
- 切換樓層時，視野也會回到這個預設。
- 畫房途中，自動套圖保持鎖定，點擊位置不會因為草稿而偏移；滾輪縮放仍可使用，並以游標為中心。
- 目前不能用拖曳來平移圖面。在空白處拖曳不會移動視野；拖移房間請用 **Select** 在房間填色範圍上拖曳。
- 一般視圖（不必開 Fullscreen）下，2D／3D 畫布會留在視窗內完整可見。右側屬性／工具欄若內容較長，會在欄內捲動，不會把圖面推走或裁掉。左側 Building 樹過長時同樣在欄內捲動。

On the **Top** or **Bottom** view:

- Scroll the mouse wheel on the plan to zoom toward the cursor. The page itself does not scroll.
- Double-click an empty area of the plan to return to the default centred fit.
- Switching storeys also resets the view to that default fit.
- While you are drawing a room, the automatic fit stays locked so click positions remain stable. Wheel zoom still works toward the cursor.
- Click-and-drag panning is not available yet. Dragging an empty area does not move the view. To move a room, use **Select** and drag the room fill.
- In the normal (non-fullscreen) editor view, the 2D and 3D canvas stays fully visible in the window. If the right-hand Properties / tools rail is longer than the column, it scrolls inside the rail instead of pushing or cropping the plan. You do not need **Fullscreen** just to see the plan. A long Building tree on the left also scrolls inside its column.

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

房間建立後，可在 **Select** 工具下於 **Top** 或 **Bottom** 平面圖拖移該房的填色範圍，把整個多邊形平移到新位置。矩形、L 形或不規則形狀都適用，形狀不變。該房內的燈具會一併移動，其他房間與樓層標高／層高不變。按住 **Shift** 可限制為水平或垂直移動。這次移動可用 **Ctrl+Z** 撤銷。單一燈具仍可用 **Select / move** 單獨拖移。

在左側 **Building** 面板可設定 **Room height**（毫米，預設 2800）。未選房間時此欄仍可見，會用於下一間用 **Draw room** 或 **Create rectangle** 建立的房間。若已選房間，改此欄也會更新該房的天花板高度，其他房間不變。

矩形房間：在工具列輸入 **Length** 和 **Width**（毫米，或加 `m` / `cm` 後綴）後建立，房間會放在樓層原點 `(0, 0)`。高度取自 **Room height**。建立後可用 **Select** 拖移到圖則位置。

On **Construction**, choose **Draw room** on the **Top** or **Bottom** view:

1. Left-click each corner.
2. Type a length (millimetres by default). The next point is locked to a circle of that radius around the last corner; the pointer only sets the direction.
3. Hold **Shift** to constrain to horizontal or vertical.
4. Click near the first corner, or press **Enter** when close to it, to close the room.
5. If a length is typed and locked, one **Backspace** clears that whole length. The next **Backspace** removes the last corner.
6. **Esc** cancels the draft while you are drawing. It does not exit the browser’s fullscreen view. When you are not drawing, **Esc** can still exit fullscreen.

After a room is created, choose the **Select** tool and drag the room fill on the **Top** or **Bottom** plan to move the whole polygon (rectangle, L-shape, or irregular) without changing its shape. Fixtures that belong to that room move with it. Other rooms and the storey's elevation / height stay as they are. Hold **Shift** to constrain the move to horizontal or vertical. **Ctrl+Z** undoes the move. Use **Select / move** to drag a single fixture on its own.

Set **Room height** in the **Building** panel (millimetres, default 2800) before you create a room. The field stays visible when no room is selected and is used for the next room you draw or create with **Draw room** or **Create rectangle**. If a room is selected, changing it also updates that room’s ceiling. Other rooms stay as they are.

For a simple rectangle, enter **Length** and **Width** in millimetres (or with an `m` / `cm` suffix). The room is placed at the storey origin `(0, 0)`. Height comes from **Room height**. After creation, drag it with **Select** if you need to place it on the plan.

## 樓層標高與層高 / Storey elevation and height

左側 **Building** 在選取樓層後會顯示 **Elevation**（標高，單位公尺）和 **Storey height**（層高，單位公尺）。

- **Elevation** 是該層樓面的高度。預設地面層（GF）為 0 m。
- **Storey height** 是樓層與樓層之間的間距，預設 3.0 m。按 **Add storey** 時，下一層會放在「本層標高 + 層高」。因此在預設 GF 之上新增的 L1，標高為 3.0 m、層高為 3.0 m。
- **Room height**（預設 2800 mm）是房間內部的天花板高度，與層高分開。3.0 m 與 2.8 m 之間的 0.2 m 差額留給樓板／結構，程式不會自動建出這段。
- 改這些數值只影響目前樓層或所選房間，不會移動其他樓層或既有房間。

After you select a storey, the **Building** panel shows **Elevation** (metres) and **Storey height** (metres).

- **Elevation** is the floor level of that storey. The default ground floor (GF) is 0 m.
- **Storey height** is the floor-to-floor spacing (default 3.0 m). **Add storey** places the next floor at this storey’s elevation + storey height, so L1 added above the default GF is at elevation 3.0 m with a storey height of 3.0 m.
- **Room height** (default 2800 mm) is the ceiling inside a room, and is separate from storey height. The 0.2 m difference between 3.0 m and 2.8 m is left for the slab / structure; it is not modelled automatically.
- Changing these values does not move other storeys or existing rooms.


## 直線排列 / Line array

在 **Light** 模式，先在左側選一個房間，再開右側 **Arrange** 的 **Line**（直線）。

1. 可在 **Top** 或 **Bottom** 平面圖上點兩下，設定線段的起點與終點。第一次點擊是起點，第二次點擊完成線段，預覽會沿這條線更新。
2. 線段完成後，再點一下會開始一條新線（先重設起點，再點終點）。
3. 未完成起點時按 **Esc** 會取消該起點，回到用數量與間距的預設直線。即使瀏覽器處於全畫面，也不會因此退出全畫面。沒有未完成點選時，**Esc** 仍可用來退出全畫面。
4. 若未點選端點，**Count**、**Spacing X** 與 **Rotation** 仍會在房間中心沿旋轉方向排成一直線，行為與先前相同。
5. 點選端點後，燈具由起點到終點均勻分布；沿線間距由線段長度與 **Count** 決定，並顯示在 **Along line** 欄。**Rotation** 仍是燈具朝向，不是線的方向。
6. Spacing Y 在直線模式維持停用。直線排列只沿一條線放置，不會用 Spacing Y 再排第二列。矩形排列才使用 Spacing Y。
7. 落在房間多邊形外的點不會放置；與同房已有燈具相距 1 mm 內的點會略過，既有燈具不會被刪除。點 **Clear line** 可清除已選線段。點選直線時，雙擊空白處不會重置視野，仍可用滾輪縮放。

In **Light** mode, select a room in the building tree, then choose **Line** in **Arrange**.

1. Click two points on the **Top** or **Bottom** plan to set the line start and end. The first click is the start; the second click completes the segment and the preview follows that line.
2. After a segment is complete, a later click starts a new line.
3. **Esc** cancels an unfinished start and returns to the centred numeric line. It does not exit the browser’s fullscreen view. When you are not mid-pick, **Esc** can still exit fullscreen.
4. If you do not pick endpoints, **Count**, **Spacing X** and **Rotation** still place a line through the room centre, as before.
5. With endpoints picked, fixtures are spaced evenly from start to end. The along-line spacing comes from the segment length and **Count**, and is shown in **Along line**. **Rotation** is still the fixture orientation, not the line direction.
6. **Spacing Y stays disabled** in Line mode because a line array places fixtures along one line only. **Spacing Y** is used by Rectangular arrays.
7. Points outside the room polygon are not placed. Points within 1 mm of an existing fixture in the same room are skipped; existing fixtures are kept. **Clear line** removes the picked segment. While you are picking a line, double-click does not reset the view; wheel zoom still works toward the cursor.


## 圓形排列 / Circular array

在 **Light** 模式，先在左側選一個房間，再開右側 **Arrange** 的 **Circle**（圓形）。

1. 用 **Count**、**Radius**（公尺）和 **Rotation** 放置燈具。預設圓心是房間外接矩形的中心，與直線模式未點選端點時所用的中心相同。半徑以欄位上看到的數值為準；未改過時，會按房間較短邊的約四分之一預填。
2. 可在 **Top** 或 **Bottom** 平面圖上點一下，設定圓心。之後再點一下會改設圓心。
3. 按 **Esc** 會取消已選圓心，回到房間中心的預設圓。即使瀏覽器處於全畫面，也不會因此退出全畫面。沒有已選圓心時，**Esc** 仍可用來退出全畫面。點 **Clear centre** 同樣回到房間中心。
4. 若未點選圓心，**Count**、**Radius** 與 **Rotation** 仍會以房間中心畫圓。
5. 燈具在圓周上均勻分布。**Count** 為 1 時，單一點放在起始角度的半徑上，而不是圓心。角度 0° 是 +X 方向，**Rotation** 是第一點的起始角度，同時也是燈具朝向，與直線模式相同，不會自動指向圓心或沿切線。
6. Spacing X、Spacing Y 與離牆在圓形模式維持停用。圓形排列只在一個圓周上放置，不會用這些欄位再排第二圈或徑向間距。矩形排列才使用這些欄位。目標照度估算仍只用矩形網格，沒有圓形目標照度路徑。
7. 落在房間多邊形外的點不會放置；與同房已有燈具相距 1 mm 內的點會略過，既有燈具不會被刪除。點選圓心時，雙擊空白處不會重置視野，仍可用滾輪縮放。

In **Light** mode, select a room in the building tree, then choose **Circle** in **Arrange**.

1. Place fixtures with **Count**, **Radius** (metres) and **Rotation**. The default centre is the room’s bounding-box centre, the same centre used by the Line numeric fallback. The radius used is the value shown in the field; if you have not changed it, it is prefilled to about a quarter of the room’s shorter side.
2. Click once on the **Top** or **Bottom** plan to set the circle centre. A later click replaces the centre.
3. **Esc** cancels an unwanted centre pick and returns to the room-centre fallback. It does not exit the browser’s fullscreen view. When no centre is picked, **Esc** can still exit fullscreen. **Clear centre** also returns to the room centre.
4. If you do not pick a centre, **Count**, **Radius** and **Rotation** still place the circle on the room centre.
5. Fixtures are spaced equally around the circle. When **Count** is 1, the single point is placed at the start angle on the radius, not at the centre. Angle 0° is +X. **Rotation** is the start angle of the first point and is also the fixture orientation, as in Line mode; fixtures are not aimed at the centre or along the tangent.
6. **Spacing X, Spacing Y and wall offset stay disabled** in Circle mode because a circular array places fixtures on one circle only. Those fields are used by Rectangular arrays. Target-Ēm estimate still uses a rectangular grid only.
7. Points outside the room polygon are not placed. Points within 1 mm of an existing fixture in the same room are skipped; existing fixtures are kept. While you are picking a centre, double-click does not reset the view; wheel zoom still works toward the cursor.



## 多邊形排列 / Polygon array

在 **Light** 模式，先在左側選一個房間，再開右側 **Arrange** 的 **Polygon**（多邊形）。

1. 用 **Count** 和 **Rotation** 放置燈具。路徑是所選房間的官方封閉輪廓，由第一個角點（Origin）開始，沿周長均勻分布。
2. 沿路徑的間距是周長除以 **Count**，因此第一點與最後一點不會重疊在閉合頂點上。**Count** 為 1 時，單一燈具放在第一個角點。
3. **Rotation** 是燈具朝向，與直線和圓形模式相同，不會自動沿切線或指向室內。
4. Spacing X、Spacing Y 與離牆在多邊形模式維持停用。多邊形排列只沿房間輪廓放置，不會用這些欄位做內縮或再排第二圈。矩形排列才使用這些欄位。目標照度估算仍只用矩形網格，沒有多邊形目標照度路徑。本模式沒有另設繪製路徑的工具。
5. 落在房間多邊形外的點不會放置；剛好在房間邊上的點視為有效。與同房已有燈具相距 1 mm 內的點會略過，既有燈具不會被刪除。

In **Light** mode, select a room in the building tree, then choose **Polygon** in **Arrange**.

1. Place fixtures with **Count** and **Rotation**. The path is the selected room’s official closed outline, starting at the first corner (Origin), with fixtures spaced equally along the perimeter.
2. Spacing along the path is the perimeter divided by **Count**, so the first and last points do not coincide on the closing vertex. When **Count** is 1, the single fixture sits at the first corner.
3. **Rotation** is the fixture orientation, as in Line and Circle modes; fixtures are not aimed along the tangent or inward.
4. **Spacing X, Spacing Y and wall offset stay disabled** in Polygon mode because a polygon array places fixtures on the room outline only. Those fields are used by Rectangular arrays. There is no inset or second ring. Target-Ēm estimate still uses a rectangular grid only. This mode does not add a separate path-drawing tool.
5. Points outside the room polygon are not placed. Points that lie exactly on the room edge are treated as valid. Points within 1 mm of an existing fixture in the same room are skipped; existing fixtures are kept.

## 房間屬性 / Room properties

選取房間後，右側 **Properties** 會顯示：

- **Area** — 房間面積
- **Origin (first corner)** — 第一個角點的位置
- **Bounding min** — 只在第一個角點不是外接矩形的最小角時顯示

After you select a room, **Properties** shows **Area**, **Origin (first corner)**, and **Bounding min** when the first corner is not the bounding-box minimum.

其他功能（計算、燈具庫、報告匯出等）可先使用編輯器工具旁的「？」提示。本手冊會隨新操作繼續補上。

Other tools, calculation, the library, and exports are described by the **?** tips next to those controls. This guide will be extended as further operations are documented.
