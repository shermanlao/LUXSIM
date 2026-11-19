import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parsePhotometricFile, synthesizeCircularLdt, type PhotometricData } from "@luxsim/photometry";
import {
  DEFAULT_BEAM_FULL_ANGLE_DEG,
  DEFAULT_BEAM_HALF_ANGLE_DEG,
  officialBeamHalfAnglesDeg,
  officialConeLengthM,
  officialLightConeGeom,
} from "./fixture-beam-cone";

const root = path.resolve(__dirname, "../..");
function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

function photoFromLdt(text: string): PhotometricData {
  return parsePhotometricFile(text, "ldt").data;
}

function axialTable(gammaToCd: Array<[number, number]>): PhotometricData {
  const verticalAngles = gammaToCd.map(([g]) => g);
  const intensities = [gammaToCd.map(([, cd]) => cd)];
  return {
    format: "ies",
    manufacturer: "Test",
    catalogNumber: "AXIAL",
    description: "Synthetic axial downlight",
    luminousFlux: 1000,
    watts: 10,
    lampCount: 1,
    ballastFactor: 1,
    verticalAngles,
    horizontalAngles: [0],
    intensities,
    symmetry: "axial",
    photometryType: 1,
  };
}

describe("official beam half-angles", () => {
  it("uses the documented 30° half-angle default when photometry is missing", () => {
    expect(DEFAULT_BEAM_HALF_ANGLE_DEG).toBe(30);
    expect(DEFAULT_BEAM_FULL_ANGLE_DEG).toBe(60);
    expect(officialBeamHalfAnglesDeg(null)).toEqual({
      c0Deg: 30,
      c90Deg: 30,
      source: "default",
      elliptic: false,
    });
    expect(officialBeamHalfAnglesDeg(undefined).source).toBe("default");
  });

  it("measures 50% FWHM from a known axial table and from a synthesized circular cone", () => {
    const table = axialTable([
      [0, 100],
      [10, 80],
      [20, 50],
      [30, 20],
      [90, 0],
    ]);
    const fromTable = officialBeamHalfAnglesDeg(table);
    expect(fromTable.source).toBe("photometry");
    expect(fromTable.elliptic).toBe(false);
    expect(fromTable.c0Deg).toBeCloseTo(20, 1);
    expect(fromTable.c90Deg).toBeCloseTo(20, 1);

    const cone40 = photoFromLdt(synthesizeCircularLdt(40));
    const measured = officialBeamHalfAnglesDeg(cone40);
    expect(measured.source).toBe("photometry");
    expect(measured.c0Deg).toBeCloseTo(20, 1);
    expect(measured.c90Deg).toBeCloseTo(measured.c0Deg, 1);
    expect(measured.elliptic).toBe(false);
  });

  it("uses a C0/C90 pair for an elongated beam instead of a circular average", () => {
    const verticalAngles = [0, 10, 20, 40, 90];
    const photo: PhotometricData = {
      format: "ies",
      manufacturer: "Test",
      catalogNumber: "LINEAR",
      description: "Elongated opening",
      luminousFlux: 1000,
      watts: 10,
      lampCount: 1,
      ballastFactor: 1,
      verticalAngles,
      horizontalAngles: [0, 90],
      intensities: [
        [100, 80, 50, 10, 0],
        [100, 90, 80, 50, 0],
      ],
      symmetry: "none",
      photometryType: 1,
      openingWidthM: 0.05,
      openingLengthM: 1.2,
    };
    const angles = officialBeamHalfAnglesDeg(photo);
    expect(angles.source).toBe("photometry");
    expect(angles.elliptic).toBe(true);
    expect(angles.c0Deg).toBeCloseTo(20, 1);
    expect(angles.c90Deg).toBeCloseTo(40, 1);
  });

  it("does not treat an 8-inch downlight name as an 8° beam", () => {
    const table = axialTable([
      [0, 100],
      [20, 50],
      [90, 0],
    ]);
    table.description = 'Silversun DLIS18CC8 8" downlight';
    table.catalogNumber = "DLIS18CC8";
    const angles = officialBeamHalfAnglesDeg(table);
    expect(angles.c0Deg).toBeCloseTo(20, 1);
    expect(angles.c0Deg).not.toBe(8);
  });
});

describe("official light-cone geometry", () => {
  it("puts the apex at the aperture, aims down local −Y, and reaches the workplane", () => {
    const photo = axialTable([
      [0, 100],
      [20, 50],
      [90, 0],
    ]);
    photo.openingWidthM = -0.1;
    photo.openingLengthM = -0.1;
    photo.openingHeightM = 0.04;
    const geom = officialLightConeGeom({
      photo,
      fixtureZ: 2.6,
      room: { workplaneHeightM: 0.75 },
    });
    expect(geom.apexLocal).toEqual([0, -0.02, 0]);
    expect(geom.axisLocal).toEqual([0, -1, 0]);
    expect(geom.lengthM).toBeCloseTo(2.6 - 0.02 - 0.75, 5);
    expect(geom.halfAngleC0Deg).toBeCloseTo(20, 1);
    expect(geom.endRadiusC0M).toBeCloseTo(geom.lengthM * Math.tan((20 * Math.PI) / 180), 4);
  });

  it("reaches the storey floor when the fixture has no room, and keeps a minimum length", () => {
    const geom = officialLightConeGeom({ photo: null, fixtureZ: 2.6, room: null });
    expect(geom.source).toBe("default");
    expect(geom.halfAngleC0Deg).toBe(30);
    expect(geom.lengthM).toBeGreaterThan(1);
    expect(officialConeLengthM(0.76, 0.75)).toBeGreaterThanOrEqual(0.08);
  });
});

describe("official 3D emission gizmo wiring", () => {
  const scene = read("src/components/editor/BuildingScene3D.tsx");
  const gizmo = read("src/components/editor/FixtureEmissionGizmo.tsx");
  const guide = read("docs/USER_GUIDE.md");

  it("shows the gizmo only for the selected fixture and ignores pointer hits", () => {
    expect(scene).toContain("FixtureEmissionGizmo");
    expect(scene).toContain("{selected && (");
    expect(gizmo).toContain("noopRaycast");
    expect(gizmo).toContain("officialLightConeGeom");
    expect(gizmo).not.toMatch(/DIALux/i);
    expect(guide).toMatch(/3D 發射方向與光束錐 \/ Emission direction and light cone in 3D/);
    expect(guide).toMatch(/local −Y, straight down/);
    expect(guide).toMatch(/本地向下，即 −Y/);
    expect(guide).toMatch(/50% \(half-peak \/ FWHM\)/);
    expect(guide).toMatch(/半峰值／FWHM/);
    expect(guide).toMatch(/conservative 30° half-angle/);
    expect(guide).toMatch(/保守的預設半角 30°/);
    expect(guide).toMatch(/do not catch pointer hits/);
    expect(guide).toMatch(/不會擋住點選/);
    expect(guide).not.toMatch(/DIALux/);
  });

  it("shows a Light cone / 光束錐 preview on the selected-fixture Properties card", () => {
    const editor = read("src/components/editor/BuildingEditor.tsx");
    const preview = read("src/components/editor/FixtureLightConePreview.tsx");
    expect(editor).toContain("FixtureLightConePreview");
    expect(editor).toContain("data-fixture-properties");
    expect(editor).toContain("Arrow on Top view shows photometric rotation (IES C0 = +X at 0°).");
    expect(preview).toContain("Light cone / 光束錐");
    expect(preview).toContain("officialLightConeGeom");
    expect(preview).not.toMatch(/DIALux/i);
    expect(guide).toMatch(/Light cone \/ 光束錐/);
    expect(guide).toMatch(/側視光錐預覽/);
    expect(guide).toMatch(/side-elevation preview of the same emission axis and beam cone/);
    expect(guide).toMatch(/workplane illuminance peak stays under the fixture/);
    expect(guide).toMatch(/工作面照度峰值會落在該燈的平面位置正下方/);
  });
});
