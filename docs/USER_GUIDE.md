# 使用手冊 / User guide

LUXSIM 是照明設計輔助工具，不是標書認證計算。編輯器按鈕目前以英文為主，下文用這些英文名稱說明操作。

LUXSIM is a lighting design assist tool, not a tender-certified calculation. The names below match the English labels in the editor.

在 [Projects](/projects) 開啟專案後即可使用編輯器。本頁說明平面圖視野、畫房、拖移房間，直線排列的端點點選、圓形排列和多邊形排列，DXF 物件吸附，以及計算後在平面與 3D 視圖切換等照度線與數值圖，包括近日補上、用家需要記住的快捷鍵。工具旁的「？」按鈕也有簡短提示。

Open a project from [Projects](/projects) to use the editor. This page explains plan view, room drawing, how to drag a room, how to pick Line array endpoints, how to place a Circular or Polygon array, DXF object snap, and how to switch Isolines and value labels on the plan and in the 3D view after Calculate, including the latest shortcuts. The **?** buttons next to tools also show short tips.

## 平面圖視野 / Plan view

在 **Top**、**Bottom**、**Front**、**Side** 與 **3D** 視圖：

- 在圖面上滾動滑鼠滾輪，會放大或縮小（平面與立面以游標位置為中心），不會捲動整頁。
- 按住滑鼠中鍵（滾輪按鈕）並拖曳，可平移圖面。不要用左鍵平移：左鍵仍用於點選、畫房，或拖移房間與燈具。
- 在 **Top** 或 **Bottom** 雙擊圖面空白處，會回到預設的置中適合視野。
- 切換樓層時，視野也會回到這個預設。
- 畫房途中，自動套圖保持鎖定，點擊位置不會因為草稿而偏移；滾輪縮放與中鍵平移仍可使用。
- **Top**／**Bottom**／**Front**／**Side**／**3D** 切換與 **Fullscreen** 會連同等照度線或 3D 顯示開關，一起浮在圖面左上角，讓圖面本身有較大的操作面積。
- 拖移房間請用 **Select** 在房間填色範圍上拖曳。若要一次移動整層，先在 **Building** 選取該樓層，再於該層任一房間填色範圍上拖曳。
- 一般視圖（不必開 Fullscreen）下，2D／3D 畫布會留在視窗內完整可見。右側屬性／工具欄若內容較長，會在欄內捲動，不會把圖面推走或裁掉。左側 Building 樹過長時同樣在欄內捲動。
- 若目前樓層的官方底圖是已解析的 DXF，在 **Top** 或 **Bottom** 上進行點選時，游標會在目前縮放下 8 個 CSS 像素範圍內，吸附到線段端點、中點，或線段上最近的一點，並顯示對應標記；超出範圍時標記會消失。圖像或 PDF 底圖不會做像素吸附。DWG 仍未解析，不會當成可顯示或可吸附的圖則。沒有 DXF 底圖、或沒有線段時，吸附不會啟動，也不會發明幾何。若目前樓層的底圖是 DXF，可用 **Create rooms from DXF** 為每條封閉折線，以及由相連線段組成的簡單閉合迴路，在該層各建立一間房間；不會自動描繪 T 形交匯或共用牆的網絡。新房間使用官方預設，比例跟隨目前的 **Calibrate scale**。
- 新匯入的 DXF 預設每個繪圖單位為 1 公尺，不必先校正即可畫房。若使用官方 **Calibrate scale** 兩點校正，DXF 描線與吸附點會一併按同一比例縮放（兩個軸使用同一個 `metersPerUnit`）。既有房間多邊形和燈具的世界座標已是公尺，不會再乘這個比例。

On the **Top**, **Bottom**, **Front**, **Side**, and **3D** views:

- Scroll the mouse wheel on the view to zoom (toward the cursor on the plan and elevation views). The page itself does not scroll.
- Hold the middle mouse button (the scroll-wheel button) and drag to pan the view. Do not pan with the left button: left-click still selects, draws rooms, or drags a room or fixture.
- Double-click an empty area of the **Top** or **Bottom** plan to return to the default centred fit.
- Switching storeys also resets the view to that default fit.
- While you are drawing a room, the automatic fit stays locked so click positions remain stable. Wheel zoom toward the cursor and middle-button pan still work.
- The **Top** / **Bottom** / **Front** / **Side** / **3D** tabs and **Fullscreen** sit together as floating controls at the top left of the plan, with the Isolines or 3D display toggles, so more of the canvas is available as operating area.
- To move a room, use **Select** and drag the room fill. To move a whole storey, select the storey in **Building** first, then drag a room fill.
- In the normal (non-fullscreen) editor view, the 2D and 3D canvas stays fully visible in the window. If the right-hand Properties / tools rail is longer than the column, it scrolls inside the rail instead of pushing or cropping the plan. You do not need **Fullscreen** just to see the plan. A long Building tree on the left also scrolls inside its column.
- When the active storey’s official underlay is a parsed DXF, picks on the **Top** or **Bottom** plan snap to endpoints, midpoints, and the nearest point on a segment within 8 CSS pixels at the current zoom. A small marker shows the active snap kind, and disappears when none is in range. This applies to Draw room corners, Calibrate scale clicks, Line-array endpoints, Circle-array centres, Polygon-array custom-path vertices, fixture drop placement, and dragging a room corner handle. **Create rectangle** still places a room at `(0, 0)` and does not pick on the plan. Image and PDF underlays do not get raster snap. DWG is not parsed and is not snappable. If there is no DXF underlay, or the entities are empty, snap stays inactive and no geometry is invented. With a DXF underlay, **Create rooms from DXF** makes rooms from closed polylines and from simple closed loops of connected lines on the current storey. It does not trace T-junctions or shared walls. New rooms use the official defaults, and scale follows the current **Calibrate scale**.
- A newly imported DXF starts at 1 metre per drawing unit, so Draw room stays allowed without a prior calibrate. Official **Calibrate scale** (two points plus a real length) resizes the DXF drawing and the snap points together, using the same uniform `metersPerUnit` on both axes. Existing room polygons and fixture world coordinates are already in metres and are not multiplied by that scale.

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

If the plan underlay is an image or PDF that has not been calibrated, drawing a room or creating a rectangle is blocked until you use **Calibrate scale**. The status bar then says: *Calibrate scale first — the plan underlay is a preview size until you set a real distance.* You can draw with no underlay, a DXF underlay, or a calibrated plan. A new DXF still starts at 1 metre per drawing unit. After official **Calibrate scale** on a DXF underlay, the drawing and the snap points resize together. With a DXF underlay, official Top/Bottom picks (including Draw room corners and Calibrate scale clicks) snap to endpoints, midpoints, and the nearest point on a segment within 8 CSS pixels. **Create rooms from DXF** makes rooms from closed polylines and from simple closed loops of connected lines on the current storey. It does not trace T-junctions or shared walls. New rooms use the official defaults (maintenance factor 0.80, no EN template, and the Building Room height). Scale follows the current **Calibrate scale**.

房間建立後，可在 **Select** 工具下於 **Top** 或 **Bottom** 平面圖拖移該房的填色範圍，把整個多邊形平移到新位置。矩形、L 形或不規則形狀都適用，形狀不變。該房內的燈具會一併移動，其他房間與樓層標高／層高不變。按住 **Shift** 可限制為水平或垂直移動。這次移動可用 **Ctrl+Z** 撤銷。單一燈具仍可用 **Select / move** 單獨拖移。

若已選房間，該房每個角點會出現控制點，邊上亦會出現較小的插入控制點。拖移角點控制點可在世界 XY 平面拉伸該既有角，其餘角點不動。拖移邊上的插入控制點，會在該邊最接近的位置加入新角點，並可在同一拖移中放到目標位置。若有 DXF 底圖，插入與拖移時會使用同一套物件吸附（目前縮放下 8 個 CSS 像素內的端點、中點或線段上最近點）；沒有吸附時，新角點先落在該邊上最接近游標的位置，其後跟隨游標的世界座標。靠近既有角點的位置不會插入，以免搶走角點控制點。在房間填色範圍內拖移（不是角點或邊上控制點）仍會移動整個房間，形狀不變。若插入或拉伸後房間少於 3 個不重複角點、輪廓自交，或面積小於 0.01 m²，會還原到插入或拖移前的多邊形（不會留下多出來的頂點），並在狀態列說明原因。將游標移到角點控制點上，或先點一下該控制點但不拖移以選取該角，再按 Delete 或 Backspace，即可刪除該角點。邊上的插入控制點不能刪除。只選了房間但未指定要刪的角點時按 Delete，不會刪除任何角，狀態列會提示先選擇角點。若刪除後房間少於 3 個不重複角點、輪廓自交，或面積小於 0.01 m²，則不改房間，並在狀態列說明原因。畫房草稿進行中，Backspace 仍會先清掉鎖定長度，再撤回上一個草稿角，行為不變。

若在左側 **Building** 樹選取的是樓層（該層平面被選取，而不是單一房間），用 **Select** 在該層任一房間的填色範圍上按下並拖曳，會把該層所有房間一次沿同一世界 XY 位移平移。各房形狀不變，屬於這些房間的燈具會一併移動（高度與旋轉不變）。其他樓層不會移動。允許房間重疊。計算結果會留在原位，直到再按 Calculate。若只是點一下房間而未拖移，仍會改為選取該房間；選取房間之後，拖移則只移動該房，行為與原本單一房間拖移相同。按住 **Shift** 同樣限制為水平或垂直。一次整層拖移可用 **Ctrl+Z** 撤銷。這不是平移圖面：左鍵在空白處拖曳仍不會移動視野；按住滑鼠中鍵拖曳才會平移。

在左側 **Building** 面板可設定 **Room height**（毫米，預設 2800）。未選房間時此欄仍可見，會用於下一間用 **Draw room**、**Create rectangle** 或 **Create rooms from DXF** 建立的房間。若已選房間，改此欄也會更新該房的天花板高度，其他房間不變。

矩形房間：在工具列輸入 **Length** 和 **Width**（毫米，或加 `m` / `cm` 後綴）後建立，房間會放在樓層原點 `(0, 0)`。高度取自 **Room height**。建立後可用 **Select** 拖移到圖則位置。

若目前樓層的底圖是已解析的 DXF，工具列的 **Create rooms from DXF** 會在該層為每條封閉折線，以及由相連線段組成的簡單閉合迴路，各建立一間房間。不會自動描繪 T 形交匯或共用牆的網絡。新房間使用官方預設（維護係數 0.80，不繼承所選房間的 EN 範本），高度取自 **Room height**，比例跟隨目前的 **Calibrate scale**。既有房間不會被改寫。

若要合併目前樓層上兩間重疊、或沿邊相接的房間，可在 Construction tools 按 **Union rooms**。在 **Select** 閒置時，若已選一間房，該房會作為保留的第一間，再於平面上點選第二間；若尚未選房，則依次點選兩間。按 **Esc** 可取消點選。第一間房會保留其識別碼、名稱、維護係數、EN 範本、高度及其他官方房間屬性；成功合併後第二間房會被移除。若兩房不在目前樓層、其中一間缺失、只在點上相觸或完全不相接，或合併結果會形成洞、自交、少於 3 個不重複角點、面積小於 0.01 m²，或無法得到單一簡單輪廓，指令會被拒絕，房間不變，並在狀態列說明原因。屬於被移除房間、且 XY 仍在合併後輪廓內的燈具會改歸保留房間；落在輪廓外的燈具留在該層並取消房間歸屬，燈具不會被刪除。計算結果會留在原位，直到再按 Calculate。一次成功合併可用 **Ctrl+Z** 整步撤銷。對齊不包括在內。

若要把目前樓層上一間房從另一間切走，可在 Construction tools 按 **Subtract rooms**。在 **Select** 閒置時，若已選一間房，該房會作為保留並被切割的第一間，再於平面上點選作為切割器的第二間；若尚未選房，則依次點選兩間。按 **Esc** 可取消點選。第一間房會保留其識別碼、名稱、維護係數、EN 範本、高度及其他官方房間屬性，輪廓改為「第一間減第二間」的單一外輪廓。切割器房間會留在原位，不會被刪除。若兩房不在目前樓層、其中一間缺失、兩次點到同一間房、面積沒有重疊（只沿邊相觸或完全不相接不算切割），或結果會變成空、裂成兩塊或以上互不相連的部分、形成洞、自交、少於 3 個不重複角點、面積小於 0.01 m²，或無法得到單一簡單輪廓，指令會被拒絕，房間不變，並在狀態列說明原因。屬於保留房間、且 XY 已不在切割後輪廓內的燈具會取消房間歸屬；切割器房間的燈具不變。燈具不會被刪除。計算結果會留在原位，直到再按 Calculate。一次成功差集可用 **Ctrl+Z** 整步撤銷。此增量不包括對齊。

若要把目前樓層上兩間房的重疊部分留下，可在 Construction tools 按 **Intersect rooms**。在 **Select** 閒置時，若已選一間房，該房會作為保留的第一間，再於平面上點選第二間；若尚未選房，則依次點選兩間。按 **Esc** 可取消點選。第一間房會保留其識別碼、名稱、維護係數、EN 範本、高度及其他官方房間屬性，輪廓改為兩房重疊範圍的單一外輪廓。成功後第二間房會被移除。若兩房不在目前樓層、其中一間缺失、兩次點到同一間房、面積沒有重疊（只沿邊相觸或完全不相接不算交集），或結果會變成空、裂成兩塊或以上互不相連的部分、形成洞、自交、少於 3 個不重複角點、面積小於 0.01 m²，或無法得到單一簡單輪廓，指令會被拒絕，房間不變，並在狀態列說明原因。屬於任一間房、且 XY 仍在交集輪廓內的燈具會改歸保留房間；落在輪廓外的燈具留在該層並取消房間歸屬。燈具不會被刪除。計算結果會留在原位，直到再按 Calculate。一次成功交集可用 **Ctrl+Z** 整步撤銷。此增量不包括對齊。

若要把目前樓層上兩間房的互斥部分留下（第一間 XOR 第二間），可在 Construction tools 按 **XOR rooms**。在 **Select** 閒置時，若已選一間房，該房會作為保留的第一間，再於平面上點選第二間；若尚未選房，則依次點選兩間。按 **Esc** 可取消點選。第一間房會保留其識別碼、名稱、維護係數、EN 範本、高度及其他官方房間屬性，輪廓改為對稱差的單一外輪廓。成功後第二間房會被移除。若兩房不在目前樓層、其中一間缺失、兩次點到同一間房、面積沒有重疊（只沿邊相觸或完全不相接不算 XOR），或結果會變成空、裂成兩塊或以上互不相連的部分（兩房都留下剩餘部分時通常如此）、形成洞（包括一間完全落在另一間內部）、自交、少於 3 個不重複角點、面積小於 0.01 m²，或無法得到單一簡單輪廓，指令會被拒絕，房間不變，並在狀態列說明原因。若第二間房是咬住第一間外輪廓的一角或一邊，結果可以是單一 L 形或帶缺口的輪廓。屬於任一間房、且 XY 仍在 XOR 輪廓內的燈具會改歸保留房間；落在輪廓外的燈具留在該層並取消房間歸屬。燈具不會被刪除。計算結果會留在原位，直到再按 Calculate。一次成功 XOR 可用 **Ctrl+Z** 整步撤銷。此增量不包括對齊。

若要把目前樓層上的房間對齊參考房間，可在 Construction tools 按 **Align rooms**。先選對齊方式（Left、Right、Top、Bottom、H centre 或 V centre；預設為 Left），再於 **Select** 閒置時點選房間：若已選一間房，該房會作為參考（不移動），再於平面上點選要移動的第二間；若尚未選房，則依次點選參考房間與要移動的房間。按 **Esc** 可取消點選。第二間房會平移，使其包圍盒的對應邊或中心與參考房間對齊；形狀不變，參考房間留在原位。兩間房都會保留。屬於被移動房間的燈具會跟隨同一平移，燈具不會被刪除。若兩房不在目前樓層、其中一間缺失、兩次點到同一間房、該房已經對齊（無需移動），或移動後會自交、少於 3 個不重複角點、面積小於 0.01 m²，指令會被拒絕，房間不變，並在狀態列說明原因。計算結果會留在原位，直到再按 Calculate。一次成功對齊可用 **Ctrl+Z** 整步撤銷。此增量不包括均勻分布。

若要在目前樓層上把三間或以上房間沿一軸均勻分布，可在 Construction tools 按 **Distribute rooms**。先選軸向（Horizontal 或 Vertical；預設為 Horizontal），再於 **Select** 閒置時點選至少三間房，然後按 **Enter** 套用。若已選一間房，該房會作為點選集合的第一間。房間按包圍盒的前緣（水平為最小 X，垂直為最小 Y）排序；該順序的第一間與最後一間留在原位，中間的房間會平移，使相鄰包圍盒之間的間隙相等。形狀不變。屬於被移動房間的燈具會跟隨同一平移，燈具不會被刪除。若房間不在目前樓層、其中一間缺失、選取少於三間、房間已經均勻分布，或移動後會自交、少於 3 個不重複角點、面積小於 0.01 m²，指令會被拒絕，房間不變，並在狀態列說明原因。計算結果會留在原位，直到再按 Calculate。一次成功分布可用 **Ctrl+Z** 整步撤銷。按 **Esc** 或再按一次 **Distribute rooms** 可取消點選。

On **Construction**, choose **Draw room** on the **Top** or **Bottom** view:

1. Left-click each corner.
2. Type a length (millimetres by default). The next point is locked to a circle of that radius around the last corner; the pointer only sets the direction.
3. Hold **Shift** to constrain to horizontal or vertical.
4. Click near the first corner, or press **Enter** when close to it, to close the room.
5. If a length is typed and locked, one **Backspace** clears that whole length. The next **Backspace** removes the last corner.
6. **Esc** cancels the draft while you are drawing. It does not exit the browser’s fullscreen view. When you are not drawing, **Esc** can still exit fullscreen.

After a room is created, choose the **Select** tool and drag the room fill on the **Top** or **Bottom** plan to move the whole polygon (rectangle, L-shape, or irregular) without changing its shape. Fixtures that belong to that room move with it. Other rooms and the storey's elevation / height stay as they are. Hold **Shift** to constrain the move to horizontal or vertical. **Ctrl+Z** undoes the move. Use **Select / move** to drag a single fixture on its own.

With a room selected, drag a corner handle to stretch that existing vertex in world XY; the rest of the polygon stays put. Drag a smaller mid-edge handle to insert a new corner at the closest point on that edge (or on a DXF object snap when one is in range) and place it in the same drag. When a DXF underlay is present, the same official object snap applies to inserts and stretches (endpoint, midpoint, or nearest-on-segment within 8 CSS pixels). If no snap is in range, a new vertex starts on the closest point on the edge, then follows the raw world point. A mid-edge hit uses the same 8 CSS-pixel aperture, excluding a margin around the two endpoints so it cannot steal a corner handle. Drag the room fill still moves the whole room without changing its shape. If an insert or stretch would leave fewer than 3 unique corners, a self-crossing outline, or an area below 0.01 m², the polygon is reverted to its pre-insert or pre-drag shape (no stuck extra vertex) and the status bar explains why. With a room selected, hover a corner handle, or click a corner handle without dragging to select that vertex, then press Delete or Backspace to remove it. A mid-edge insert handle is not deletable. Pressing Delete with a room selected but no target vertex does not change the room; the status bar explains that you need a corner handle. If a delete would leave fewer than 3 unique corners, a self-crossing outline, or an area below 0.01 m², the room is left unchanged and the status bar explains why. Draw-room Backspace is unchanged: while a draft is active, one Backspace clears a locked typed length and the next drops the last draft corner.

If the **Building** tree selection is a storey (the plan / storey is selected, not a single room), use the **Select** tool and press-and-drag the fill of any room on that storey to translate every room on that storey by the same world XY delta. Room shapes stay the same. Fixtures whose room belongs to those rooms move with them (Z and rotation unchanged). Rooms on other storeys do not move. Overlap is allowed. Calculation results stay in place until you recalculate. A click without movement on a room still selects that room. Once a room is selected, drag still moves only that room, as before. Hold **Shift** to constrain the move to horizontal or vertical. **Ctrl+Z** undoes the whole-storey move as one step. This is not plan panning: left-dragging an empty area still does not move the view. Hold the middle mouse button to pan.

Set **Room height** in the **Building** panel (millimetres, default 2800) before you create a room. The field stays visible when no room is selected and is used for the next room you draw or create with **Draw room**, **Create rectangle**, or **Create rooms from DXF**. If a room is selected, changing it also updates that room’s ceiling. Other rooms stay as they are.

For a simple rectangle, enter **Length** and **Width** in millimetres (or with an `m` / `cm` suffix). The room is placed at the storey origin `(0, 0)`. Height comes from **Room height**. After creation, drag it with **Select** if you need to place it on the plan.

When the current storey’s underlay is a parsed DXF, **Create rooms from DXF** makes rooms from closed polylines and from simple closed loops of connected lines on that storey. It does not trace T-junctions or shared walls. New rooms use the official defaults (maintenance factor 0.80, no EN template inherited from the selected room) and the Building **Room height**. Scale follows the current **Calibrate scale**. Existing rooms are left unchanged.

To merge two rooms on the current storey that overlap or share an edge, use **Union rooms** in Construction tools. With **Select** idle, if a room is already selected it is the first (surviving) room and you then pick the second on the plan; otherwise pick two rooms in order. **Esc** cancels the pick. The first room keeps its id, name, maintenance factor, EN template, height, and other official room properties; the second room is removed after a successful union. The command is refused (status bar, no change) when the rooms are on different storeys, a room is missing, they only touch at a point or not at all, or the union would contain a hole, would cross itself, would have fewer than 3 unique vertices, would have area below 0.01 m², or would not be a single simple room. Fixtures that belonged to the removed room and still lie in the union are reassigned to the surviving room; fixtures that fall outside stay on the storey with their room assignment cleared. Luminaires are not deleted. Calculation results stay in place until you recalculate. **Ctrl+Z** undoes a successful union as one step. Alignment is not included.

To cut one room from another on the current storey, use **Subtract rooms** in Construction tools. With **Select** idle, if a room is already selected it is the first (kept) room and you then pick the cutter on the plan; otherwise pick two rooms in order. **Esc** cancels the pick. The first room keeps its id, name, maintenance factor, EN template, height, and other official room properties; its outline becomes first minus second as a single simple ring. The cutter room stays in place and is not deleted. The command is refused (status bar, no change) when the rooms are on different storeys, a room is missing, the same room is picked twice, the polygons do not overlap in area (edge-touch or disjoint is not a cut), or the result would be empty, would split into two or more disjoint pieces, would contain a hole, would cross itself, would have fewer than 3 unique vertices, would have area below 0.01 m², or would not be a single simple room. Fixtures assigned to the surviving room whose XY no longer lie in the cut outline are unassigned; fixtures of the cutter room are unchanged. Luminaires are not deleted. Calculation results stay in place until you recalculate. **Ctrl+Z** undoes a successful subtract as one step. Alignment is not included.

To keep only the overlapping area of two rooms on the current storey, use **Intersect rooms** in Construction tools. With **Select** idle, if a room is already selected it is the first (kept) room and you then pick the second on the plan; otherwise pick two rooms in order. **Esc** cancels the pick. The first room keeps its id, name, maintenance factor, EN template, height, and other official room properties; its outline becomes the intersection as a single simple ring. The second room is removed after a successful intersect. The command is refused (status bar, no change) when the rooms are on different storeys, a room is missing, the same room is picked twice, the polygons do not overlap in area (edge-touch or disjoint is not an intersection), or the result would be empty, would split into two or more disjoint pieces, would contain a hole, would cross itself, would have fewer than 3 unique vertices, would have area below 0.01 m², or would not be a single simple room. Fixtures of either room that still lie in the intersection are assigned to the surviving room; fixtures that fall outside stay on the storey with their room assignment cleared. Luminaires are not deleted. Calculation results stay in place until you recalculate. **Ctrl+Z** undoes a successful intersect as one step. Alignment is not included.

To keep only the exclusive parts of two rooms on the current storey (first XOR second), use **XOR rooms** in Construction tools. With **Select** idle, if a room is already selected it is the first (kept) room and you then pick the second on the plan; otherwise pick two rooms in order. **Esc** cancels the pick. The first room keeps its id, name, maintenance factor, EN template, height, and other official room properties; its outline becomes the symmetric difference as a single simple ring. The second room is removed after a successful XOR. The command is refused (status bar, no change) when the rooms are on different storeys, a room is missing, the same room is picked twice, the polygons do not overlap in area (edge-touch or disjoint is not an XOR), or the result would be empty, would split into two or more disjoint pieces (typical when both rooms have a remainder), would contain a hole (including a room strictly inside the other), would cross itself, would have fewer than 3 unique vertices, would have area below 0.01 m², or would not be a single simple room. A bite that shares the first room’s outer boundary can succeed as a single ring, such as an L-shape. Fixtures of either room that still lie in the XOR outline are assigned to the surviving room; fixtures that fall outside stay on the storey with their room assignment cleared. Luminaires are not deleted. Calculation results stay in place until you recalculate. **Ctrl+Z** undoes a successful XOR as one step. Alignment is not included.

To align a room to a reference room on the current storey, use **Align rooms** in Construction tools. Choose the alignment first (Left, Right, Top, Bottom, H centre, or V centre; Left is the default). With **Select** idle, if a room is already selected it is the reference (it stays put) and you then pick the room to move on the plan; otherwise pick the reference and the room to move in order. **Esc** cancels the pick. The second room is translated so the matching edge or centre of its bounding box lines up with the reference; its shape does not change, and the reference room stays in place. Both rooms are kept. Fixtures assigned to the moved room follow the same translation. Luminaires are not deleted. The command is refused (status bar, no change) when the rooms are on different storeys, a room is missing, the same room is picked twice, the room is already aligned, or the move would cross itself, would have fewer than 3 unique vertices, or would have area below 0.01 m². Calculation results stay in place until you recalculate. **Ctrl+Z** undoes a successful alignment as one step. Even spacing / distribute is not included.

To space three or more rooms evenly on the current storey, use **Distribute rooms** in Construction tools. Choose the axis first (Horizontal or Vertical; Horizontal is the default). With **Select** idle, click at least three rooms on the plan, then press **Enter** to apply. If a room is already selected it is the first room in the set. Rooms are ordered by the leading edge of the bounding box (min X horizontally, min Y vertically). The first and last rooms in that order stay put; interior rooms are translated so the gaps between consecutive bounding boxes are equal. Shapes do not change. Fixtures assigned to a moved room follow the same translation. Luminaires are not deleted. The command is refused (status bar, no change) when the rooms are on different storeys, a room is missing, fewer than three rooms are selected, the rooms are already evenly spaced, or a move would cross itself, would have fewer than 3 unique vertices, or would have area below 0.01 m². Calculation results stay in place until you recalculate. **Ctrl+Z** undoes a successful distribute as one step. **Esc**, or clicking **Distribute rooms** again, cancels the pick.

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

若要複製目前樓層，可在左側 **Building** 按 **Copy storey**。來源樓層及其房間、燈具維持不變。新樓層名稱為 **Copy of {名稱}**；若名稱已存在，則用 **Copy of {名稱} 2**、3，以此類推。新樓層會放在來源樓層正上方，標高為「來源標高 + 來源層高」，因此不會與來源樓板重疊；若該標高已被另一樓層佔用，會再按來源層高往上尋找空位。層高與來源相同。房間會連同平面輪廓、高度、物料反射率、維護係數、EN 目標及其他官方房間屬性一併複製，但使用新的識別碼。來源樓層上的燈具會以相同平面位置、安裝高度、旋轉及光度檔參考複製，並改歸到新房間；未歸屬的燈具在新樓層仍為未歸屬。底圖與計算結果不會被複製，須在新樓層再按 Calculate。成功後會選取新樓層，平面會顯示該層。一次成功複製可用 **Ctrl+Z** 整步撤銷。若目前沒有樓層、來源樓層缺失，或複製結果無效，指令會被拒絕，場景不變，並在狀態列說明原因。

To copy the current storey, use **Copy storey** in the **Building** panel. The source storey, its rooms, and its luminaires stay as they are. The new storey is named **Copy of {name}**, or **Copy of {name} 2**, 3, and so on if that name is already used. It is placed immediately above the source at source elevation + source storey height, so the new floor does not overlap the source slab. If another storey already occupies that elevation, the copy steps up by the source storey height until a free slot is found. The copy keeps the source storey height. Rooms are copied with the same plan polygons, heights, materials, maintenance factor, EN targets, and other official room properties, but with new ids. Luminaires on the source storey are copied with the same plan position, mounting height, rotation, and photometry reference, and reassigned to the new rooms; unassigned luminaires stay unassigned on the copy. Underlays and calculation results are not copied — run **Calculate** on the new storey. After a successful copy, the new storey is selected so the plan shows it. **Ctrl+Z** undoes a successful copy as one step. The command is refused (status bar, no change) when the building has no storey, the current storey is missing, or the copy would not be a valid storey.

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

1. 用 **Count** 和 **Rotation** 放置燈具。若未點選自訂路徑，路徑是所選房間的官方封閉輪廓，由第一個角點（Origin）開始，沿周長均勻分布。
2. 可在 **Top** 或 **Bottom** 平面圖上逐點點選自訂路徑，座標使用當前縮放或貼合後的世界座標。路徑完成後，再點一下會開始一條新路徑。
3. 按 **Enter** 或在空白處雙擊，可完成一條開放路徑。在目前縮放下點近第一個頂點（約 4 CSS 像素，與整層拖移的點擊容差同一量級）則閉合路徑。未完成路徑時按 **Esc** 會取消該路徑，回到房間輪廓後備；即使瀏覽器處於全畫面，也不會因此退出全畫面。沒有未完成路徑時，**Esc** 仍可用來退出全畫面。點 **Clear path** 同樣回到房間輪廓後備，也不會退出全畫面。
4. 封閉的自訂路徑（以及未點選時的房間輪廓）沿路徑間距是周長除以 **Count**，因此第一點與最後一點不會重疊在閉合頂點上。**Count** 為 1 時，單一燈具放在第一個角點；自訂路徑則放在第一個點選頂點。開放的自訂路徑由起點到終點均勻分布，**Count** ≥ 2 時包含兩端；**Count** 為 1 時，單一燈具放在起點。
5. **Rotation** 是燈具朝向，與直線和圓形模式相同，不會自動沿切線或指向室內。
6. Spacing X、Spacing Y 與離牆在多邊形模式維持停用。多邊形排列只沿房間輪廓或自訂路徑放置，不會用這些欄位做內縮或再排第二圈。矩形排列才使用這些欄位。目標照度估算仍只用矩形網格，沒有多邊形目標照度路徑。
7. 落在房間多邊形外的點不會放置；剛好在房間邊上的點視為有效。自訂路徑的頂點可以在房間內；規劃點若在房間多邊形外仍會丟棄。與同房已有燈具相距 1 mm 內的點會略過，既有燈具不會被刪除。預覽會顯示已佔略過數，並在點選中及設定後顯示自訂路徑。點選自訂路徑進行中，雙擊空白處不會重置視野（會用來完成開放路徑），仍可用滾輪縮放。畫房、校正、直線或圓心點選進行中不會開始多邊形路徑點選；路徑點選進行中，不會開始拖移燈具、房間或樓層。

In **Light** mode, select a room in the building tree, then choose **Polygon** in **Arrange**.

1. Place fixtures with **Count** and **Rotation**. If you do not pick a custom path, the path is the selected room’s official closed outline, starting at the first corner (Origin), with fixtures spaced equally along the perimeter.
2. Click on the **Top** or **Bottom** plan to add path vertices in the current zoomed or fitted world coordinates. After a path is finished, a later click starts a new path.
3. **Enter** or a double-click on empty background finishes an open path. Click near the first vertex (within about 4 CSS pixels at the current zoom, the same order as the storey-drag click slop) to close the path. **Esc** cancels an unfinished path and returns to the room-outline fallback. It does not exit the browser’s fullscreen view. When you are not mid-pick, **Esc** can still exit fullscreen. **Clear path** also returns to the room-outline fallback and does not exit fullscreen.
4. A closed custom path, and the room outline when no custom path is set, uses spacing equal to the perimeter divided by **Count**, so the first and last points do not coincide on the closing vertex. When **Count** is 1, the single fixture sits at the first corner, or at the first picked vertex on a custom path. An open custom path spaces fixtures equally from start to end, including the endpoints when **Count** ≥ 2; when **Count** is 1, the single fixture sits at the start.
5. **Rotation** is the fixture orientation, as in Line and Circle modes; fixtures are not aimed along the tangent or inward.
6. **Spacing X, Spacing Y and wall offset stay disabled** in Polygon mode because a polygon array places fixtures on the room outline or a custom path. Those fields are used by Rectangular arrays. There is no inset or second ring. Target-Ēm estimate still uses a rectangular grid only.
7. Points outside the room polygon are not placed. Points that lie exactly on the room edge are treated as valid. Custom-path vertices may lie inside the room; planned points outside the room polygon are still dropped. Points within 1 mm of an existing fixture in the same room are skipped; existing fixtures are kept. The preview still shows the skipped occupied count, and the custom path is visible while picking and after it is set. While you are mid-pick, double-click does not reset the view (it finishes an open path); wheel zoom still works toward the cursor. Polygon path pick does not start during Draw room, calibrate, or a mid line or circle pick. Fixture hits, room drag, and storey drag do not start while a polygon path is mid-pick.

## 等照度線與數值圖 / Isolines and value labels

在 **Top** 或 **Bottom** 視圖，若所選房間已有計算結果，可在圖面左上角、與視圖及 Fullscreen 按鈕同一組浮動控制中，切換 **False colour**（偽色）和 **Isolines**（等照度線），並可勾選 **Value labels**（數值圖）在工作面網格上顯示或隱藏照度數值。在 **3D** 視圖，可在既有的 **Greyscale**（灰階）和 **False colour** 之外切換 **Isolines**，把同一套等照度線畫在該房工作面高度上，並使用同一個 **Value labels** 開關顯示或隱藏網格數值。偽色、等照度線與數值都來自同一套計算結果與刻度，不會另造一種光度量。沒有結果的房間不會發明數字：等照度線與數值圖切換會停用，並提示先執行 **Calculate**。本產品沒有自訂等照度線預設。

匯出 **Full PDF report** 時，每間已計算房間的摘要會附上工作面等照度線圖，並標上沿線數值與網格數值。即使 3D 視圖未能擷取，這些由平面模型產生的圖仍會匯出。既有的偽色工作面圖與 3D 灰階／偽色章節維持不變；報告不會另增一章 3D 等照度線，也不會拿掉既有的 2D 等照度線圖。

On the **Top** or **Bottom** view, when the selected room has calculation results, use the floating controls at the top left of the plan, next to the view and Fullscreen buttons, to switch between **False colour** and **Isolines**, and tick **Value labels** to show or hide illuminance values on the workplane grid. On the **3D** view, **Isolines** is an additional display mode beside **Greyscale** and **False colour**. It draws the same isolines on the workplane at the room’s workplane height, and uses the same **Value labels** control to show or hide grid values. False colour, isolines, and the labels all come from the same calculation results and scale; they do not invent a third photometric quantity. Rooms without results do not invent numbers: the isoline and value-label controls are disabled and ask you to run **Calculate** first. There are no custom isoline presets.

When you export the **Full PDF report**, each calculated room’s Summary includes a working-plane isolux diagram with isolines, contour labels, and value labels. These 2D figures are still exported if 3D views cannot be captured. Existing false-colour workplane figures and 3D greyscale / false-colour chapters are unchanged. The report does not add a separate 3D-isoline chapter, and it does not drop the existing 2D isolux snapshots.


## 房間屬性 / Room properties

選取房間後，右側 **Properties** 會顯示：

- **Area** — 房間面積
- **Origin (first corner)** — 第一個角點的位置
- **Bounding min** — 只在第一個角點不是外接矩形的最小角時顯示

After you select a room, **Properties** shows **Area**, **Origin (first corner)**, and **Bounding min** when the first corner is not the bounding-box minimum.

其他功能（計算、燈具庫、報告匯出等）可先使用編輯器工具旁的「？」提示。本手冊會隨新操作繼續補上。

Other tools, calculation, the library, and exports are described by the **?** tips next to those controls. This guide will be extended as further operations are documented.
