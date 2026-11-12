import { describe, expect, it } from "vitest";
import {
  buildLibraryConeDocument,
  generateLibraryCone,
  integrateAxialFlux,
  isLibraryBeamDegrees,
  nearestCircularBeam,
  nearestLinearBeam,
  parseEulumdat,
  parseFixtureSizeMm,
  parseLdt,
  recommendLibraryBeam,
  sampleIntensityCd,
  stampLibraryConeDocument,
  storedIntensityPlaneCount,
  writeEulumdat,
  CIRCULAR_BEAM_DEGREES,
  LINEAR_BEAM_DEGREES,
} from "./index";

describe("library beam keys", () => {
  it("lists the circular and linear families", () => {
    expect(CIRCULAR_BEAM_DEGREES).toContain(8);
    expect(CIRCULAR_BEAM_DEGREES).toContain(160);
    expect(CIRCULAR_BEAM_DEGREES).toContain(180);
    expect(LINEAR_BEAM_DEGREES).not.toContain(8);
    expect(LINEAR_BEAM_DEGREES).not.toContain(100);
    expect(isLibraryBeamDegrees("circular", 160)).toBe(true);
    expect(isLibraryBeamDegrees("linear", 8)).toBe(false);
  });

  it("snaps a hint to the nearest library key", () => {
    expect(nearestCircularBeam(37)).toBe(36);
    expect(nearestCircularBeam(155)).toBe(160);
    expect(nearestLinearBeam(118)).toBe(120);
    const rec = recommendLibraryBeam("36°", "circular");
    expect(rec.kind).toBe("exact");
    expect(rec.beamDegrees).toBe(36);
    const near = recommendLibraryBeam("34", "circular");
    expect(near.kind).toBe("nearest");
    expect(near.beamDegrees).toBe(36);
    const dual = recommendLibraryBeam("15/24", "circular");
    expect(dual.kind).toBe("dual");
    expect(dual.beamDegrees).toBe(15);
    expect(recommendLibraryBeam("", "linear").beamDegrees).toBe(120);
  });
});

describe("fixture size parser", () => {
  it("parses circular and rectangular catalog sizes", () => {
    expect(parseFixtureSizeMm("Dia90 x H70")).toEqual({
      length: 90,
      width: 0,
      height: 70,
      circular: true,
    });
    expect(parseFixtureSizeMm("Ø75×H55")).toEqual({
      length: 75,
      width: 0,
      height: 55,
      circular: true,
    });
    expect(parseFixtureSizeMm("L1200xW50xH40")).toEqual({
      length: 1200,
      width: 50,
      height: 40,
      circular: false,
    });
  });
});

describe("library cone synthesis", () => {
  it("builds a circular cone with Isym=1, Mc=24, 10 direct ratios, and ~1000 lm", () => {
    const doc = buildLibraryConeDocument("circular", 160);
    expect(doc.ityp).toBe(1);
    expect(doc.isym).toBe(1);
    expect(doc.mc).toBe(24);
    expect(doc.dc).toBe(15);
    expect(doc.cAngles).toHaveLength(24);
    expect(doc.cAngles[0]).toBe(0);
    expect(doc.cAngles[23]).toBe(345);
    expect(doc.directRatios).toEqual(Array(10).fill(0));
    expect(doc.intensities).toHaveLength(1);
    expect(doc.luminaireLength).toBe(0);
    expect(doc.luminaireWidth).toBe(0);
    const flux = integrateAxialFlux(doc.gammaAngles, doc.intensities[0]!);
    expect(flux).toBeCloseTo(1000, 0);
    const nadir = doc.intensities[0]![0]!;
    const half = doc.intensities[0]![16]!; // 80°
    // 160° FWHM → I(80°) ≈ 0.5 I(0)
    expect(half / nadir).toBeCloseTo(0.5, 1);
  });

  it("builds a linear cone with Ityp=2, Isym=2, and the 1 m sample box", () => {
    const doc = buildLibraryConeDocument("linear", 120);
    expect(doc.ityp).toBe(2);
    expect(doc.isym).toBe(2);
    expect(doc.intensities).toHaveLength(storedIntensityPlaneCount(2, 24));
    expect(doc.luminaireLength).toBe(1000);
    expect(doc.luminaireWidth).toBe(12);
    expect(doc.luminaireHeight).toBe(8);
    expect(new Set(doc.intensities.map((row) => row.join(","))).size).toBe(1);
  });

  it("stamps header fields without changing cd/klm intensities", () => {
    const template = buildLibraryConeDocument("circular", 40);
    const before = template.intensities[0]!.slice();
    const stamped = stampLibraryConeDocument(
      template,
      {
        name: "Office downlight",
        catalogNumber: "DL-40",
        lumens: 2500,
        watts: 22,
        cctK: 3000,
        cri: 90,
        size: "Dia90 x H70",
      },
      "circular"
    );
    expect(stamped.intensities[0]).toEqual(before);
    expect(stamped.lamps[0]?.flux).toBe(2500);
    expect(stamped.lamps[0]?.wattage).toBe(22);
    expect(stamped.lamps[0]?.colorTemperature).toBe("3000");
    expect(stamped.lamps[0]?.cri).toBe("90");
    expect(stamped.luminaireName).toBe("Office downlight");
    expect(stamped.fileName).toBe("DL-40.ldt");
    expect(stamped.luminaireLength).toBe(90);
    expect(stamped.luminaireWidth).toBe(0);
    expect(stamped.luminaireHeight).toBe(70);
  });

  it("rejects missing or non-positive lumen", () => {
    expect(() =>
      generateLibraryCone({ family: "circular", beamDegrees: 24, lumens: 0 })
    ).toThrow(/lumen/i);
    expect(() =>
      generateLibraryCone({ family: "circular", beamDegrees: 24, lumens: -10 })
    ).toThrow(/lumen/i);
  });

  it("rejects a beam that is not a library key", () => {
    expect(() =>
      generateLibraryCone({ family: "circular", beamDegrees: 37, lumens: 1000 })
    ).toThrow(/library beam/i);
  });
});

describe("generate + parseLdt round trip", () => {
  it("parses a generated circular LDT so lumen scales absolute candela", () => {
    const a = generateLibraryCone({
      family: "circular",
      beamDegrees: 160,
      name: "Cone A",
      lumens: 1000,
      watts: 10,
      cctK: 4000,
      cri: 90,
    });
    const b = generateLibraryCone({
      family: "circular",
      beamDegrees: 160,
      name: "Cone B",
      lumens: 2000,
      watts: 20,
    });

    const docA = parseEulumdat(a.text);
    const docB = parseEulumdat(b.text);
    expect(docA.intensities[0]).toEqual(docB.intensities[0]);
    expect(docA.lamps[0]?.flux).toBe(1000);
    expect(docB.lamps[0]?.flux).toBe(2000);
    expect(docA.directRatios).toHaveLength(10);

    const parsedA = parseLdt(a.text).data;
    const parsedB = parseLdt(b.text).data;
    expect(parsedA.luminousFlux).toBe(1000);
    expect(parsedB.luminousFlux).toBe(2000);
    expect(parsedA.watts).toBe(10);
    expect(parsedB.watts).toBe(20);
    expect(parsedA.symmetry).toBe("axial");
    expect(parsedA.cctK).toBe(4000);
    expect(parsedA.cri).toBe(90);
    expect(parsedA.horizontalAngles).toHaveLength(24);
    expect(parsedA.intensities).toHaveLength(24);

    const nadirA = sampleIntensityCd(parsedA, 0, 0);
    const nadirB = sampleIntensityCd(parsedB, 0, 0);
    expect(nadirB / nadirA).toBeCloseTo(2, 5);
    const midA = sampleIntensityCd(parsedA, 40, 90);
    const midB = sampleIntensityCd(parsedB, 40, 90);
    expect(midB / midA).toBeCloseTo(2, 5);
    expect(parsedA.intensities[0]![0]).toBeCloseTo((docA.intensities[0]![0]! * 1000) / 1000, 5);
  });

  it("parses a generated linear LDT including the sample box and C0–C180 symmetry", () => {
    const generated = generateLibraryCone({
      family: "linear",
      beamDegrees: 120,
      name: "LED strip",
      catalogNumber: "LS-120",
      lumens: 1500,
      watts: 14,
    });
    expect(generated.downloadName).toBe("LS-120.ldt");
    const doc = parseEulumdat(generated.text);
    expect(doc.isym).toBe(2);
    expect(doc.intensities).toHaveLength(13);
    const parsed = parseLdt(generated.text).data;
    expect(parsed.luminousFlux).toBe(1500);
    expect(parsed.symmetry).toBe("bilateral");
    expect(parsed.openingLengthM).toBeCloseTo(1, 6);
    expect(parsed.openingWidthM).toBeCloseTo(0.012, 6);
    const c0 = sampleIntensityCd(parsed, 20, 0);
    const c180 = sampleIntensityCd(parsed, 20, 180);
    const c90 = sampleIntensityCd(parsed, 20, 90);
    expect(c0).toBeCloseTo(c180, 5);
    expect(c90).toBeCloseTo(c0, 5);
  });

  it("applies a rectangular size onto a linear cone and a diameter onto a circular cone", () => {
    const linear = generateLibraryCone({
      family: "linear",
      beamDegrees: 120,
      lumens: 800,
      size: "L1200xW50xH40",
    });
    const circular = generateLibraryCone({
      family: "circular",
      beamDegrees: 24,
      lumens: 800,
      size: "Dia90 x H70",
    });
    const lin = parseLdt(linear.text).data;
    const circ = parseLdt(circular.text).data;
    expect(lin.openingLengthM).toBeCloseTo(1.2, 6);
    expect(lin.openingWidthM).toBeCloseTo(0.05, 6);
    expect(lin.openingHeightM).toBeCloseTo(0.04, 6);
    expect(circ.openingWidthM).toBeCloseTo(-0.09, 6);
    expect(circ.openingLengthM).toBeCloseTo(-0.09, 6);
    expect(circ.openingHeightM).toBeCloseTo(0.07, 6);
  });

  it("writes text that survives write → parseEulumdat → write", () => {
    const generated = generateLibraryCone({
      family: "circular",
      beamDegrees: 36,
      lumens: 1200,
      name: "Spot 36",
    });
    const again = writeEulumdat(parseEulumdat(generated.text));
    expect(parseEulumdat(again).lamps[0]?.flux).toBe(1200);
    expect(parseLdt(again).data.luminousFlux).toBe(1200);
  });
});
