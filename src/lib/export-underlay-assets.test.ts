import { describe, expect, it } from "vitest";
import { base64ToBytes, type ProjectSceneV2 } from "@luxsim/project-io";
import {
  collectOfficialExportAssets,
  missingExportAssetStatus,
  officialExportAssetIds,
} from "./export-underlay-assets";

const scene: ProjectSceneV2 = {
  version: 2,
  storeys: [{ id: "s1", name: "GF", elevationM: 0, heightM: 3 }],
  rooms: [],
  underlays: [
    {
      id: "u-img",
      storeyId: "s1",
      assetId: "asset-img",
      kind: "image",
      opacity: 0.8,
      metersPerUnit: 0.02,
      scaleCalibrated: true,
      offsetX: 0,
      offsetY: 0,
      rotationDeg: 0,
    },
    {
      id: "u-dxf",
      storeyId: "s1",
      assetId: "asset-dxf",
      kind: "dxf",
      opacity: 0.8,
      metersPerUnit: 1,
      scaleCalibrated: true,
      offsetX: 0,
      offsetY: 0,
      rotationDeg: 0,
    },
  ],
  fixtureLibraryIds: [],
  instances: [],
  ui: { activeStoreyId: "s1", activeRoomId: null, viewMode: "top", tool: "select" },
};

describe("collectOfficialExportAssets", () => {
  it("embeds referenced image and DXF files and lists drawings that could not be packed", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0xff]);
    const packed = await collectOfficialExportAssets({
      assetIds: officialExportAssetIds(scene),
      assetMeta: [
        { id: "asset-img", fileName: "plan.png", kind: "image", metaJson: "{}" },
        { id: "asset-dxf", fileName: "plan.dxf", kind: "dxf" },
      ],
      loadAssetFile: async (id) => {
        if (id === "asset-img") return { bytes: png };
        return null;
      },
    });
    expect(Object.keys(packed.assets)).toEqual(["asset-img"]);
    expect(packed.assets["asset-img"]?.encoding).toBe("base64");
    expect(Array.from(base64ToBytes(packed.assets["asset-img"]!.content))).toEqual(Array.from(png));
    expect(packed.missingAssetIds).toEqual(["asset-dxf"]);
    expect(missingExportAssetStatus(packed.missingAssetIds, { "asset-dxf": "plan.dxf" })).toBe(
      ".lux downloaded, but plan drawings are missing for: plan.dxf. The file is incomplete."
    );
  });
});
