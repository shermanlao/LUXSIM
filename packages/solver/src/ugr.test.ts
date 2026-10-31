import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { parseIes } from "../../photometry/src/index";
import { calculate } from "./calculate";

const fixture = readFileSync(
  path.join(process.cwd(), "fixtures/sample-downlight.ies"),
  "utf8"
);

/** Golden 4×4 m room — same as calculate.test.ts */
describe("computeUgr CIE 117 assist", () => {
  it("returns finite UGR in a plausible band for downlight room", () => {
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
      interreflection: false,
      bounces: 0,
      computeUgr: true,
    });

    expect(results.summary.ugr).not.toBeNull();
    expect(results.summary.ugr!).toBeGreaterThan(5);
    expect(results.summary.ugr!).toBeLessThan(40);
    expect(results.ugrObservers?.length).toBe(6);
  });
});
