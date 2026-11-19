import { parseEulumdat, storedIntensityPlaneCount, type EulumdatDocument } from "./eulumdat";
import { parseFirstNumber } from "./beam-keys";
import type { ParseResult, PhotometricData } from "./types";

function wrap360(deg: number): number {
  let a = deg % 360;
  if (a < 0) a += 360;
  return a;
}

function almostEqual(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) <= eps;
}

/**
 * Fold a C-angle onto a plane that is stored for the given Isym.
 * 0 = none, 1 = vertical axis, 2 = C0–C180, 3 = C90–C270, 4 = both planes.
 */
function canonicalStoredC(isym: number, cDeg: number): number {
  let a = wrap360(cDeg);
  if (isym === 1) return 0;
  if (isym === 2 || isym === 4) {
    if (a > 180) a = 360 - a;
  }
  if (isym === 3) {
    const folded = wrap360(180 - a);
    if (a >= 90 - 1e-6 && a <= 270 + 1e-6) return a;
    return folded;
  }
  if (isym === 4 && a > 90 && a <= 180) {
    a = 180 - a;
  }
  return a;
}

function findClosestAngleIndex(angles: number[], target: number): number {
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < angles.length; i += 1) {
    const d = Math.abs(wrap360(angles[i]! - target));
    const dist = Math.min(d, 360 - d);
    if (dist < bestDist) {
      best = i;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * Expand the Isym-compact intensity table to one row per listed C-plane
 * so the solver and flux integral can walk the full 360° grid.
 */
export function expandIntensityPlanes(doc: EulumdatDocument): number[][] {
  const stored = doc.intensities;
  const mc = doc.mc;
  const isym = doc.isym;
  const expected = storedIntensityPlaneCount(isym, mc);
  if (stored.length !== expected) {
    throw new Error(
      `LDT intensity planes ${stored.length} do not match Isym=${isym} expectation ${expected}`
    );
  }

  if (isym === 0 || stored.length === mc) {
    return stored.map((row) => [...row]);
  }

  if (isym === 1) {
    const plane = stored[0] ?? doc.gammaAngles.map(() => 0);
    return doc.cAngles.map(() => [...plane]);
  }

  // Map each stored plane to the C-angle it belongs to, in file order.
  const storedForAngle = new Map<number, number[]>();
  if (isym === 2) {
    const last = Math.floor(mc / 2);
    for (let i = 0; i <= last && i < stored.length; i += 1) {
      storedForAngle.set(wrap360(doc.cAngles[i] ?? i * (doc.dc || 15)), stored[i]!);
    }
  } else if (isym === 3) {
    for (let i = 0; i < doc.cAngles.length; i += 1) {
      const a = wrap360(doc.cAngles[i]!);
      if (a >= 90 - 1e-6 && a <= 270 + 1e-6) {
        const idx = storedForAngle.size;
        if (idx < stored.length) storedForAngle.set(a, stored[idx]!);
      }
    }
  } else if (isym === 4) {
    const last = Math.floor(mc / 4);
    for (let i = 0; i <= last && i < stored.length; i += 1) {
      storedForAngle.set(wrap360(doc.cAngles[i] ?? i * (doc.dc || 15)), stored[i]!);
    }
  }

  return doc.cAngles.map((c) => {
    const canonical = canonicalStoredC(isym, c);
    const direct = storedForAngle.get(canonical);
    if (direct) return [...direct];
    for (const [angle, row] of storedForAngle) {
      if (almostEqual(angle, canonical) || almostEqual(wrap360(angle), wrap360(canonical))) {
        return [...row];
      }
    }
    const idx = findClosestAngleIndex([...storedForAngle.keys()], canonical);
    const key = [...storedForAngle.keys()][idx];
    return [...(storedForAngle.get(key!) ?? stored[0] ?? [])];
  });
}

function lightOutputRatio(lorl: number): number {
  if (!Number.isFinite(lorl) || lorl <= 0) return 1;
  return lorl > 1 ? lorl / 100 : lorl;
}

function headerFluxLm(doc: EulumdatDocument): number | null {
  const lamp = doc.lamps[0];
  if (!lamp || !Number.isFinite(lamp.flux) || lamp.flux <= 0) return null;
  const lor = lightOutputRatio(doc.lorl);
  return lamp.flux * lor;
}

function openingMetres(doc: EulumdatDocument): Pick<
  PhotometricData,
  "openingWidthM" | "openingLengthM" | "openingHeightM"
> {
  const lengthM = (Number.isFinite(doc.luminaireLength) ? doc.luminaireLength : 0) / 1000;
  const widthM = (Number.isFinite(doc.luminaireWidth) ? doc.luminaireWidth : 0) / 1000;
  const heightM = (Number.isFinite(doc.luminaireHeight) ? doc.luminaireHeight : 0) / 1000;
  const circular = widthM <= 1e-9 && lengthM > 1e-9;
  if (circular) {
    return {
      openingWidthM: -lengthM,
      openingLengthM: -lengthM,
      openingHeightM: heightM,
    };
  }
  return {
    openingWidthM: widthM || undefined,
    openingLengthM: lengthM || undefined,
    openingHeightM: heightM || undefined,
  };
}

function symmetryLabel(isym: number): PhotometricData["symmetry"] {
  if (isym === 1) return "axial";
  if (isym === 2 || isym === 3) return "bilateral";
  if (isym === 4) return "quad";
  return "none";
}

/**
 * Parse EULUMDAT (.ldt) into solver photometry.
 * File intensities are treated as cd/klm and converted to absolute candela
 * using the lamp-block flux (and LORL when it is not 100%).
 */
export function parseLdt(text: string): ParseResult {
  const warnings: string[] = [];
  const doc = parseEulumdat(text);
  const intensitiesCdKlm = expandIntensityPlanes(doc);
  const flux = headerFluxLm(doc);
  const conversion =
    Number.isFinite(doc.conversion) && doc.conversion > 0 ? doc.conversion : 1;

  const intensities: number[][] = intensitiesCdKlm.map((row) =>
    row.map((raw) => {
      const value = Number.isFinite(raw) ? raw * conversion : 0;
      if (flux && flux > 0) return (value * flux) / 1000;
      return value;
    })
  );

  if (!(flux && flux > 0)) {
    warnings.push("LDT luminous flux unknown; using raw intensity table units");
  }
  if (doc.ityp !== 1 && doc.ityp !== 2) {
    warnings.push(`LDT type indicator ${doc.ityp}`);
  }

  const lamp = doc.lamps[0];
  const cctK = parseFirstNumber(lamp?.colorTemperature ?? null);
  const cri = parseFirstNumber(lamp?.cri ?? null);
  const watts = lamp && Number.isFinite(lamp.wattage) && lamp.wattage > 0 ? lamp.wattage : null;
  const lampCount = lamp ? Math.max(1, Math.abs(Math.round(lamp.lampCount) || 1)) : 1;

  const data: PhotometricData = {
    format: "ldt",
    manufacturer: doc.company,
    catalogNumber: doc.luminaireNumber || doc.fileName,
    description: doc.luminaireName || doc.company || "Imported LDT luminaire",
    luminousFlux: flux,
    watts,
    lampCount,
    ballastFactor: 1,
    verticalAngles: [...doc.gammaAngles],
    horizontalAngles: [...doc.cAngles],
    intensities,
    symmetry: symmetryLabel(doc.isym),
    photometryType: 1,
    ...openingMetres(doc),
    cctK: cctK && cctK > 0 ? cctK : null,
    cri: cri && cri > 0 ? cri : null,
  };

  return { data, warnings };
}
