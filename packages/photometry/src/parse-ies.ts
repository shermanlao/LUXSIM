import type { ParseResult, PhotometricData } from "./types";

function parseNumber(token: string): number {
  const n = Number(token.trim());
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Minimal IES LM-63 parser (tilt=NONE, common manufacturer files).
 * Not a full LM-63 suite — covers typical Type C indoor distributions.
 */
export function parseIes(text: string): ParseResult {
  const warnings: string[] = [];
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  let i = 0;
  const first = lines[0]?.trim() ?? "";
  if (!/^IESNA/i.test(first) && !/^IES:/i.test(first)) {
    warnings.push("Missing IESNA header; attempting best-effort parse");
  } else {
    i = 1;
  }

  let manufacturer = "";
  let catalogNumber = "";
  let description = "";
  let lampText = "";
  let cctK: number | null = null;
  let cri: number | null = null;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const upper = line.trim().toUpperCase();
    if (upper === "TILT=NONE" || upper.startsWith("TILT=")) {
      i += 1;
      break;
    }
    if (line.startsWith("[MANUFAC]")) manufacturer = line.slice(9).trim();
    else if (line.startsWith("[LUMCAT]")) catalogNumber = line.slice(8).trim();
    else if (line.startsWith("[LUMINAIRE]")) description = line.slice(11).trim();
    else if (line.startsWith("[LAMP]")) lampText += " " + line.slice(6).trim();
    else if (line.startsWith("[LAMPCAT]")) lampText += " " + line.slice(9).trim();
    else if (line.startsWith("[COLORTEMP]") || line.startsWith("[_CCT]") || line.startsWith("[CCT]")) {
      const n = parseNumber(line.replace(/\[[^\]]+\]/, ""));
      if (n > 0) cctK = n;
    } else if (line.startsWith("[CRI]") || line.startsWith("[_CRI]")) {
      const n = parseNumber(line.replace(/\[[^\]]+\]/, ""));
      if (n > 0) cri = n;
    } else if (line.startsWith("[")) {
      /* keyword */
    } else if (line.trim() && !description) {
      description = line.trim();
    }
    i += 1;
  }

  const hintText = `${description} ${lampText}`;
  if (cctK == null) {
    const range = hintText.match(/(\d{3,4})\s*K?\s*(?:[-–]|to)\s*(\d{3,4})\s*K/i);
    if (!range) {
      const m = hintText.match(/(\d{3,4})\s*K\b/i);
      if (m) cctK = Number(m[1]);
    }
  }
  if (cri == null) {
    const m = hintText.match(/\b(?:CRI|Ra)\s*[:=]?\s*(\d{2,3})\b/i);
    if (m) cri = Number(m[1]);
  }
  let catalogFluxLm: number | null = null;
  const lmHint = hintText.match(/(\d+(?:\.\d+)?)\s*lm\b/i);
  if (lmHint) catalogFluxLm = Number(lmHint[1]);


  // Collect remaining numeric tokens
  const tokens: string[] = [];
  for (; i < lines.length; i += 1) {
    const line = lines[i]?.trim();
    if (!line || line.startsWith("[")) continue;
    tokens.push(...line.split(/[\s,]+/).filter(Boolean));
  }

  if (tokens.length < 10) {
    throw new Error("IES file too short: missing photometric header values");
  }

  let t = 0;
  const lampCount = parseNumber(tokens[t++]!);
  const lumensPerLamp = parseNumber(tokens[t++]!);
  const candelaMultiplier = parseNumber(tokens[t++]!);
  const nVert = Math.round(parseNumber(tokens[t++]!));
  const nHoriz = Math.round(parseNumber(tokens[t++]!));
  const photometryType = parseNumber(tokens[t++]!);
  const unitsType = parseNumber(tokens[t++]!);
  const rawWidth = parseNumber(tokens[t++]!);
  const rawLength = parseNumber(tokens[t++]!);
  const rawHeight = parseNumber(tokens[t++]!);
  const toMetres = unitsType === 1 ? 0.3048 : 1;
  const openingWidthM = Number.isFinite(rawWidth) ? rawWidth * toMetres : 0;
  const openingLengthM = Number.isFinite(rawLength) ? rawLength * toMetres : 0;
  const openingHeightM = Number.isFinite(rawHeight) ? rawHeight * toMetres : 0;
  const ballastFactor = parseNumber(tokens[t++]!);
  t += 1; // future use
  const inputWatts = parseNumber(tokens[t++]!);

  if (!Number.isFinite(nVert) || !Number.isFinite(nHoriz) || nVert < 1 || nHoriz < 1) {
    throw new Error("Invalid vertical/horizontal angle counts in IES file");
  }

  const verticalAngles: number[] = [];
  for (let v = 0; v < nVert; v += 1) {
    verticalAngles.push(parseNumber(tokens[t++]!));
  }
  const horizontalAngles: number[] = [];
  for (let h = 0; h < nHoriz; h += 1) {
    horizontalAngles.push(parseNumber(tokens[t++]!));
  }

  const intensities: number[][] = [];
  const bf = Number.isFinite(ballastFactor) && ballastFactor > 0 ? ballastFactor : 1;
  const cm = Number.isFinite(candelaMultiplier) && candelaMultiplier > 0 ? candelaMultiplier : 1;

  for (let h = 0; h < nHoriz; h += 1) {
    const row: number[] = [];
    for (let v = 0; v < nVert; v += 1) {
      const raw = parseNumber(tokens[t++]!);
      row.push((Number.isFinite(raw) ? raw : 0) * cm * bf);
    }
    intensities.push(row);
  }

  if (photometryType !== 1) {
    warnings.push(`Photometry type ${photometryType} — treating as Type C`);
  }

  const luminousFlux =
    Number.isFinite(lumensPerLamp) && lumensPerLamp > 0 && Number.isFinite(lampCount)
      ? lumensPerLamp * lampCount
      : null;

  const data: PhotometricData = {
    format: "ies",
    manufacturer,
    catalogNumber,
    description: description || catalogNumber || "Imported IES luminaire",
    luminousFlux,
    watts: Number.isFinite(inputWatts) && inputWatts > 0 ? inputWatts : null,
    lampCount: Number.isFinite(lampCount) ? lampCount : 1,
    ballastFactor: bf,
    verticalAngles,
    horizontalAngles,
    intensities,
    symmetry: nHoriz <= 2 ? "axial" : "none",
    photometryType: Number.isFinite(photometryType) ? photometryType : 1,
    openingWidthM,
    openingLengthM,
    openingHeightM,
    cctK,
    cri,
    catalogFluxLm,
  };

  return { data, warnings };
}
