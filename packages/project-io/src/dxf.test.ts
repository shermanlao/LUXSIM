import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { parseDxfEntities } from "./dxf";
import { importIfcText } from "./ifc-import";

describe("parseDxfEntities", () => {
  it("parses sample plan", () => {
    const text = readFileSync(
      path.join(process.cwd(), "fixtures/sample-plan.dxf"),
      "utf8"
    );
    const entities = parseDxfEntities(text);
    expect(entities.length).toBeGreaterThan(0);
  });
});

describe("importIfcText", () => {
  it("extracts storeys and spaces", () => {
    const text = readFileSync(
      path.join(process.cwd(), "fixtures/sample-building.ifc"),
      "utf8"
    );
    const { scene, warnings } = importIfcText(text);
    expect(scene.storeys.length).toBeGreaterThanOrEqual(2);
    expect(scene.rooms.length).toBeGreaterThanOrEqual(2);
    expect(warnings.length).toBeGreaterThanOrEqual(0);
  });
});
