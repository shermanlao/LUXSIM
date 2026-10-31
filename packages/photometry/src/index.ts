export type { PhotometricData, ParseResult, SourceFormat } from "./types";
export { parseIes } from "./parse-ies";
export { parseLdt } from "./parse-ldt";
export { sampleIntensityCd, polarPreview } from "./interpolate";

import { parseIes } from "./parse-ies";
import { parseLdt } from "./parse-ldt";
import type { ParseResult, SourceFormat } from "./types";

export function parsePhotometricFile(
  text: string,
  format: SourceFormat
): ParseResult {
  if (format === "ies") return parseIes(text);
  return parseLdt(text);
}

export function detectFormat(filename: string): SourceFormat | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".ies")) return "ies";
  if (lower.endsWith(".ldt")) return "ldt";
  return null;
}
