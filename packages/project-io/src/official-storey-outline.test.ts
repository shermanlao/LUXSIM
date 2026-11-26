import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { defaultSceneV2, rectPolygon } from "./index";
import {
  officialSetStoreyOutline,
  officialValidateSimplePolygon,
  STOREY_OUTLINE_CREATED_STATUS,
  STOREY_OUTLINE_REFUSE_AREA_STATUS,
  STOREY_OUTLINE_REFUSE_CROSS_STATUS,
  STOREY_OUTLINE_REFUSE_VERTICES_STATUS,
  STOREY_OUTLINE_REPLACED_STATUS,
} from "./official-storey-outline";

function editorSrc() {
  return readFileSync(
    path.join(process.cwd(), "src/components/editor/BuildingEditor.tsx"),
    "utf8"
  );
}

describe("official storey outline", () => {
  it("creates and replaces storey.outline without adding a room", () => {
    const scene = defaultSceneV2();
    const first = officialSetStoreyOutline(scene, scene.storeys[0]!.id, rectPolygon(0, 0, 10, 8));
    expect(first.ok).toBe(true);
    expect(first.created).toBe(true);
    expect(first.status).toBe(STOREY_OUTLINE_CREATED_STATUS);
    expect(first.scene.rooms).toEqual(scene.rooms);
    expect(first.scene.storeys[0]!.outline).toEqual(rectPolygon(0, 0, 10, 8));

    const replaced = officialSetStoreyOutline(
      first.scene,
      first.scene.storeys[0]!.id,
      rectPolygon(1, 1, 6, 5)
    );
    expect(replaced.ok).toBe(true);
    expect(replaced.replaced).toBe(true);
    expect(replaced.status).toBe(STOREY_OUTLINE_REPLACED_STATUS);
    expect(replaced.scene.rooms).toHaveLength(0);
    expect(replaced.scene.storeys[0]!.outline).toEqual(rectPolygon(1, 1, 6, 5));
  });

  it("refuses invalid polygons and leaves the storey unchanged", () => {
    const scene = defaultSceneV2();
    const few = officialSetStoreyOutline(scene, scene.storeys[0]!.id, [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
    expect(few.ok).toBe(false);
    expect(few.status).toBe(STOREY_OUTLINE_REFUSE_VERTICES_STATUS);
    expect(few.scene).toBe(scene);
    expect(few.scene.storeys[0]!.outline).toBeUndefined();

    const bow = officialSetStoreyOutline(scene, scene.storeys[0]!.id, [
      { x: 0, y: 0 },
      { x: 2, y: 2 },
      { x: 2, y: 0 },
      { x: 0, y: 2 },
    ]);
    expect(bow.ok).toBe(false);
    expect(bow.status).toBe(STOREY_OUTLINE_REFUSE_CROSS_STATUS);
    expect(bow.scene).toBe(scene);

    const tiny = officialSetStoreyOutline(scene, scene.storeys[0]!.id, rectPolygon(0, 0, 0.05, 0.05));
    expect(tiny.ok).toBe(false);
    expect(tiny.status).toBe(STOREY_OUTLINE_REFUSE_AREA_STATUS);
    expect(officialValidateSimplePolygon(rectPolygon(0, 0, 0.05, 0.05)).ok).toBe(false);
  });

  it("loads a legacy storey without an outline", () => {
    const scene = defaultSceneV2();
    expect(scene.storeys[0]!.outline).toBeUndefined();
    expect("outline" in scene.storeys[0]!).toBe(false);
  });

  it("wires the Draw storey contour tool and an undoable write path", () => {
    const src = editorSrc();
    const top = readFileSync(
      path.join(process.cwd(), "src/components/editor/TopView2D.tsx"),
      "utf8"
    );
    expect(src).toContain('["drawStoreyContour", "Draw storey contour"');
    expect(src).toContain("onDrawStoreyContour={drawStoreyContour}");
    expect(src).toContain("officialSetStoreyOutline");
    expect(src).toContain("function drawStoreyContour");
    expect(top).toContain("onDrawStoreyContour");
    expect(top).toContain("drawingContour");
    expect(top).toContain('data-storey-contour=""');
    expect(top).toContain("finishDraft");
  });
});
