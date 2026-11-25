/**
 * Small node check (not a vitest suite): official palette t / RGB for the
 * t290 colour-anchor example. Run: npx tsx scripts/check-false-color-anchors.ts
 */
import {
  luxToRgb,
  officialPaletteTForLux,
  normalizeFalseColorMapping,
} from "../packages/project-io/src/isolux-map";

const scale = normalizeFalseColorMapping({
  minLux: 0,
  maxLux: 2500,
  tMin: 0,
  tMax: 7 / 8,
  winMin: 0,
  winMax: 500,
});

function hex(rgb: [number, number, number]): string {
  return `#${rgb
    .map((c) => Math.round(c * 255)
      .toString(16)
      .padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

const expected: { lux: number; t: number; hex: string }[] = [
  { lux: 0, t: 0, hex: "#000000" },
  { lux: 250, t: 0.4375, hex: "#03FE80" },
  { lux: 500, t: 0.875, hex: "#FF0001" },
  { lux: 1000, t: 1, hex: "#FFFFFF" },
];

let failed = 0;
for (const row of expected) {
  const t = officialPaletteTForLux(row.lux, scale);
  const colour = hex(luxToRgb(row.lux, scale));
  const ok = Math.abs(t - row.t) < 1e-9 && colour === row.hex;
  const mark = ok ? "ok" : "FAIL";
  console.log(`${mark}  ${row.lux} lx  t=${t}  ${colour}  (expected t=${row.t} ${row.hex})`);
  if (!ok) failed += 1;
}

if (colourIsWhiteAt500()) {
  console.error("FAIL  500 lx must be official red, not white");
  failed += 1;
}

function colourIsWhiteAt500(): boolean {
  return hex(luxToRgb(500, scale)) === "#FFFFFF";
}

if (failed) {
  process.exit(1);
}
console.log("false-color anchor check passed");
