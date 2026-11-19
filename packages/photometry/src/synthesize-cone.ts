/**
 * Built-in calculated library cones.
 * Cosine-power distributions, normalized to 1000 lm, with intensities in cd/klm.
 * Circular templates use Isym=1 (one stored intensity plane).
 * Linear / LED-strip templates use Ityp=2 and Isym=2 (C0–C180 planes).
 */
import { emptyDirectRatios, writeEulumdat, type EulumdatDocument } from "./eulumdat";
import type { PhotometricFamily } from "./beam-keys";

const C_STEP = 15;
const MC = 360 / C_STEP;
const GAMMA_STEP = 5;

/** Default 1 m LED-strip sample box when no rectangular size is provided. */
export const LINEAR_SAMPLE_SIZE_MM = {
  length: 1000,
  width: 12,
  height: 8,
  luminousWidth: 10,
} as const;

function beamExponent(fwhmDeg: number): number {
  if (fwhmDeg >= 170) return 1;
  const half = (fwhmDeg / 2) * (Math.PI / 180);
  const c = Math.cos(half);
  if (c <= 1e-6 || c >= 1) return 1;
  return Math.log(0.5) / Math.log(c);
}

function relativeIntensity(gammaDeg: number, exponent: number): number {
  if (gammaDeg >= 90) return 0;
  const c = Math.cos(gammaDeg * (Math.PI / 180));
  if (c <= 0) return 0;
  return Math.pow(c, exponent);
}

/** Integrate a rotationally symmetric I(γ) table to lumens (I in candela). */
export function integrateAxialFlux(gamma: number[], intensity: number[]): number {
  let sum = 0;
  for (let i = 0; i < gamma.length - 1; i += 1) {
    const g0 = gamma[i]! * (Math.PI / 180);
    const g1 = gamma[i + 1]! * (Math.PI / 180);
    const i0 = intensity[i]! * Math.sin(g0);
    const i1 = intensity[i + 1]! * Math.sin(g1);
    sum += ((i0 + i1) / 2) * (g1 - g0);
  }
  return 2 * Math.PI * sum;
}

function cosinePowerCurve(beamDegrees: number): { gammaAngles: number[]; curve: number[] } {
  const exponent = beamExponent(beamDegrees);
  const gammaAngles: number[] = [];
  for (let g = 0; g <= 180; g += GAMMA_STEP) gammaAngles.push(g);
  const relative = gammaAngles.map((g) => relativeIntensity(g, exponent));
  const fluxRel = integrateAxialFlux(gammaAngles, relative);
  const scale = fluxRel > 0 ? 1000 / fluxRel : 0;
  return { gammaAngles, curve: relative.map((v) => v * scale) };
}

function cAngles360(): number[] {
  const angles: number[] = [];
  for (let c = 0; c < 360; c += C_STEP) angles.push(c);
  return angles;
}

function templateLamps(): EulumdatDocument["lamps"] {
  return [
    {
      lampCount: 1,
      lampType: "LED",
      flux: 1000,
      colorTemperature: "4000",
      cri: "90",
      wattage: 10,
    },
  ];
}

export function buildCircularConeDocument(beamDegrees: number): EulumdatDocument {
  const { gammaAngles, curve } = cosinePowerCurve(beamDegrees);
  const pad = String(beamDegrees).padStart(3, "0");
  return {
    company: "LUXSIM",
    ityp: 1,
    isym: 1,
    mc: MC,
    dc: C_STEP,
    ng: gammaAngles.length,
    dg: GAMMA_STEP,
    report: `CALCULATED LIBRARY CONE ${pad}`,
    luminaireName: `LIBRARY-CONE-${pad}`,
    luminaireNumber: "TEMPLATE",
    fileName: `library-cone-${pad}.ldt`,
    dateUser: "LUXSIM calculated library cone",
    luminaireLength: 0,
    luminaireWidth: 0,
    luminaireHeight: 0,
    luminousLength: 0,
    luminousWidth: 0,
    luminousHeightC0: 0,
    luminousHeightC90: 0,
    luminousHeightC180: 0,
    luminousHeightC270: 0,
    dff: 100,
    lorl: 100,
    conversion: 1,
    tilt: 0,
    lamps: templateLamps(),
    directRatios: emptyDirectRatios(),
    cAngles: cAngles360(),
    gammaAngles,
    intensities: [[...curve]],
  };
}

export function buildLinearConeDocument(beamDegrees: number): EulumdatDocument {
  const { gammaAngles, curve } = cosinePowerCurve(beamDegrees);
  const pad = String(beamDegrees).padStart(3, "0");
  const storedPlanes = Math.floor(MC / 2) + 1;
  const intensities = Array.from({ length: storedPlanes }, () => [...curve]);
  return {
    company: "LUXSIM",
    ityp: 2,
    isym: 2,
    mc: MC,
    dc: C_STEP,
    ng: gammaAngles.length,
    dg: GAMMA_STEP,
    report: `CALCULATED LIBRARY CONE LINEAR ${pad}`,
    luminaireName: `LIBRARY-CONE-LINEAR-${pad}`,
    luminaireNumber: "TEMPLATE",
    fileName: `library-cone-linear-${pad}.ldt`,
    dateUser: "LUXSIM calculated library cone",
    luminaireLength: LINEAR_SAMPLE_SIZE_MM.length,
    luminaireWidth: LINEAR_SAMPLE_SIZE_MM.width,
    luminaireHeight: LINEAR_SAMPLE_SIZE_MM.height,
    luminousLength: LINEAR_SAMPLE_SIZE_MM.length,
    luminousWidth: LINEAR_SAMPLE_SIZE_MM.luminousWidth,
    luminousHeightC0: 0,
    luminousHeightC90: 0,
    luminousHeightC180: 0,
    luminousHeightC270: 0,
    dff: 100,
    lorl: 100,
    conversion: 1,
    tilt: 0,
    lamps: templateLamps(),
    directRatios: emptyDirectRatios(),
    cAngles: cAngles360(),
    gammaAngles,
    intensities,
  };
}

export function buildLibraryConeDocument(
  family: PhotometricFamily,
  beamDegrees: number
): EulumdatDocument {
  return family === "linear"
    ? buildLinearConeDocument(beamDegrees)
    : buildCircularConeDocument(beamDegrees);
}

export function synthesizeCircularLdt(beamDegrees: number): string {
  return writeEulumdat(buildCircularConeDocument(beamDegrees));
}

export function synthesizeLinearLdt(beamDegrees: number): string {
  return writeEulumdat(buildLinearConeDocument(beamDegrees));
}
