import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { OFFICIAL_WAIT_COPY } from "./official-wait-dialog";
import {
  officialViewSwitchReady,
  shouldWaitForOfficialViewSwitch,
  VIEW_SWITCH_READY_TIMEOUT_MS,
} from "./official-view-switch";

const root = path.resolve(__dirname, "../..");

describe("official view-switch loading", () => {
  it("uses the shared Loading copy and waits only when the view actually changes", () => {
    expect(OFFICIAL_WAIT_COPY.loadingView).toEqual({
      titleEn: "Loading…",
      titleZh: "正在載入…",
    });
    expect(OFFICIAL_WAIT_COPY.loading3d).toEqual(OFFICIAL_WAIT_COPY.loadingView);
    expect(shouldWaitForOfficialViewSwitch("top", "persp3d")).toBe(true);
    expect(shouldWaitForOfficialViewSwitch("persp3d", "front")).toBe(true);
    expect(shouldWaitForOfficialViewSwitch("top", "top")).toBe(false);
    expect(VIEW_SWITCH_READY_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it("resolves when the view signals ready, and also if the timeout elapses first", async () => {
    let resolveReady!: () => void;
    const ready = new Promise<void>((r) => {
      resolveReady = r;
    });
    const pending = officialViewSwitchReady(ready, 20_000);
    resolveReady();
    await pending;

    const started = Date.now();
    await officialViewSwitchReady(new Promise(() => {}), 20);
    expect(Date.now() - started).toBeGreaterThanOrEqual(15);
  });

  it("documents the Loading dialog in the user guide", () => {
    const guide = readFileSync(path.join(root, "docs/USER_GUIDE.md"), "utf8");
    expect(guide).toContain("Loading…");
    expect(guide).toContain("正在載入…");
    expect(guide).toContain("切換 **Top**、**Front**、**Side** 或 **3D**");
    expect(guide).toContain("Switching between **Top**, **Front**, **Side**, and **3D**");
  });

  it("wires the official wait dialog to the view tabs in the editor", () => {
    const editor = readFileSync(path.join(root, "src/components/editor/BuildingEditor.tsx"), "utf8");
    expect(editor).toContain("officialWait.run(OFFICIAL_WAIT_COPY.loadingView");
    expect(editor).toContain("shouldWaitForOfficialViewSwitch");
    expect(editor).toContain("officialViewSwitchReady");
    expect(editor).toContain("onViewReady");
    const scene = readFileSync(path.join(root, "src/components/editor/BuildingScene3D.tsx"), "utf8");
    expect(scene).toContain("onViewReady");
    expect(scene).toContain("ViewReadySignal");
  });
});
