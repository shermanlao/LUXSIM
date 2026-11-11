import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import { defaultSceneV2 } from "./migrate";
import { rectPolygon } from "./geometry";
import {
  cameraForRooms,
  drawRoomPerspective3dOnPdf,
  drawStoreyPerspective3dOnPdf,
  pdfIncludes3dDrawingMarkers,
  projectPoint,
} from "./view-3d-render";

describe("view-3d-render", () => {
  it("projects room corners into the PDF box", () => {
    const scene = defaultSceneV2();
    const storeyId = scene.storeys[0]!.id;
    scene.rooms.push({
      id: "r1",
      storeyId,
      name: "A",
      polygon: rectPolygon(0, 0, 6, 4),
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
    const cam = cameraForRooms(scene.rooms, 0);
    const p = projectPoint({ x: 3, y: 2, z: 2.8 }, cam, { x: 10, y: 10, w: 80, h: 60 });
    expect(p.depth).toBeGreaterThan(0);
    expect(p.x).toBeGreaterThan(10);
    expect(p.y).toBeGreaterThan(10);
  });

  it("draws storey and room 3D without throwing", () => {
    const scene = defaultSceneV2();
    const storeyId = scene.storeys[0]!.id;
    scene.rooms.push({
      id: "r1",
      storeyId,
      name: "A",
      polygon: rectPolygon(0, 0, 6, 4),
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
    const doc = new jsPDF();
    doc.text("3D perspective", 20, 20);
    doc.text("Plan (fixtures)", 20, 30);
    drawStoreyPerspective3dOnPdf(doc, scene, storeyId, { x: 20, y: 40, w: 90, h: 50 });
    drawRoomPerspective3dOnPdf(doc, scene, scene.rooms[0]!, { x: 120, y: 40, w: 60, h: 50 });
    const raw = new TextDecoder("latin1").decode(doc.output("arraybuffer"));
    expect(pdfIncludes3dDrawingMarkers(raw)).toBe(true);
  });
});
