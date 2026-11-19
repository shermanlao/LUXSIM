import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { parseIes } from "../../photometry/src/index";
import { roomToCalcOptions } from "./room-adapter";
import { rectPolygon } from "./geometry";
import type { RoomV2, FixtureInstance } from "./types";

const fixture = readFileSync(
  path.join(process.cwd(), "fixtures/sample-downlight.ies"),
  "utf8"
);

describe("rotationDeg in calc export path", () => {
  it("passes instance rotation into solver luminaires", () => {
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
    const inst: FixtureInstance = {
      instanceId: "i1",
      luminaireId: "lum",
      storeyId: "s1",
      roomId: "r1",
      name: "DL",
      position: { x: 2, y: 2, z: 2.6 },
      rotationDeg: 135,
    };
    const opts = roomToCalcOptions(room, [inst], { lum: data }, { lum: 30 });
    expect(opts.luminaires[0]!.rotationDeg).toBe(135);
  });
});
