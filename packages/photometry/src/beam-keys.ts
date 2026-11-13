/** Circular library-cone beam keys, in degrees. */
export const CIRCULAR_BEAM_DEGREES = [
  8, 10, 12, 15, 20, 24, 30, 36, 40, 45, 50, 60, 80, 90, 100, 110, 120, 140, 160, 180,
] as const;

export type CircularBeamDegrees = (typeof CIRCULAR_BEAM_DEGREES)[number];

export const LINEAR_BEAM_DEGREES = [
  10, 12, 15, 20, 24, 30, 36, 40, 45, 50, 60, 80, 90, 120, 140, 160, 180,
] as const;

export type LinearBeamDegrees = (typeof LINEAR_BEAM_DEGREES)[number];

export const PHOTOMETRIC_FAMILIES = ["circular", "linear"] as const;
export type PhotometricFamily = (typeof PHOTOMETRIC_FAMILIES)[number];

export function isPhotometricFamily(value: string): value is PhotometricFamily {
  return (PHOTOMETRIC_FAMILIES as readonly string[]).includes(value);
}

export function libraryBeamsForFamily(family: PhotometricFamily): readonly number[] {
  return family === "linear" ? LINEAR_BEAM_DEGREES : CIRCULAR_BEAM_DEGREES;
}

export function isLibraryBeamDegrees(family: PhotometricFamily, value: number): boolean {
  return (libraryBeamsForFamily(family) as readonly number[]).includes(value);
}

export function defaultLibraryBeam(family: PhotometricFamily): number {
  return family === "linear" ? 120 : 24;
}

/** First numeric token in a free-text field (`1800 lm` → 1800). */
export function parseFirstNumber(input: string | null | undefined): number | null {
  if (input == null) return null;
  const m = String(input).match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number.parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

export type ParsedBeamAngle = {
  degrees: number | null;
  isDual: boolean;
  raw: string;
};

/**
 * Parse a beam-angle hint. Dual values such as `15/24` or `15°+24°` set isDual.
 * The first number is still used for nearest-key recommendation.
 */
export function parseBeamAngle(input: string | null | undefined): ParsedBeamAngle {
  const raw = input == null ? "" : String(input).trim();
  if (!raw) return { degrees: null, isDual: false, raw };

  const numbers = [...raw.matchAll(/-?\d+(?:\.\d+)?/g)]
    .map((m) => Number.parseFloat(m[0]))
    .filter((n) => Number.isFinite(n));

  const isDual =
    numbers.length >= 2 && /[/+&]|x|×/i.test(raw.replace(/^\s*[øØφΦ]|dia(?:meter)?/i, ""));

  return {
    degrees: numbers.length > 0 ? numbers[0]! : null,
    isDual,
    raw,
  };
}

export function nearestBeamInKeys<T extends number>(degrees: number, keys: readonly T[]): T {
  let best = keys[0]!;
  let bestDist = Math.abs(degrees - best);
  for (const key of keys) {
    const d = Math.abs(degrees - key);
    if (d < bestDist) {
      best = key;
      bestDist = d;
    }
  }
  return best;
}

export function nearestCircularBeam(degrees: number): CircularBeamDegrees {
  return nearestBeamInKeys(degrees, CIRCULAR_BEAM_DEGREES);
}

export function nearestLinearBeam(degrees: number): LinearBeamDegrees {
  return nearestBeamInKeys(degrees, LINEAR_BEAM_DEGREES);
}

export function nearestLibraryBeam(family: PhotometricFamily, degrees: number): number {
  return nearestBeamInKeys(degrees, libraryBeamsForFamily(family));
}

export type BeamRecommendKind = "exact" | "nearest" | "dual" | "empty";

export type BeamRecommendation = {
  beamDegrees: number;
  kind: BeamRecommendKind;
  parsedDegrees: number | null;
  message: string;
};

export function recommendLibraryBeam(
  input: string | null | undefined,
  family: PhotometricFamily
): BeamRecommendation {
  const keys = libraryBeamsForFamily(family);
  const emptyDefault = defaultLibraryBeam(family);
  const parsed = parseBeamAngle(input);
  if (parsed.degrees == null) {
    return {
      beamDegrees: emptyDefault,
      kind: "empty",
      parsedDegrees: null,
      message: `No beam hint — default ${emptyDefault}°.`,
    };
  }

  const nearest = nearestBeamInKeys(parsed.degrees, keys);
  if (parsed.isDual) {
    return {
      beamDegrees: nearest,
      kind: "dual",
      parsedDegrees: parsed.degrees,
      message: `Beam hint is ${parsed.raw} — suggested ${nearest}°.`,
    };
  }
  if (Math.abs(nearest - parsed.degrees) < 0.01) {
    return {
      beamDegrees: nearest,
      kind: "exact",
      parsedDegrees: parsed.degrees,
      message: `Recommended: ${nearest}°.`,
    };
  }
  return {
    beamDegrees: nearest,
    kind: "nearest",
    parsedDegrees: parsed.degrees,
    message: `Nearest to ${parsed.degrees}°: ${nearest}°.`,
  };
}

const LINEAR_HINT = /strip|tape|linear|batten|profile|extrusion|flex|ribbon|led\s*bar|led\s*tape/i;

export type FamilyRecommendInput = {
  name?: string | null;
  size?: string | null;
};

export function recommendPhotometricFamily(input: FamilyRecommendInput): {
  family: PhotometricFamily;
  message: string;
} {
  const blob = input.name ?? "";
  if (LINEAR_HINT.test(blob)) {
    return {
      family: "linear",
      message: "Name looks like a linear / LED strip.",
    };
  }
  const size = (input.size ?? "").toLowerCase();
  const nums = [...size.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number.parseFloat(m[0]));
  const labeled = /(?:l|length)\s*[=:]?\s*(-?\d+)/i.exec(input.size ?? "");
  const widthM = /(?:w|width)\s*[=:]?\s*(-?\d+)/i.exec(input.size ?? "");
  if (labeled && widthM) {
    const length = Number.parseFloat(labeled[1]!);
    const width = Number.parseFloat(widthM[1]!);
    if (width > 0 && length >= width * 2) {
      return { family: "linear", message: "Size is a long rectangle — suggested linear / LED strip." };
    }
  } else if (nums.length >= 2 && !/(?:dia|ø|Ø|φ|Φ|∅)/i.test(input.size ?? "")) {
    const length = nums[0]!;
    const width = nums[1]!;
    if (width > 0 && length >= width * 2) {
      return { family: "linear", message: "Size is a long rectangle — suggested linear / LED strip." };
    }
  }
  return {
    family: "circular",
    message: "Suggested circular cone (spotlight / downlight).",
  };
}
