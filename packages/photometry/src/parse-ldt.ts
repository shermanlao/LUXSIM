import type { ParseResult, PhotometricData } from "./types";

function parseNumber(token: string): number {
  const n = Number(String(token).trim().replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Minimal EULUMDAT (.ldt) parser for common indoor luminaires.
 */
export function parseLdt(text: string): ParseResult {
  const warnings: string[] = [];
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trimEnd());

  if (lines.length < 30) {
    throw new Error("LDT file too short");
  }

  const manufacturer = (lines[0] ?? "").trim();
  const typeIndicator = Math.round(parseNumber(lines[1] ?? "0"));
  const symmetry = Math.round(parseNumber(lines[2] ?? "0"));
  const nMc = Math.round(parseNumber(lines[3] ?? "0")); // number of C-planes
  const mcDistance = parseNumber(lines[4] ?? "0");
  const nDc = Math.round(parseNumber(lines[5] ?? "0")); // number of gamma angles
  const dcDistance = parseNumber(lines[6] ?? "0");
  void mcDistance;
  void dcDistance;

  // lines 7–12: measurement report / name / etc. — skip rigid layout details
  const luminaireName = (lines[8] ?? "").trim() || (lines[9] ?? "").trim();
  const lampName = (lines[13] ?? "").trim();

  const numberOfLamps = Math.abs(Math.round(parseNumber(lines[21] ?? "1")));
  const lumensPerLamp = parseNumber(lines[22] ?? "0");
  const lightOutputRatio = parseNumber(lines[23] ?? "1");
  const wattage = parseNumber(lines[28] ?? "0");

  if (nMc < 1 || nDc < 1) {
    throw new Error("Invalid LDT angle counts");
  }

  let idx = 42; // after fixed header blocks in classic EULUMDAT
  // Some files place angles earlier; locate first angle block by scanning near expected zone
  // Spec: after line 42 come nMc C-plane angles, then nDc gamma angles, then intensities.

  // Try standard layout starting at line index 42 (1-based line 43)
  if (lines.length < idx + nMc + nDc) {
    // Fallback: search for a run of numbers after wattage line
    idx = 29;
    while (idx < lines.length && !Number.isFinite(parseNumber(lines[idx] ?? ""))) {
      idx += 1;
    }
  }

  const horizontalAngles: number[] = [];
  for (let h = 0; h < nMc; h += 1) {
    horizontalAngles.push(parseNumber(lines[idx++] ?? "0"));
  }
  const verticalAngles: number[] = [];
  for (let v = 0; v < nDc; v += 1) {
    verticalAngles.push(parseNumber(lines[idx++] ?? "0"));
  }

  // Skip luminous intensity ratios / direct ratios block if present (nMc values)
  // In many files, after angles come candela values directly when lOR block is omitted.
  // Classic: there are nMc "luminous intensity ratios" then candelas.
  // Heuristic: if next nMc values look like ratios (0–1-ish) skip them.
  const maybeRatios: number[] = [];
  let peek = idx;
  for (let h = 0; h < nMc && peek < lines.length; h += 1) {
    maybeRatios.push(parseNumber(lines[peek++] ?? "0"));
  }
  const lookLikeRatios =
    maybeRatios.length === nMc &&
    maybeRatios.every((r) => Number.isFinite(r) && r >= 0 && r <= 10);
  if (lookLikeRatios && lines.length - peek >= nMc * nDc) {
    idx = peek;
  }

  const lor = Number.isFinite(lightOutputRatio) && lightOutputRatio > 0 ? lightOutputRatio : 1;
  const intensities: number[][] = [];
  for (let h = 0; h < nMc; h += 1) {
    const row: number[] = [];
    for (let v = 0; v < nDc; v += 1) {
      const raw = parseNumber(lines[idx++] ?? "0");
      // EULUMDAT intensities are often cd/1000lm — convert to absolute cd if flux known
      row.push(Number.isFinite(raw) ? raw : 0);
    }
    intensities.push(row);
  }

  const flux =
    Number.isFinite(lumensPerLamp) && lumensPerLamp > 0
      ? lumensPerLamp * (numberOfLamps || 1) * lor
      : null;

  if (flux && flux > 0) {
    // Values stored as cd/klm → absolute cd
    for (let h = 0; h < intensities.length; h += 1) {
      for (let v = 0; v < intensities[h]!.length; v += 1) {
        intensities[h]![v] = (intensities[h]![v]! * flux) / 1000;
      }
    }
  } else {
    warnings.push("LDT luminous flux unknown; using raw intensity table units");
  }

  if (typeIndicator !== 1 && typeIndicator !== 2) {
    warnings.push(`LDT type indicator ${typeIndicator}`);
  }

  let symmetryLabel: PhotometricData["symmetry"] = "none";
  if (symmetry === 1) symmetryLabel = "axial";
  else if (symmetry === 2 || symmetry === 3) symmetryLabel = "bilateral";
  else if (symmetry === 4) symmetryLabel = "quad";

  const data: PhotometricData = {
    format: "ldt",
    manufacturer,
    catalogNumber: lampName,
    description: luminaireName || manufacturer || "Imported LDT luminaire",
    luminousFlux: flux,
    watts: Number.isFinite(wattage) && wattage > 0 ? wattage : null,
    lampCount: numberOfLamps || 1,
    ballastFactor: 1,
    verticalAngles,
    horizontalAngles,
    intensities,
    symmetry: symmetryLabel,
  };

  return { data, warnings };
}
