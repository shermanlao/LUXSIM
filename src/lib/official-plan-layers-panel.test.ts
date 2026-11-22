import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";

describe("plan layer panel wiring", () => {
  it("lists layers with Select all / Select none / Apply and uses the official wait dialog", () => {
    const editor = readFileSync(
      path.join(process.cwd(), "src/components/editor/BuildingEditor.tsx"),
      "utf8"
    );
    const panel = readFileSync(
      path.join(process.cwd(), "src/components/editor/PlanLayerPanel.tsx"),
      "utf8"
    );
    expect(editor).toContain("<PlanLayerPanel");
    expect(editor).toContain("applyPlanLayers");
    expect(editor).toContain("officialCompressCadEntities");
    expect(editor).toContain("officialExtractVisibleCadEntities");
    expect(editor).toContain("OFFICIAL_WAIT_COPY.applyingPlanLayers");
    expect(editor).toContain("cadSourceEntities");
    expect(panel).toContain("Select all");
    expect(panel).toContain("Select none");
    expect(panel).toContain("Apply");
    expect(panel).toContain("Plan layers");
    expect(panel).toContain('data-plan-layers=""');
    expect(editor).toContain("officialHasParsedCadLinework(underlay)");
  });
});
