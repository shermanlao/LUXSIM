import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { parseIes, type PhotometricData } from "../../photometry/src/index";
import { calculate } from "../../solver/src/calculate";
import {
  buildIsoluxModel,
  isoluxFieldScreenRect,
  isoluxPxToWorld,
  sampleLuxAtWorld,
} from "./isolux-map";
import { roomToCalcOptions } from "./room-adapter";
import { rectPolygon, roomBounds } from "./geometry";
import type { FixtureInstance, RoomV2 } from "./types";

const sampleDownlight = readFileSync(
  path.join(process.cwd(), "fixtures/sample-downlight.ies"),
  "utf8"
);

function typeBSymmetricCone(peakCd = 1000, halfDeg = 30): PhotometricData {
  const angles: number[] = [];
  for (let a = -90; a <= 90; a += 5) angles.push(a);
  const sigma = halfDeg / Math.sqrt(2 * Math.log(2));
  const intensity = (vDeg: number, hDeg: number): number => {
    if (Math.abs(vDeg) >= 90 - 1e-6 || Math.abs(hDeg) >= 90 - 1e-6) return 0;
    const thetaDeg =
      (Math.atan(
        Math.hypot(Math.tan((hDeg * Math.PI) / 180), Math.tan((vDeg * Math.PI) / 180))
      ) *
        180) /
      Math.PI;
    return peakCd * Math.exp(-0.5 * (thetaDeg / sigma) ** 2);
  };
  return {
    format: "ies",
    manufacturer: "Test",
    catalogNumber: "TYPE-B-SYM",
    description: "Synthesized axially symmetric Type B downlight",
    luminousFlux: 2000,
    watts: 30,
    lampCount: 1,
    ballastFactor: 1,
    verticalAngles: angles,
    horizontalAngles: angles,
    intensities: angles.map((h) => angles.map((v) => intensity(v, h))),
    symmetry: "none",
    photometryType: 2,
    openingWidthM: -0.2,
    openingLengthM: -0.2,
    openingHeightM: 0.04,
  };
}

function makeRoom(): RoomV2 {
  return {
    id: "r-shift",
    storeyId: "s1",
    name: "Offset room",
    polygon: rectPolygon(12, 3, 10, 8),
    heightM: 2.8,
    workplaneHeightM: 0.75,
    reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
    calc: {
      gridSpacing: 0.25,
      interreflection: false,
      bounces: 0,
      computeUgr: false,
    },
  };
}

function makeFixture(rotationDeg: number): FixtureInstance {
  return {
    instanceId: "fx1",
    luminaireId: "lum",
    storeyId: "s1",
    roomId: "r-shift",
    name: "DL",
    position: { x: 17, y: 7, z: 2.6 },
    rotationDeg,
  };
}

function gridPeakWorld(
  grid: { nx: number; ny: number; originX: number; originY: number; spacing: number; lux: number[] },
  minX: number,
  minY: number
) {
  let best = -Infinity;
  let x = 0;
  let y = 0;
  for (let j = 0; j < grid.ny; j += 1) {
    for (let i = 0; i < grid.nx; i += 1) {
      const lux = grid.lux[j * grid.nx + i] ?? 0;
      if (lux > best) {
        best = lux;
        x = minX + grid.originX + i * grid.spacing;
        y = minY + grid.originY + j * grid.spacing;
      }
    }
  }
  return { x, y, lux: best };
}

function sampledFieldPeak(
  grid: Parameters<typeof sampleLuxAtWorld>[0],
  b: { minX: number; minY: number },
  fixture: { x: number; y: number },
  halfSpan = 2,
  step = 0.05
) {
  let best = -Infinity;
  let x = fixture.x;
  let y = fixture.y;
  for (let yy = fixture.y - halfSpan; yy <= fixture.y + halfSpan + 1e-9; yy += step) {
    for (let xx = fixture.x - halfSpan; xx <= fixture.x + halfSpan + 1e-9; xx += step) {
      const lux = sampleLuxAtWorld(grid, b, xx, yy);
      if (lux > best) {
        best = lux;
        x = xx;
        y = yy;
      }
    }
  }
  return { x, y, lux: best };
}

function rasterPeakWorld(
  room: RoomV2,
  results: ReturnType<typeof calculate>,
  fixtures: FixtureInstance[]
) {
  const model = buildIsoluxModel(room, results, {
    mode: "falsecolor",
    wallZoneM: 0.25,
    fixtures,
    includeContours: false,
    includeValueLabels: false,
  });
  expect(model).not.toBeNull();
  const frame = model!.world;
  const toScreen = (x: number, y: number) => ({ x, y });
  const rect = isoluxFieldScreenRect(frame, model!.width, model!.height, toScreen);
  expect(rect).not.toBeNull();
  const b = roomBounds(room);
  let best = -Infinity;
  let x = 0;
  let y = 0;
  const step = 2;
  for (let py = 0; py < model!.height; py += step) {
    for (let px = 0; px < model!.width; px += step) {
      const world = isoluxPxToWorld(frame, { x: px + 0.5, y: py + 0.5 });
      const lux = sampleLuxAtWorld(results.grid, b, world.x, world.y);
      if (lux > best) {
        best = lux;
        x = world.x;
        y = world.y;
      }
    }
  }
  return { x, y, lux: best, rect: rect! };
}

function expectPeakUnderFixture(
  photo: PhotometricData,
  rotationDeg: number
) {
  const room = makeRoom();
  const inst = makeFixture(rotationDeg);
  const b = roomBounds(room);
  expect(b.minX).not.toBe(0);
  expect(b.minY).not.toBe(0);
  const results = calculate(
    roomToCalcOptions(
      room,
      [inst],
      { lum: photo },
      { lum: 30 }
    )
  );
  const halfCell = results.grid.spacing / 2;
  const gridPeak = gridPeakWorld(results.grid, b.minX, b.minY);
  expect(gridPeak.lux).toBeGreaterThan(10);
  expect(Math.abs(gridPeak.x - inst.position.x)).toBeLessThanOrEqual(halfCell + 1e-9);
  expect(Math.abs(gridPeak.y - inst.position.y)).toBeLessThanOrEqual(halfCell + 1e-9);

  const fieldPeak = sampledFieldPeak(results.grid, b, inst.position);
  expect(Math.abs(fieldPeak.x - inst.position.x)).toBeLessThanOrEqual(halfCell);
  expect(Math.abs(fieldPeak.y - inst.position.y)).toBeLessThanOrEqual(halfCell);

  const raster = rasterPeakWorld(room, results, [inst]);
  expect(Math.abs(raster.x - inst.position.x)).toBeLessThanOrEqual(halfCell + 0.05);
  expect(Math.abs(raster.y - inst.position.y)).toBeLessThanOrEqual(halfCell + 0.05);
  return { gridPeak, fieldPeak, raster, halfCell, fixture: inst.position };
}

describe("official downward-symmetric illuminance peak", () => {
  const typeC = parseIes(sampleDownlight).data;

  it("places the Type C sample-downlight grid and isolux peaks under the fixture at rotation 0°", () => {
    expectPeakUnderFixture(typeC, 0);
  });

  it("does not slide the Type C peak when the fixture is rotated 90°", () => {
    expectPeakUnderFixture(typeC, 90);
  });

  it("places a synthesized Type B downward-symmetric peak under the fixture at rotation 0°", () => {
    expectPeakUnderFixture(typeBSymmetricCone(), 0);
  });

  it("does not slide a Type B downward-symmetric peak along C0 when rotated 90°", () => {
    expectPeakUnderFixture(typeBSymmetricCone(), 90);
  });
});
