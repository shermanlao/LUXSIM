import { describe, expect, it } from "vitest";
import { defaultSceneV2 } from "@luxsim/project-io";
import { projectPatchDiff, snapshotProject } from "./project-autosave";
import { DEFAULT_AUTOSAVE_MS } from "./account-settings";

describe("projectPatchDiff", () => {
  const scene = defaultSceneV2();
  const results = { version: 2 as const, byRoomId: {} };

  it("returns null when nothing changed", () => {
    const snap = snapshotProject("A", scene, results);
    expect(projectPatchDiff(snap, snap, scene, results)).toBeNull();
  });

  it("does not set a body (no save) for an empty diff", () => {
    const last = snapshotProject("A", scene, results);
    const cur = snapshotProject("A", scene, results);
    expect(projectPatchDiff(cur, last, scene, results)).toBeNull();
  });

  it("sends only the name when the title changes", () => {
    const last = snapshotProject("A", scene, results);
    const cur = snapshotProject("B", scene, results);
    expect(projectPatchDiff(cur, last, scene, results)).toEqual({ name: "B" });
  });

  it("omits results when only persistable scene data changed", () => {
    const last = snapshotProject("A", scene, results);
    const nextScene = {
      ...scene,
      rooms: scene.rooms,
      fixtureLibraryIds: [...scene.fixtureLibraryIds, "lum_new"],
    };
    const cur = snapshotProject("A", nextScene, results);
    const diff = projectPatchDiff(cur, last, nextScene, results);
    expect(diff).toEqual({ scene: nextScene });
    expect(diff).not.toHaveProperty("results");
    expect(diff).not.toHaveProperty("name");
  });

  it("does not PATCH when only ephemeral UI changed", () => {
    const last = snapshotProject("A", scene, results);
    const nextScene = {
      ...scene,
      ui: {
        ...scene.ui,
        tool: "drawRoom" as const,
        viewMode: "persp3d" as const,
        activeRoomId: "room-temp",
        camera3d: { target: [0, 0, 0] as [number, number, number], position: [1, 1, 1] as [number, number, number] },
        display3d: "falsecolor" as const,
      },
    };
    const cur = snapshotProject("A", nextScene, results);
    expect(projectPatchDiff(cur, last, nextScene, results)).toBeNull();
  });

  it("includes current UI/camera on the full scene when a real change is saved", () => {
    const last = snapshotProject("A", scene, results);
    const nextScene = {
      ...scene,
      fixtureLibraryIds: [...scene.fixtureLibraryIds, "lum_new"],
      ui: { ...scene.ui, viewMode: "persp3d" as const, tool: "select" as const },
    };
    const cur = snapshotProject("A", nextScene, results);
    const diff = projectPatchDiff(cur, last, nextScene, results);
    expect(diff?.scene?.ui.viewMode).toBe("persp3d");
  });
});

describe("autosave default", () => {
  it("is 5 minutes, not 800 ms", () => {
    expect(DEFAULT_AUTOSAVE_MS).toBe(300_000);
    expect(DEFAULT_AUTOSAVE_MS).not.toBe(800);
    expect(DEFAULT_AUTOSAVE_MS).not.toBe(60_000);
  });
});
