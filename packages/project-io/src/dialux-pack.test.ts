import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { buildDialuxPack, getDialuxPackWarnings } from "./dialux-pack";
import { rectPolygon } from "./geometry";
import type { ProjectSceneV2, ResultsV2 } from "./types";

const scene: ProjectSceneV2 = {
  version: 2,
  storeys: [{ id: "s1", name: "GF", elevationM: 0, heightM: 3 }],
  rooms: [
    {
      id: "r1",
      storeyId: "s1",
      name: "Office A",
      polygon: rectPolygon(0, 0, 8, 6),
      heightM: 2.8,
      workplaneHeightM: 0.75,
      reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
      calc: {
        gridSpacing: 0.5,
        interreflection: true,
        bounces: 2,
        computeUgr: true,
        maintenanceFactor: 0.8,
        en12464TemplateId: "office",
      },
    },
  ],
  underlays: [],
  fixtureLibraryIds: ["lum1"],
  instances: [
    {
      instanceId: "i1",
      luminaireId: "lum1",
      storeyId: "s1",
      roomId: "r1",
      name: "Downlight",
      position: { x: 4, y: 3, z: 2.7 },
      rotationDeg: 45,
    },
  ],
  ui: {
    activeStoreyId: "s1",
    activeRoomId: "r1",
    viewMode: "top",
    tool: "select",
    workflowMode: "export",
  },
};

describe("getDialuxPackWarnings", () => {
  it("flags open contours", () => {
    const bad: ProjectSceneV2 = {
      ...scene,
      rooms: [{ ...scene.rooms[0]!, polygon: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }],
    };
    expect(getDialuxPackWarnings(bad, null).some((w) => w.code === "open_contour")).toBe(true);
  });
});

describe("buildDialuxPack", () => {
  it("exports multi-room geometry and verification artifacts", async () => {
    const results: ResultsV2 = {
      version: 2,
      byRoomId: {
        r1: {
          version: 1,
          grid: {
            originX: 0,
            originY: 0,
            spacing: 1,
            nx: 2,
            ny: 2,
            z: 0.75,
            lux: [500, 500, 500, 500],
          },
          summary: {
            eave: 500,
            emin: 500,
            emax: 500,
            uo: 1,
            ugr: 17,
            lpd: 4,
            totalWatts: 30,
            areaM2: 48,
          },
          meta: {
            interreflection: true,
            bounces: 2,
            calculatedAt: "2026-01-01T00:00:00.000Z",
            disclaimer: "test",
          },
        },
      },
    };

    const blob = await buildDialuxPack({
      projectName: "Test",
      scene,
      results,
      sourceFiles: {
        lum1: { filename: "sample.ies", text: "IESNA TEST" },
      },
      luminaireNames: { lum1: "Sample" },
    });

    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const roomsJson = JSON.parse(await zip.file("rooms.json")!.async("string"));
    expect(roomsJson.rooms[0].maintenanceFactor).toBe(0.8);
    expect(roomsJson.rooms[0].reflectance.walls).toBe(0.5);
    const schedule = await zip.file("schedule.csv")!.async("string");
    expect(schedule).toContain("45.0");
    const readme = await zip.file("README.txt")!.async("string");
    expect(readme).toMatch(/CLOSED spaces/);
    expect(readme).toMatch(/rotation_deg/);
    expect(readme).not.toMatch(/\.evo/);
  });
});
