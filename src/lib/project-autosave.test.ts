import { describe, expect, it } from "vitest";
import { defaultSceneV2 } from "@luxsim/project-io";
import { projectPatchDiff, snapshotProject } from "./project-autosave";

describe("projectPatchDiff", () => {
  const scene = defaultSceneV2();
  const results = { version: 2 as const, byRoomId: {} };

  it("returns null when nothing changed", () => {
    const snap = snapshotProject("A", scene, results);
    expect(projectPatchDiff(snap, snap, scene, results)).toBeNull();
  });

  it("sends only the name when the title changes", () => {
    const last = snapshotProject("A", scene, results);
    const cur = snapshotProject("B", scene, results);
    expect(projectPatchDiff(cur, last, scene, results)).toEqual({ name: "B" });
  });

  it("omits results when only the scene changed", () => {
    const last = snapshotProject("A", scene, results);
    const nextScene = { ...scene, ui: { ...scene.ui, tool: "drawRoom" as const } };
    const cur = snapshotProject("A", nextScene, results);
    const diff = projectPatchDiff(cur, last, nextScene, results);
    expect(diff).toEqual({ scene: nextScene });
    expect(diff).not.toHaveProperty("results");
    expect(diff).not.toHaveProperty("name");
  });
});
