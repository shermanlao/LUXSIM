import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ResultsV2 } from "@luxsim/project-io";
import {
  DISCARD_RESULTS_BODY_EN,
  DISCARD_RESULTS_BODY_ZH,
  DISCARD_RESULTS_CANCEL_LABEL,
  DISCARD_RESULTS_CONFIRM_LABEL,
  DISCARD_RESULTS_TITLE_EN,
  DISCARD_RESULTS_TITLE_ZH,
  decideFixtureChange,
  resultsAfterDiscardConfirm,
  roomIdsWithResults,
} from "./discard-results-confirm";

const root = path.resolve(__dirname, "../..");

function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

function stubRoomResults(): ResultsV2["byRoomId"][string] {
  return { summary: { eave: 100 } } as ResultsV2["byRoomId"][string];
}

function resultsWithRooms(ids: string[]): ResultsV2 {
  const byRoomId: ResultsV2["byRoomId"] = {};
  for (const id of ids) byRoomId[id] = stubRoomResults();
  return { version: 2, byRoomId };
}

describe("decideFixtureChange", () => {
  it("applies immediately when the affected rooms have no results", () => {
    const results = resultsWithRooms(["other"]);
    const decision = decideFixtureChange(results, ["room-a"]);
    expect(decision).toEqual({ action: "apply", roomIdsToClear: [] });
    expect(roomIdsWithResults(results, ["room-a", ""])).toEqual([]);
  });

  it("asks for confirmation only when the affected room has results", () => {
    const results = resultsWithRooms(["room-a", "room-b"]);
    expect(decideFixtureChange(results, ["room-a"])).toEqual({
      action: "confirm",
      roomIdsToClear: ["room-a"],
    });
    expect(decideFixtureChange(results, ["room-c", "room-b"])).toEqual({
      action: "confirm",
      roomIdsToClear: ["room-b"],
    });
  });

  it("discards only the affected-room results on confirm", () => {
    const results: ResultsV2 = {
      version: 2,
      byRoomId: {
        "room-a": stubRoomResults(),
        "room-b": stubRoomResults(),
      },
      wallsByRoomId: {
        "room-a": { faces: [] } as NonNullable<ResultsV2["wallsByRoomId"]>[string],
      },
    };
    const next = resultsAfterDiscardConfirm(results, ["room-a"]);
    expect(next.byRoomId["room-a"]).toBeUndefined();
    expect(next.wallsByRoomId?.["room-a"]).toBeUndefined();
    expect(next.byRoomId["room-b"]).toBe(results.byRoomId["room-b"]);
  });

  it("does not re-prompt after the affected results have already been cleared", () => {
    const results = resultsWithRooms(["room-a"]);
    const cleared = resultsAfterDiscardConfirm(results, ["room-a"]);
    expect(decideFixtureChange(cleared, ["room-a"])).toEqual({
      action: "apply",
      roomIdsToClear: [],
    });
  });

  it("leaves fixture and results unchanged when the user cancels", () => {
    const results = resultsWithRooms(["room-a"]);
    const decision = decideFixtureChange(results, ["room-a"]);
    expect(decision.action).toBe("confirm");
    // Cancel does not call resultsAfterDiscardConfirm or the fixture writer.
    expect(results.byRoomId["room-a"]).toBeDefined();
    expect(decideFixtureChange(results, ["room-a"]).roomIdsToClear).toEqual(["room-a"]);
  });
});

describe("official discard-results dialog copy and wiring", () => {
  const helper = read("src/lib/discard-results-confirm.ts");
  const dialog = read("src/components/editor/DiscardResultsDialog.tsx");
  const editor = read("src/components/editor/BuildingEditor.tsx");
  const top = read("src/components/editor/TopView2D.tsx");
  const elev = read("src/components/editor/ElevationView2D.tsx");
  const css = read("src/app/globals.css");
  const guide = read("docs/USER_GUIDE.md");

  it("has official bilingual copy with Confirm and Cancel, and no DIALux wording", () => {
    expect(DISCARD_RESULTS_TITLE_EN).toBe("Discard calculation results?");
    expect(DISCARD_RESULTS_TITLE_ZH).toBe("捨棄計算結果？");
    expect(DISCARD_RESULTS_BODY_EN).toMatch(/Changing lighting fixtures will discard the current calculation results/);
    expect(DISCARD_RESULTS_BODY_ZH).toMatch(/變更燈具會捨棄受影響房間的目前計算結果/);
    expect(DISCARD_RESULTS_CONFIRM_LABEL).toBe("Confirm");
    expect(DISCARD_RESULTS_CANCEL_LABEL).toBe("Cancel");
    expect(helper).not.toMatch(/DIALux/i);
    expect(dialog).not.toMatch(/DIALux/i);
    expect(dialog).toContain('role="dialog"');
    expect(dialog).toContain("onClick={onCancel}");
    expect(dialog).toContain('event.key !== "Escape"');
    expect(dialog).toContain("DISCARD_RESULTS_CONFIRM_LABEL");
    expect(dialog).toContain("DISCARD_RESULTS_CANCEL_LABEL");
    expect(css).toContain(".discard-results-backdrop");
    expect(css).toContain(".discard-results-dialog");
  });

  it("is wired to official fixture writes and asks once at drag start", () => {
    expect(editor).toContain("DiscardResultsDialog");
    expect(editor).toContain("requestFixtureWrite");
    expect(editor).toContain("beginMoveInstance");
    expect(editor).toContain("onBeginMoveInstance={beginMoveInstance}");
    expect(editor).toContain("updateInstanceRotation");
    expect(editor).toContain("updateInstancePosition");
    expect(editor).toContain("removeInstance");
    expect(editor).toMatch(/requestFixtureWrite\([\s\S]*placeAt|requestFixtureWrite\([^\n]+, \(\) =>[\s\S]*placeAt/);
    expect(editor).toContain("requestFixtureWrite(");
    expect(top).toContain("onBeginMoveInstance");
    expect(top).toMatch(/onBeginMoveInstance && !onBeginMoveInstance\(/);
    expect(elev).toContain("onBeginMoveInstance");
    expect(elev).toMatch(/onBeginMoveInstance && !onBeginMoveInstance\(/);
    expect(guide).toMatch(/變更燈具與計算結果 \/ Changing fixtures and calculation results/);
    expect(guide).toMatch(/changing lighting fixtures will discard the current calculation results/);
    expect(guide).toMatch(/變更燈具會捨棄受影響房間的目前計算結果/);
    expect(guide).toMatch(/\*\*Confirm\*\*/);
    expect(guide).toMatch(/\*\*Cancel\*\*/);
    expect(guide).not.toMatch(/DIALux/);
  });
});
