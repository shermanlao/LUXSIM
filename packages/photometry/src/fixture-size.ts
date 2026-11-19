import { parseFirstNumber } from "./beam-keys";

export type FixtureSizeMm = {
  length: number;
  width: number;
  height: number;
  circular: boolean;
};

const SEP = "(?:^|[^a-zA-Z]|[x×*])";
const LABEL_L = new RegExp(`${SEP}(?:l|length|len)(?![a-z])\\s*[=:]?\\s*(-?\\d+(?:\\.\\d+)?)`, "i");
const LABEL_W = new RegExp(`${SEP}(?:w|width|wid)(?![a-z])\\s*[=:]?\\s*(-?\\d+(?:\\.\\d+)?)`, "i");
const LABEL_H = new RegExp(`${SEP}(?:h|height|ht)(?![a-z])\\s*[=:]?\\s*(-?\\d+(?:\\.\\d+)?)`, "i");
const DIA = /(?:dia(?:meter)?|ø|Ø|φ|Φ|∅)\s*[=:]?\s*(-?\d+(?:\.\d+)?)/i;

function labeledNumber(re: RegExp, input: string): number | null {
  const m = input.match(re);
  if (!m) return null;
  const n = Number.parseFloat(m[1]!);
  return Number.isFinite(n) ? n : null;
}

function unlabeledNumbers(input: string): number[] {
  return [...input.matchAll(/-?\d+(?:\.\d+)?/g)]
    .map((m) => Number.parseFloat(m[0]))
    .filter((n) => Number.isFinite(n));
}

/**
 * Parse a fixture / emission size string into EULUMDAT millimetres.
 * Circular forms (`Dia90 x H70`, `Ø75×H55`) use length = diameter and width = 0.
 */
export function parseFixtureSizeMm(input: string | null | undefined): FixtureSizeMm | null {
  const raw = input == null ? "" : String(input).trim();
  if (!raw) return null;

  const dia = labeledNumber(DIA, raw);
  const labeledL = labeledNumber(LABEL_L, raw);
  const labeledW = labeledNumber(LABEL_W, raw);
  const labeledH = labeledNumber(LABEL_H, raw);
  const nums = unlabeledNumbers(raw);

  if (dia != null) {
    return {
      length: dia,
      width: 0,
      height: labeledH ?? (nums.length >= 2 ? nums[nums.length - 1]! : 0),
      circular: true,
    };
  }

  if (labeledL != null || labeledW != null) {
    const length = labeledL ?? parseFirstNumber(raw) ?? 0;
    const width = labeledW ?? 0;
    const height = labeledH ?? 0;
    if (length <= 0 && width <= 0 && height <= 0) return null;
    return { length, width, height, circular: width === 0 };
  }

  if (nums.length >= 3) {
    return { length: nums[0]!, width: nums[1]!, height: nums[2]!, circular: false };
  }
  if (nums.length === 2) {
    return { length: nums[0]!, width: 0, height: nums[1]!, circular: true };
  }
  if (nums.length === 1) {
    return { length: nums[0]!, width: 0, height: 0, circular: true };
  }
  return null;
}

export function formatFixtureSizeMm(size: FixtureSizeMm): string {
  const fmt = (n: number) => String(n);
  if (size.circular || size.width === 0) {
    const h = size.height > 0 ? ` × H${fmt(size.height)}` : "";
    return `Ø${fmt(size.length)}${h} mm`;
  }
  const h = size.height > 0 ? ` × H${fmt(size.height)}` : "";
  return `L${fmt(size.length)} × W${fmt(size.width)}${h} mm`;
}
