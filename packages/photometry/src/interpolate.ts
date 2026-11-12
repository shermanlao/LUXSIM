import type { PhotometricData } from "./types";

function wrapAngle360(deg: number): number {
  let a = deg % 360;
  if (a < 0) a += 360;
  return a;
}

function findBracket(angles: number[], value: number): [number, number, number] {
  if (angles.length === 1) return [0, 0, 0];
  if (value <= angles[0]!) return [0, 0, 0];
  if (value >= angles[angles.length - 1]!) {
    const last = angles.length - 1;
    return [last, last, 0];
  }
  for (let i = 0; i < angles.length - 1; i += 1) {
    const a0 = angles[i]!;
    const a1 = angles[i + 1]!;
    if (value >= a0 && value <= a1) {
      const t = a1 === a0 ? 0 : (value - a0) / (a1 - a0);
      return [i, i + 1, t];
    }
  }
  const last = angles.length - 1;
  return [last, last, 0];
}

/**
 * Sample luminous intensity (cd) at photometric angles (theta vertical, phi horizontal).
 * theta: 0 = nadir (down), 180 = zenith — matches typical IES Type C vertical.
 * phi: degrees around vertical axis.
 */
export function sampleIntensityCd(
  photo: PhotometricData,
  thetaDeg: number,
  phiDeg: number
): number {
  const { verticalAngles, horizontalAngles, intensities } = photo;
  if (!verticalAngles.length || !horizontalAngles.length) return 0;

  const vmin = verticalAngles[0] ?? 0;
  const vmax = verticalAngles[verticalAngles.length - 1] ?? 180;
  const theta =
    vmin < -1e-6
      ? Math.min(vmax, Math.max(vmin, thetaDeg))
      : Math.min(180, Math.max(0, thetaDeg));

  const hMin = horizontalAngles[0] ?? 0;
  const hMax = horizontalAngles[horizontalAngles.length - 1] ?? 360;
  let phi: number;
  if (hMin < -1e-6) {
    phi = wrapAngle360(phiDeg);
    if (phi > 180) phi -= 360;
    if (phi < hMin) phi = hMin;
    if (phi > hMax) phi = hMax;
  } else {
    phi = wrapAngle360(phiDeg);
    // Extend horizontal domain if file only covers 0–90 / 0–180
    if (hMax <= 90 + 1e-6) {
      if (phi > 180) phi = 360 - phi;
      if (phi > 90) phi = 180 - phi;
    } else if (hMax <= 180 + 1e-6) {
      if (phi > 180) phi = 360 - phi;
    }
  }

  // Axial symmetry: only one horizontal plane
  if (horizontalAngles.length === 1 || photo.symmetry === "axial") {
    const [v0, v1, tv] = findBracket(verticalAngles, theta);
    const i0 = intensities[0]?.[v0] ?? 0;
    const i1 = intensities[0]?.[v1] ?? 0;
    return i0 * (1 - tv) + i1 * tv;
  }

  const [v0, v1, tv] = findBracket(verticalAngles, theta);
  const [h0, h1, th] = findBracket(horizontalAngles, phi);

  const i00 = intensities[h0]?.[v0] ?? 0;
  const i01 = intensities[h0]?.[v1] ?? 0;
  const i10 = intensities[h1]?.[v0] ?? 0;
  const i11 = intensities[h1]?.[v1] ?? 0;

  const i0 = i00 * (1 - tv) + i01 * tv;
  const i1 = i10 * (1 - tv) + i11 * tv;
  return i0 * (1 - th) + i1 * th;
}

export type PolarPoint = { gamma: number; cd: number };

/** One C-plane cut: Type C 0–180°, Type B the native signed vertical range. */
export function polarPlane(photo: PhotometricData, phiDeg: number, samples = 73): PolarPoint[] {
  const vmin = photo.verticalAngles[0] ?? 0;
  const vmax = photo.verticalAngles[photo.verticalAngles.length - 1] ?? 180;
  const start = vmin < -1e-6 ? vmin : 0;
  const end = vmax;
  const out: PolarPoint[] = [];
  const n = Math.max(2, samples);
  for (let i = 0; i < n; i += 1) {
    const gamma = start + ((end - start) * i) / (n - 1);
    out.push({ gamma, cd: sampleIntensityCd(photo, gamma, phiDeg) });
  }
  return out;
}

/** Map intensity to cartesian with 0° at +Y (nadir; bottom of a Y-down canvas). */
export function polarToXY(gammaDeg: number, cd: number, maxCd: number, rMax: number): { x: number; y: number } {
  const r = (cd / Math.max(maxCd, 1e-6)) * rMax;
  const rad = (gammaDeg * Math.PI) / 180;
  return { x: r * Math.sin(rad), y: r * Math.cos(rad) };
}

/** Polar diagram samples for UI preview (cd at vertical angles, phi=0). */
export function polarPreview(photo: PhotometricData, samples = 37): { theta: number; cd: number }[] {
  return polarPlane(photo, 0, samples).map((p) => ({ theta: p.gamma, cd: p.cd }));
}
