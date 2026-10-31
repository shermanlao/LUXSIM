import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { parseIes } from "../../photometry/src/index";
import { calculate } from "../../solver/src/calculate";
import { roomToCalcOptions, clipResultsToPolygon } from "./room-adapter";
import { rectPolygon } from "./geometry";
import type { RoomV2, FixtureInstance } from "./types";

const fixture = readFileSync(
  path.join(process.cwd(), "fixtures/sample-downlight.ies"),
  "utf8"
);

describe("roomToCalcOptions", () => {
  it("yields higher Eave for more fixtures", () => {
    const { data } = parseIes(fixture);
    const room: RoomV2 = {
      id: "r1",
      storeyId: "s1",
      name: "A",
      polygon: rectPolygon(0, 0, 6, 5),
      heightM: 2.8,
      workplaneHeightM: 0.75,
      reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
      calc: {
        gridSpacing: 0.5,
        interreflection: true,
        bounces: 2,
        computeUgr: true,
      },
    };
    const mk = (n: number): FixtureInstance[] =>
      Array.from({ length: n }, (_, i) => ({
        instanceId: `i${i}`,
        luminaireId: "lum",
        storeyId: "s1",
        roomId: "r1",
        name: "DL",
        position: { x: 1 + i, y: 2, z: 2.6 },
        rotationDeg: 0,
      }));

    const one = calculate(
      roomToCalcOptions(room, mk(1), { lum: data }, { lum: 30 })
    );
    const four = calculate(
      roomToCalcOptions(room, mk(4), { lum: data }, { lum: 30 })
    );
    expect(four.summary.eave).toBeGreaterThan(one.summary.eave);

    const clipped = clipResultsToPolygon(room, four);
    expect(clipped.grid.lux.length).toBe(four.grid.lux.length);
  });
});
