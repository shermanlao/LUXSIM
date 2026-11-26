import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultSceneV2, type ProjectSceneV2 } from "@luxsim/project-io";
import {
  BUILD_MODEL_FIRST_BODY_EN,
  BUILD_MODEL_FIRST_BODY_ZH,
  BUILD_MODEL_FIRST_OK_LABEL,
  BUILD_MODEL_FIRST_TITLE_EN,
  BUILD_MODEL_FIRST_TITLE_ZH,
  officialHasValidStoreyContour,
  officialNeedsBuildBefore3d,
  officialShouldPromptBuildBefore3d,
} from "./official-needs-build-before-3d";

const root = path.resolve(__dirname, "../..");

function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

function withRooms(scene: ProjectSceneV2, rooms: ProjectSceneV2["rooms"], storeys = scene.storeys): ProjectSceneV2 {
  return { ...scene, storeys, rooms };
}

describe("officialNeedsBuildBefore3d", () => {
  it("is true for a default project with one empty storey and zero rooms", () => {
    const scene = defaultSceneV2();
    expect(scene.storeys).toHaveLength(1);
    expect(scene.rooms).toHaveLength(0);
    expect(officialNeedsBuildBefore3d(scene)).toBe(true);
  });

  it("is true when there is no storey contour and no rooms", () => {
    const base = defaultSceneV2();
    expect(officialNeedsBuildBefore3d({ storeys: [], rooms: [] })).toBe(true);
    expect(officialNeedsBuildBefore3d(withRooms(base, [], []))).toBe(true);
    expect(officialNeedsBuildBefore3d(withRooms(base, []))).toBe(true);
    expect(officialHasValidStoreyContour(base)).toBe(false);
  });

  it("is false when any storey has a valid storey contour even with zero rooms", () => {
    const base = defaultSceneV2();
    const withContour: ProjectSceneV2 = {
      ...base,
      storeys: [
        {
          ...base.storeys[0]!,
          outline: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 8 },
            { x: 0, y: 8 },
          ],
        },
      ],
      rooms: [],
    };
    expect(officialHasValidStoreyContour(withContour)).toBe(true);
    expect(officialNeedsBuildBefore3d(withContour)).toBe(false);
    expect(officialShouldPromptBuildBefore3d("top", "persp3d", withContour)).toBe(false);
  });

  it("is false when any storey has been kept and at least one room exists on any storey", () => {
    const base = defaultSceneV2();
    const storeyId = base.storeys[0]!.id;
    const room = {
      id: "room-1",
      storeyId,
      name: "Room 1",
      polygon: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 3 },
        { x: 0, y: 3 },
      ],
      heightM: 3,
      workplaneHeightM: 0.8,
      reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
      calc: { gridSpacing: 0.25, interreflection: true, bounces: 3, computeUgr: false, maintenanceFactor: 0.8 },
    };
    expect(officialNeedsBuildBefore3d(withRooms(base, [room]))).toBe(false);

    const second = { ...base.storeys[0]!, id: "storey-2", name: "1F", elevationM: 3 };
    const roomOnSecond = { ...room, id: "room-2", storeyId: second.id };
    expect(
      officialNeedsBuildBefore3d(withRooms(base, [roomOnSecond], [...base.storeys, second])),
    ).toBe(false);
  });
});

describe("officialShouldPromptBuildBefore3d", () => {
  const empty = defaultSceneV2();
  const built = withRooms(empty, [
    {
      id: "room-1",
      storeyId: empty.storeys[0]!.id,
      name: "Room 1",
      polygon: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 3 },
        { x: 0, y: 3 },
      ],
      heightM: 3,
      workplaneHeightM: 0.8,
      reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
      calc: { gridSpacing: 0.25, interreflection: true, bounces: 3, computeUgr: false, maintenanceFactor: 0.8 },
    },
  ]);

  it("prompts only when leaving another view for 3D and the model is not built", () => {
    expect(officialShouldPromptBuildBefore3d("top", "persp3d", empty)).toBe(true);
    expect(officialShouldPromptBuildBefore3d("front", "persp3d", empty)).toBe(true);
    expect(officialShouldPromptBuildBefore3d("side", "persp3d", empty)).toBe(true);
    expect(officialShouldPromptBuildBefore3d("top", "persp3d", built)).toBe(false);
  });

  it("does not re-open when already in 3D, and does not gate Front or Side", () => {
    expect(officialShouldPromptBuildBefore3d("persp3d", "persp3d", empty)).toBe(false);
    expect(officialShouldPromptBuildBefore3d("top", "front", empty)).toBe(false);
    expect(officialShouldPromptBuildBefore3d("top", "side", empty)).toBe(false);
    expect(officialShouldPromptBuildBefore3d("persp3d", "front", empty)).toBe(false);
    expect(officialShouldPromptBuildBefore3d("persp3d", "side", empty)).toBe(false);
  });
});

describe("build-model-first dialog copy and wiring", () => {
  const helper = read("src/lib/official-needs-build-before-3d.ts");
  const dialog = read("src/components/editor/BuildModelFirstDialog.tsx");
  const editor = read("src/components/editor/BuildingEditor.tsx");
  const css = read("src/app/globals.css");
  const guide = read("docs/USER_GUIDE.md");

  it("has bilingual copy, a single OK button, aria-modal, and no DIALux wording", () => {
    expect(BUILD_MODEL_FIRST_TITLE_EN).toBe("Build the model first");
    expect(BUILD_MODEL_FIRST_TITLE_ZH).toBe("請先建立模型");
    expect(BUILD_MODEL_FIRST_BODY_EN).toBe(
      "Add a storey contour or at least one room before opening the 3D view.",
    );
    expect(BUILD_MODEL_FIRST_BODY_ZH).toBe(
      "請先新增樓層輪廓或至少一個房間，再開啟 3D 視圖。",
    );
    expect(BUILD_MODEL_FIRST_OK_LABEL).toBe("OK");
    expect(dialog).toContain('role="dialog"');
    expect(dialog).toContain('aria-modal="true"');
    expect(dialog).toContain("BUILD_MODEL_FIRST_OK_LABEL");
    expect(dialog).toContain("onClick={onDismiss}");
    expect(dialog).toContain('event.key !== "Escape"');
    expect(dialog).not.toMatch(/DIALux|\bevo\b/i);
    expect(helper).not.toMatch(/DIALux|\bevo\b/i);
    expect(css).toContain(".build-model-first-backdrop");
    expect(css).toContain(".build-model-first-dialog");
  });

  it("wires the 3D view button through switchOfficialView and does not change the view when prompting", () => {
    expect(editor).toContain("BuildModelFirstDialog");
    expect(editor).toContain("officialShouldPromptBuildBefore3d");
    expect(editor).toContain("setBuildModelFirstOpen(true)");
    expect(editor).toContain("onClick={() => switchOfficialView(mode)}");

    const fnStart = editor.indexOf("function switchOfficialView(mode: ViewMode)");
    expect(fnStart).toBeGreaterThan(-1);
    const fnEnd = editor.indexOf("\n  }", fnStart);
    const fn = editor.slice(fnStart, fnEnd);
    const promptIdx = fn.indexOf("officialShouldPromptBuildBefore3d");
    const waitIdx = fn.indexOf("officialWait.run");
    const patchIdx = fn.indexOf("viewMode: mode");
    expect(promptIdx).toBeGreaterThan(-1);
    expect(fn).toContain("if (!shouldWaitForOfficialViewSwitch(viewMode, mode)) return;");
    expect(promptIdx).toBeLessThan(waitIdx);
    expect(promptIdx).toBeLessThan(patchIdx);
    expect(fn).toContain("setBuildModelFirstOpen(true)");
    expect(fn).toContain("return;");
    const afterPrompt = fn.slice(promptIdx);
    const returnIdx = afterPrompt.indexOf("return;");
    const waitAfter = afterPrompt.indexOf("officialWait.run");
    expect(returnIdx).toBeGreaterThan(-1);
    expect(returnIdx).toBeLessThan(waitAfter);

    expect(guide).toContain("請先建立模型");
    expect(guide).toContain("the model must be built first");
    expect(guide).toContain("不會切換視圖");
    expect(guide).toContain("does not switch the view");
    expect(guide).not.toMatch(/DIALux/);
  });
});
