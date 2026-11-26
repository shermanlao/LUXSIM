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

  it("backfills incomplete CAD layer meta from the stored plan when Construction loads", () => {
    const editor = readFileSync(
      path.join(process.cwd(), "src/components/editor/BuildingEditor.tsx"),
      "utf8"
    );
    const wait = readFileSync(
      path.join(process.cwd(), "src/lib/official-wait-dialog.ts"),
      "utf8"
    );
    expect(editor).toContain("officialCadLayerMetaIncomplete");
    expect(editor).toContain("officialCadEntitiesLackLayerNames");
    expect(editor).toContain("officialWait.run(OFFICIAL_WAIT_COPY.backfillingPlanLayers");
    expect(editor).toContain("/api/projects/${projectId}/assets/${assetId}/cad-layers");
    expect(editor).toContain("setAssets(");
    expect(editor).toContain("dxfLayers:");
    expect(editor).toContain("officialCompressCadEntities");
    expect(editor).toContain("officialExtractVisibleCadEntities");
    expect(wait).toContain("backfillingPlanLayers:");
    expect(wait).toContain("Updating plan layers…");
    expect(wait).toContain("正在更新圖則圖層…");
  });
});
