import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import path from "path";
import { buildDialuxEvo, defaultEvoFixtureRoot } from "./dialux-evo";
import { EVO_ARCHIVE_MEMBERS } from "./dialux-evo/constants";
import {
  contourIntegrityIssues,
  datContainsRoomName,
  datStepHeaderValid,
  innerContourPolygons,
} from "./dialux-evo/extract-geometry";
import { loadReferenceProjectDataDat } from "./dialux-evo/patch-project-data";
import { defaultSceneV2 } from "./migrate";
import { rectPolygon } from "./geometry";
import type { ProjectSceneV2 } from "./types";

function nineRoomScene(): ProjectSceneV2 {
  const scene = defaultSceneV2();
  const storeyId = scene.storeys[0]!.id;
  const defs = [
    { name: "Reception & Waiting", poly: rectPolygon(0, 0, 4.2, 7.2) },
    { name: "Server Room", poly: rectPolygon(5, 0, 3.8, 3.9) },
    { name: "14P Meeting Room", poly: rectPolygon(10, 0, 4.8, 5.3) },
    { name: "Collaboration", poly: rectPolygon(0, 8, 10.4, 7.2) },
    { name: "Dry Pantry", poly: rectPolygon(12, 8, 5.3, 4.5) },
    { name: "Utility 70 SQFT", poly: rectPolygon(0, 16, 11, 4.2) },
    { name: "Store Room", poly: rectPolygon(12, 14, 4.5, 4.6) },
    { name: "Utility 30 SQFT", poly: rectPolygon(18, 0, 3.8, 3.4) },
    { name: "Open Office", poly: rectPolygon(18, 5, 6.2, 7.8) },
  ];
  defs.forEach((d, i) => {
    scene.rooms.push({
      id: `r${i}`,
      storeyId,
      name: d.name,
      polygon: d.poly,
      heightM: 2.8,
      workplaneHeightM: 0.75,
      reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
      calc: {
        gridSpacing: 0.5,
        interreflection: true,
        bounces: 2,
        computeUgr: false,
      },
    });
  });
  return scene;
}

describe("buildDialuxEvo", () => {
  const fixtureRoot = defaultEvoFixtureRoot();

  it("produces a zip with reference archive members", async () => {
    const { blob } = await buildDialuxEvo({
      projectName: "AED-180297 L9M",
      scene: nineRoomScene(),
      fixtureRoot,
    });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    for (const member of EVO_ARCHIVE_MEMBERS) {
      if (member.endsWith("/")) {
        expect(zip.folder(member.replace(/\/$/, "")), member).toBeTruthy();
      } else {
        expect(zip.file(member), member).toBeTruthy();
      }
    }
    expect(Object.keys(zip.files).length).toBeGreaterThanOrEqual(24);
    expect(zip.file("room.json")).toBeFalsy();
  });

  it("reference template STEP contours have matching vertex/ref counts", () => {
    const dat = loadReferenceProjectDataDat(fixtureRoot);
    expect(contourIntegrityIssues(dat)).toHaveLength(0);
  });

  it("embeds room names and polygon coordinates in ProjectData.dat", async () => {
    const scene = nineRoomScene();
    const { blob } = await buildDialuxEvo({
      projectName: "L9M Test",
      scene,
      fixtureRoot,
    });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const dat = await zip.file("Project/ProjectData/ProjectData.dat")!.async("string");
    expect(datStepHeaderValid(dat)).toBe(true);
    expect(contourIntegrityIssues(dat)).toHaveLength(0);
    expect(dat.length).toBeGreaterThan(200_000);
    expect(datContainsRoomName(dat, "Server Room")).toBe(true);
    expect(datContainsRoomName(dat, "Open Office")).toBe(true);
    const polys = innerContourPolygons(dat);
    expect(polys.length).toBeGreaterThanOrEqual(9);
    // Slot 1 (Server Room) is 4-vertex in template → rectangle exports patch this contour.
    expect(polys[1]!.some((p) => p.startsWith("3.8") || p.endsWith(",3.9"))).toBe(true);
  });

  it("updates ArchiveInfo title", async () => {
    const { blob } = await buildDialuxEvo({
      projectName: "My LUXSIM Export",
      scene: nineRoomScene(),
      fixtureRoot,
    });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file("ArchiveInfo/ArchiveInfo.xml")!.async("string");
    expect(xml).toContain("<Title>My LUXSIM Export</Title>");
    expect(xml).toContain("5.12.1.7275");
  });
});
