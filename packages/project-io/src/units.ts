/** Internal scene units are metres. Draw UI uses millimetres. */

export function mmToM(mm: number): number {
  return mm / 1000;
}

export function mToMm(m: number): number {
  return m * 1000;
}

/**
 * Parse a typed length. Bare number = millimetres.
 * Accepts suffixes `mm`, `cm`, `m` (case-insensitive).
 */
export function parseLengthToM(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return null;
  const match = s.match(/^([+-]?(?:\d+\.?\d*|\.\d+))(mm|cm|m)?$/);
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n) || n < 0) return null;
  const unit = match[2] ?? "mm";
  if (unit === "m") return n;
  if (unit === "cm") return n / 100;
  return n / 1000;
}
