import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { parseIes, sampleIntensityCd } from "./index";

const fixture = readFileSync(
  path.join(process.cwd(), "fixtures/sample-downlight.ies"),
  "utf8"
);

describe("parseIes", () => {
  it("parses sample downlight", () => {
    const { data } = parseIes(fixture);
    expect(data.format).toBe("ies");
    expect(data.verticalAngles).toHaveLength(5);
    expect(data.horizontalAngles).toHaveLength(1);
    expect(data.intensities[0]?.[0]).toBe(1200);
    expect(data.luminousFlux).toBe(2000);
    expect(data.watts).toBe(30);
  });

  it("treats negative IES lamp lumens as absolute photometry", () => {
    const hacked = fixture.replace("2000", "-1");
    const { data } = parseIes(hacked);
    expect(data.luminousFlux).toBeNull();
  });

  it("samples nadir intensity", () => {
    const { data } = parseIes(fixture);
    const cd = sampleIntensityCd(data, 0, 0);
    expect(cd).toBeGreaterThan(1000);
  });
});
