import type { LuminaireBody, PhotometricData } from "./types";

function degToRad(d: number): number {
  return (d * Math.PI) / 180;
}

/**
 * Emitted luminous flux from the intensity table (lm).
 * Uses the header flux when it is already known. For absolute-photometry
 * IES files (lamp lumens = −1) this integrates the candela table.
 */
export function estimateFlux(photo: PhotometricData): number {
  if (photo.luminousFlux && photo.luminousFlux > 0) return photo.luminousFlux;
  const { verticalAngles: V, horizontalAngles: H, intensities } = photo;
  if (V.length < 2 || H.length < 1 || !intensities.length) return 0;

  const vmin = V[0] ?? 0;
  const typeB = vmin < -1e-6;

  let flux = 0;
  const nH = H.length;
  for (let h = 0; h < nH; h += 1) {
    const h0 = H[h]!;
    const h1 = H[(h + 1) % nH]!;
    let dPhi = degToRad(h1 - h0);
    if (dPhi <= 1e-9) {
      const span = (H[nH - 1]! - H[0]!) || 360;
      // If the file only covers 180° (typical Type B), close the other half
      // by using the same intensities — handled via the leftover gap below.
      dPhi = degToRad(span / Math.max(1, nH - 1));
    }
    for (let v = 0; v < V.length - 1; v += 1) {
      const g0 = V[v]!;
      const g1 = V[v + 1]!;
      // Type B vertical runs −90…90 with 0 at nadir; the negative half is the
      // other side of the same plane, so only integrate g ≥ 0 to avoid doubling.
      if (typeB && g1 <= 1e-6) continue;
      const I =
        0.25 *
        ((intensities[h]?.[v] ?? 0) +
          (intensities[h]?.[v + 1] ?? 0) +
          (intensities[(h + 1) % intensities.length]?.[v] ?? 0) +
          (intensities[(h + 1) % intensities.length]?.[v + 1] ?? 0));
      // Zone integral: I · Δφ · |cos θ0 − cos θ1| with θ = angle from nadir.
      const t0 = typeB ? degToRad(Math.abs(Math.max(g0, 0))) : degToRad(g0);
      const t1 = typeB ? degToRad(Math.abs(g1)) : degToRad(g1);
      const ring = Math.abs(Math.cos(t0) - Math.cos(t1));
      flux += I * Math.abs(dPhi) * ring;
    }
  }

  // Type B files often list only a 180° horizontal span (−90…90).
  if (typeB) {
    const hSpan = Math.abs((H[H.length - 1] ?? 90) - (H[0] ?? -90));
    if (hSpan > 1 && hSpan < 270) {
      flux *= 360 / hSpan;
    }
  }

  return Math.max(0, flux);
}

/** Best display flux: header, then integrated table, then catalog keyword. */
export function resolvedFlux(photo: PhotometricData): number | null {
  if (photo.luminousFlux && photo.luminousFlux > 0) return photo.luminousFlux;
  const integrated = estimateFlux(photo);
  if (integrated > 1) return integrated;
  if (photo.catalogFluxLm && photo.catalogFluxLm > 0) return photo.catalogFluxLm;
  return null;
}

export function luminaireBody(photo?: PhotometricData | null): LuminaireBody {
  const wRaw = photo?.openingWidthM ?? 0;
  const lRaw = photo?.openingLengthM ?? 0;
  const hRaw = photo?.openingHeightM ?? 0;
  const w = Math.abs(wRaw);
  const l = Math.abs(lRaw);
  const hFile = Math.abs(hRaw);
  const circular = (wRaw < 0 && lRaw < 0) || (wRaw < 0 && l <= 1e-6) || (lRaw < 0 && w <= 1e-6);
  const diameter = circular ? Math.max(w, l) : null;

  const fallback = 0.1;
  const widthM = w > 1e-4 ? w : circular && diameter ? diameter : fallback;
  const lengthM = l > 1e-4 ? l : circular && diameter ? diameter : fallback;
  const plan = Math.max(widthM, lengthM);
  // File height 0 means a flat luminous opening — keep the datasheet honest,
  // but give the 3D body a thin housing so the fixture is visible.
  const heightM = hFile > 1e-4 ? hFile : Math.min(0.04, Math.max(0.018, plan * 0.2));

  const text = `${photo?.description ?? ""} ${photo?.manufacturer ?? ""}`.toLowerCase();
  const housing: LuminaireBody["housing"] = /black|blk|bk\b/.test(text) ? "black" : "white";

  return {
    shape: circular || (!w && !l) ? "circle" : "rectangle",
    isCircular: circular || (!w && !l),
    widthM,
    lengthM,
    heightM,
    fileHeightM: hFile,
    diameterM: circular || (!w && !l) ? (diameter && diameter > 1e-4 ? diameter : plan) : null,
    housing,
  };
}

export function formatDimensions(body: LuminaireBody): string {
  const mm = (m: number) => Math.round(m * 1000);
  if (body.isCircular && body.diameterM) {
    return body.fileHeightM > 1e-4
      ? `Ø ${mm(body.diameterM)} × ${mm(body.fileHeightM)} mm`
      : `Ø ${mm(body.diameterM)} mm`;
  }
  return `${mm(body.widthM)} × ${mm(body.lengthM)} × ${mm(body.fileHeightM || body.heightM)} mm`;
}

export function formatCct(photo: PhotometricData): string | null {
  return photo.cctK && photo.cctK > 0 ? `${Math.round(photo.cctK)} K` : null;
}
