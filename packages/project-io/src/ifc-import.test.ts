import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { importIfcText } from "./ifc-import";
import { rectPolygon, roomAreaM2 } from "./geometry";

const SAMPLE_PATH = path.join(process.cwd(), "fixtures/sample-building.ifc");

function sampleIfc(): string {
  return readFileSync(SAMPLE_PATH, "utf8");
}

function insertBeforeDataEnd(text: string, extra: string): string {
  const index = text.lastIndexOf("ENDSEC;");
  expect(index).toBeGreaterThan(0);
  return `${text.slice(0, index)}${extra}\n${text.slice(index)}`;
}

function roomByName(scene: { rooms: { name: string; storeyId: string; id: string }[] }, name: string) {
  const room = scene.rooms.find((item) => item.name === name);
  expect(room, `expected room named ${name}`).toBeTruthy();
  return room!;
}

describe("importIfcText", () => {
  it("uses Name / LongName from the sample IFC, not the first quoted GlobalId token", () => {
    const { scene } = importIfcText(sampleIfc());
    expect(scene.version).toBe(2);
    expect(scene.storeys.map((storey) => storey.name)).toEqual([
      "Ground Floor",
      "Level 1",
    ]);
    expect(scene.rooms.map((room) => room.name)).toEqual([
      "Office A",
      "Meeting B",
      "Corridor",
    ]);
    const forbidden = [
      "0Storey1",
      "0Storey2",
      "0Space1",
      "0Space2",
      "0Space3",
    ];
    for (const label of [...scene.storeys, ...scene.rooms].map((item) => item.name)) {
      expect(forbidden).not.toContain(label);
    }
    expect(scene.storeys.map((storey) => storey.id)).toEqual([
      "ifc_storey_10",
      "ifc_storey_11",
    ]);
    expect(scene.storeys.map((storey) => storey.elevationM)).toEqual([0, 3.2]);
  });

  it("falls back to LongName when Name is unset", () => {
    const text = sampleIfc()
      .replace("'Ground Floor'", "$")
      .replace("'Office A'", "$")
      .replace(
        "#10=IFCBUILDINGSTOREY('0Storey1',$,$,$,$,$,$,$,.ELEMENT.,0.);",
        "#10=IFCBUILDINGSTOREY('0Storey1',$,$,$,$,$,$,'Ground Floor',.ELEMENT.,0.);"
      )
      .replace(
        "#20=IFCSPACE('0Space1',$,$,$,$,$,$,$,.ELEMENT.,.INTERNAL.,$);",
        "#20=IFCSPACE('0Space1',$,$,$,$,$,$,'Office A',.ELEMENT.,.INTERNAL.,$);"
      );
    const { scene } = importIfcText(text);
    expect(scene.storeys[0]?.name).toBe("Ground Floor");
    expect(roomByName(scene, "Office A").id).toBe("ifc_space_20");
    expect(scene.storeys[0]?.name).not.toBe("0Storey1");
    expect(scene.rooms.some((room) => room.name === "0Space1")).toBe(false);
  });

  it("does not assign sample spaces by appearance order when the official file has no containment", () => {
    const text = sampleIfc();
    expect(text).not.toMatch(/IFCRELAGGREGATES/i);
    expect(text).not.toMatch(/IFCRELCONTAINEDINSPATIALSTRUCTURE/i);
    const { scene, warnings } = importIfcText(text);
    // Without RelAggregates / RelContained, do not overflow the third space onto the last storey.
    for (const room of scene.rooms) {
      expect(room.storeyId).toBe("ifc_storey_10");
    }
    expect(warnings.some((warning) => /No spatial containment for 3 spaces — placed on Ground Floor/.test(warning))).toBe(
      true
    );
  });

  it("assigns sample spaces from IfcRelAggregates, including a third space that is not on the last storey", () => {
    const text = insertBeforeDataEnd(
      sampleIfc(),
      [
        "#30=IFCRELAGGREGATES('relStorey1',$,$,$,#10,(#20,#22));",
        "#31=IFCRELAGGREGATES('relStorey2',$,$,$,#11,(#21));",
      ].join("\n")
    );
    const { scene, warnings } = importIfcText(text);
    expect(roomByName(scene, "Office A").storeyId).toBe("ifc_storey_10");
    expect(roomByName(scene, "Meeting B").storeyId).toBe("ifc_storey_11");
    expect(roomByName(scene, "Corridor").storeyId).toBe("ifc_storey_10");
    expect(warnings.some((warning) => /spatial containment/i.test(warning))).toBe(false);
    expect(scene.version).toBe(2);
  });

  it("assigns sample spaces from IfcRelContainedInSpatialStructure", () => {
    const text = insertBeforeDataEnd(
      sampleIfc(),
      [
        "#32=IFCRELCONTAINEDINSPATIALSTRUCTURE('cont1',$,$,$,(#20,#22),#10);",
        "#33=IFCRELCONTAINEDINSPATIALSTRUCTURE('cont2',$,$,$,(#21),#11);",
      ].join("\n")
    );
    const { scene } = importIfcText(text);
    expect(roomByName(scene, "Office A").storeyId).toBe("ifc_storey_10");
    expect(roomByName(scene, "Meeting B").storeyId).toBe("ifc_storey_11");
    expect(roomByName(scene, "Corridor").storeyId).toBe("ifc_storey_10");
  });

  it("walks nested aggregates so a space under another space still lands on that storey", () => {
    const text = insertBeforeDataEnd(
      sampleIfc(),
      [
        "#30=IFCRELAGGREGATES('relOffice',$,$,$,#10,(#20));",
        "#31=IFCRELAGGREGATES('relLevel1',$,$,$,#11,(#21));",
        "#32=IFCRELAGGREGATES('relNested',$,$,$,#20,(#22));",
      ].join("\n")
    );
    const { scene } = importIfcText(text);
    expect(roomByName(scene, "Corridor").storeyId).toBe("ifc_storey_10");
    expect(roomByName(scene, "Office A").storeyId).toBe("ifc_storey_10");
    expect(roomByName(scene, "Meeting B").storeyId).toBe("ifc_storey_11");
  });

  it("keeps the lightweight 5×4 m default boxes and stays ProjectSceneV2 after a Method 1 redraw", () => {
    const { scene } = importIfcText(sampleIfc());
    for (const room of scene.rooms) {
      expect(roomAreaM2(room)).toBe(20);
    }
    const office = scene.rooms.find((room) => room.name === "Office A")!;
    // Same 17 m² L used in the Method 3 AI check: 5×3 plus a 2×1 stub.
    office.polygon = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 3 },
      { x: 2, y: 3 },
      { x: 2, y: 4 },
      { x: 0, y: 4 },
    ];
    const added = {
      ...office,
      id: "drawn_room_1",
      name: "Drawn room",
      polygon: rectPolygon(0, 0, 5, 4),
    };
    scene.rooms.push(added);
    expect(scene.version).toBe(2);
    expect(roomAreaM2(office)).toBe(17);
    expect(roomAreaM2(added)).toBe(20);
    expect(scene.rooms.some((room) => room.name === "Office A")).toBe(true);
  });
});
