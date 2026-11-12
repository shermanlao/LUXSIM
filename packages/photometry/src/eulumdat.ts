/**
 * EULUMDAT (.ldt) document model, writer, and structural parser.
 * Intensities in this document are stored in cd/klm (candela per 1000 lumens).
 */

export type EulumdatLampSet = {
  lampCount: number;
  lampType: string;
  flux: number;
  colorTemperature: string;
  cri: string;
  wattage: number;
};

export type EulumdatDocument = {
  company: string;
  ityp: number;
  isym: number;
  mc: number;
  dc: number;
  ng: number;
  dg: number;
  report: string;
  luminaireName: string;
  luminaireNumber: string;
  fileName: string;
  dateUser: string;
  luminaireLength: number;
  luminaireWidth: number;
  luminaireHeight: number;
  luminousLength: number;
  luminousWidth: number;
  luminousHeightC0: number;
  luminousHeightC90: number;
  luminousHeightC180: number;
  luminousHeightC270: number;
  dff: number;
  lorl: number;
  conversion: number;
  tilt: number;
  lamps: EulumdatLampSet[];
  /** Ten direct-ratio values for room indices k = 0.6…5 (zeros are valid). */
  directRatios: number[];
  cAngles: number[];
  gammaAngles: number[];
  /** intensities[cIndex][gIndex] in cd/klm — only the planes stored for Isym */
  intensities: number[][];
};

export function storedIntensityPlaneCount(isym: number, mc: number): number {
  switch (isym) {
    case 0:
      return mc;
    case 1:
      return 1;
    case 2:
    case 3:
      return Math.floor(mc / 2) + 1;
    case 4:
      return Math.floor(mc / 4) + 1;
    default:
      return mc;
  }
}

export function emptyDirectRatios(): number[] {
  return Array.from({ length: 10 }, () => 0);
}

function toNumber(raw: string, label: string): number {
  const n = Number(String(raw).trim().replace(",", "."));
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid LDT number for ${label}`);
  }
  return n;
}

function toInt(raw: string, label: string): number {
  return Math.round(toNumber(raw, label));
}

export function formatLdtNumber(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Number.isInteger(n)) return String(n);
  const rounded = Math.round(n * 1000) / 1000;
  return String(rounded);
}

/**
 * Parse EULUMDAT text. Accepts one value per line (LUXSIM templates)
 * or whitespace-packed angle and intensity blocks (common factory files).
 */
export function parseEulumdat(text: string): EulumdatDocument {
  const lines = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");
  if (lines.length < 32) {
    throw new Error("LDT file too short");
  }

  const company = (lines[0] ?? "").trim();
  const ityp = toInt(lines[1] ?? "", "Ityp");
  const isym = toInt(lines[2] ?? "", "Isym");
  const mc = toInt(lines[3] ?? "", "Mc");
  const dc = toNumber(lines[4] ?? "", "Dc");
  const ng = toInt(lines[5] ?? "", "Ng");
  const dg = toNumber(lines[6] ?? "", "Dg");
  if (mc < 1 || mc > 360 || ng < 2 || ng > 400) {
    throw new Error("Invalid LDT angle counts");
  }

  const nSets = toInt(lines[25] ?? "", "lamp sets");
  if (nSets < 1 || nSets > 8) {
    throw new Error("LDT lamp-set count is out of range");
  }

  const lamps: EulumdatLampSet[] = [];
  let cursor = 26;
  for (let i = 0; i < nSets; i += 1) {
    lamps.push({
      lampCount: toInt(lines[cursor] ?? "", "lamp count"),
      lampType: (lines[cursor + 1] ?? "").trim() || "LED",
      flux: toNumber(lines[cursor + 2] ?? "", "lamp flux"),
      colorTemperature: (lines[cursor + 3] ?? "").trim(),
      cri: (lines[cursor + 4] ?? "").trim(),
      wattage: toNumber(lines[cursor + 5] ?? "", "wattage"),
    });
    cursor += 6;
  }

  const rest = lines
    .slice(cursor)
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => toNumber(tok.replace(",", "."), "photometric table"));

  const planeCount = storedIntensityPlaneCount(isym, mc);
  const needed = 10 + mc + ng + planeCount * ng;
  if (rest.length < needed) {
    throw new Error("LDT intensity table is incomplete");
  }

  const directRatios = rest.slice(0, 10);
  const cAngles = rest.slice(10, 10 + mc);
  const gammaAngles = rest.slice(10 + mc, 10 + mc + ng);
  const intensityFlat = rest.slice(10 + mc + ng, needed);
  const intensities: number[][] = [];
  for (let c = 0; c < planeCount; c += 1) {
    intensities.push(intensityFlat.slice(c * ng, (c + 1) * ng));
  }

  return {
    company,
    ityp,
    isym,
    mc,
    dc,
    ng,
    dg,
    report: (lines[7] ?? "").trim(),
    luminaireName: (lines[8] ?? "").trim(),
    luminaireNumber: (lines[9] ?? "").trim(),
    fileName: (lines[10] ?? "").trim(),
    dateUser: (lines[11] ?? "").trim(),
    luminaireLength: toNumber(lines[12] ?? "0", "luminaire length"),
    luminaireWidth: toNumber(lines[13] ?? "0", "luminaire width"),
    luminaireHeight: toNumber(lines[14] ?? "0", "luminaire height"),
    luminousLength: toNumber(lines[15] ?? "0", "luminous length"),
    luminousWidth: toNumber(lines[16] ?? "0", "luminous width"),
    luminousHeightC0: toNumber(lines[17] ?? "0", "luminous C0"),
    luminousHeightC90: toNumber(lines[18] ?? "0", "luminous C90"),
    luminousHeightC180: toNumber(lines[19] ?? "0", "luminous C180"),
    luminousHeightC270: toNumber(lines[20] ?? "0", "luminous C270"),
    dff: toNumber(lines[21] ?? "100", "DFF"),
    lorl: toNumber(lines[22] ?? "100", "LORL"),
    conversion: toNumber(lines[23] ?? "1", "conversion"),
    tilt: toNumber(lines[24] ?? "0", "tilt"),
    lamps,
    directRatios,
    cAngles,
    gammaAngles,
    intensities,
  };
}

export function writeEulumdat(doc: EulumdatDocument): string {
  const planeCount = storedIntensityPlaneCount(doc.isym, doc.mc);
  if (doc.cAngles.length !== doc.mc) {
    throw new Error(`LDT C-angle count ${doc.cAngles.length} does not match Mc ${doc.mc}`);
  }
  if (doc.gammaAngles.length !== doc.ng) {
    throw new Error(`LDT gamma count ${doc.gammaAngles.length} does not match Ng ${doc.ng}`);
  }
  if (doc.intensities.length !== planeCount) {
    throw new Error(
      `LDT intensity planes ${doc.intensities.length} do not match Isym=${doc.isym} expectation ${planeCount}`
    );
  }
  for (const row of doc.intensities) {
    if (row.length !== doc.ng) {
      throw new Error("LDT intensity row length does not match Ng");
    }
  }

  const ratios =
    doc.directRatios.length === 10
      ? doc.directRatios
      : [...doc.directRatios, ...emptyDirectRatios()].slice(0, 10);

  const out: string[] = [
    doc.company,
    formatLdtNumber(doc.ityp),
    formatLdtNumber(doc.isym),
    formatLdtNumber(doc.mc),
    formatLdtNumber(doc.dc),
    formatLdtNumber(doc.ng),
    formatLdtNumber(doc.dg),
    doc.report,
    doc.luminaireName,
    doc.luminaireNumber,
    doc.fileName,
    doc.dateUser,
    formatLdtNumber(doc.luminaireLength),
    formatLdtNumber(doc.luminaireWidth),
    formatLdtNumber(doc.luminaireHeight),
    formatLdtNumber(doc.luminousLength),
    formatLdtNumber(doc.luminousWidth),
    formatLdtNumber(doc.luminousHeightC0),
    formatLdtNumber(doc.luminousHeightC90),
    formatLdtNumber(doc.luminousHeightC180),
    formatLdtNumber(doc.luminousHeightC270),
    formatLdtNumber(doc.dff),
    formatLdtNumber(doc.lorl),
    formatLdtNumber(doc.conversion),
    formatLdtNumber(doc.tilt),
    formatLdtNumber(doc.lamps.length),
  ];

  for (const lamp of doc.lamps) {
    out.push(
      formatLdtNumber(lamp.lampCount),
      lamp.lampType,
      formatLdtNumber(lamp.flux),
      lamp.colorTemperature,
      lamp.cri,
      formatLdtNumber(lamp.wattage)
    );
  }

  for (const r of ratios) out.push(formatLdtNumber(r));
  for (const a of doc.cAngles) out.push(formatLdtNumber(a));
  for (const a of doc.gammaAngles) out.push(formatLdtNumber(a));
  for (const row of doc.intensities) {
    for (const v of row) out.push(formatLdtNumber(v));
  }

  return `${out.join("\n")}\n`;
}

export function isValidEulumdatText(text: string): boolean {
  try {
    parseEulumdat(text);
    return true;
  } catch {
    return false;
  }
}
