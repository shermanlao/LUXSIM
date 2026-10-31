import { describe, expect, it } from "vitest";
import { parseIes } from "../../photometry/src/index";
import { readFileSync } from "fs";
import path from "path";
import { calculate } from "./calculate";

const fixture = readFileSync(
  path.join(process.cwd(), "fixtures/sample-downlight.ies"),
  "utf8"
);

describe("calculate", () => {
  it("produces positive workplane lux for a centered downlight", () => {
    const { data } = parseIes(fixture);
    const results = calculate({
      room: {
        width: 4,
        depth: 4,
        height: 2.8,
        reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
        workplaneHeight: 0.75,
      },
      luminaires: [
        {
          id: "1",
          name: "Demo",
          position: { x: 2, y: 2, z: 2.6 },
          rotationDeg: 0,
          photometry: data,
          watts: 30,
        },
      ],
      grid: { spacing: 0.5 },
      interreflection: true,
      bounces: 2,
      computeUgr: true,
    });

    expect(results.summary.eave).toBeGreaterThan(50);
    expect(results.summary.emin).toBeGreaterThan(0);
    expect(results.summary.ugr).not.toBeNull();
    expect(results.grid.lux.length).toBe(results.grid.nx * results.grid.ny);
    expect(results.meta.disclaimer).toMatch(/design-assist/i);
  });
});
