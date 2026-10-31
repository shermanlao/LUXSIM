import { estimateFlux, totalDirectIlluminance } from "./direct";
import { interreflectedWorkplaneBoost } from "./interreflect";
import { computeUgr } from "./ugr";
import type { CalcOptions, CalcResults } from "./types";

const DISCLAIMER =
  "LUXSIM design-assist results. Not tender-certified. Verify critical projects in software such as DIALux.";

export function calculate(options: CalcOptions): CalcResults {
  const { room, luminaires, grid } = options;
  const spacing = Math.max(0.25, Math.min(2, grid.spacing || 0.5));
  const z = Math.min(room.workplaneHeight, room.height - 0.05);
  const margin = spacing / 2;

  const xs: number[] = [];
  const ys: number[] = [];
  for (let x = margin; x < room.width - 1e-9; x += spacing) xs.push(x);
  for (let y = margin; y < room.depth - 1e-9; y += spacing) ys.push(y);
  if (xs.length === 0) xs.push(room.width / 2);
  if (ys.length === 0) ys.push(room.depth / 2);

  const nx = xs.length;
  const ny = ys.length;
  const normal = { x: 0, y: 0, z: 1 };
  const direct: number[] = new Array(nx * ny);

  let sum = 0;
  let emin = Infinity;
  let emax = -Infinity;

  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const p = { x: xs[i]!, y: ys[j]!, z };
      const e = totalDirectIlluminance(p, normal, luminaires);
      const idx = j * nx + i;
      direct[idx] = e;
      sum += e;
      emin = Math.min(emin, e);
      emax = Math.max(emax, e);
    }
  }

  const eDirectMean = sum / (nx * ny);
  let indirect = 0;
  if (options.interreflection) {
    indirect = interreflectedWorkplaneBoost(room, eDirectMean, options.bounces ?? 2);
  }

  const lux = direct.map((e) => e + indirect);
  sum = 0;
  emin = Infinity;
  emax = -Infinity;
  for (const e of lux) {
    sum += e;
    emin = Math.min(emin, e);
    emax = Math.max(emax, e);
  }
  const eave = sum / lux.length;
  const uo = eave > 1e-6 ? emin / eave : 0;

  let totalWatts = 0;
  for (const lum of luminaires) {
    const w = lum.watts ?? lum.photometry.watts;
    if (w && w > 0) totalWatts += w;
  }
  const areaM2 = room.width * room.depth;
  const lpd = totalWatts > 0 ? totalWatts / areaM2 : null;

  let ugr: number | null = null;
  let ugrObservers: CalcResults["ugrObservers"];
  if (options.computeUgr) {
    const ugrResult = computeUgr(room, luminaires, eave);
    ugr = ugrResult.ugr;
    ugrObservers = ugrResult.observers;
  }

  // Touch estimateFlux so unused import lint stays clean / available for future LPD from flux
  void estimateFlux;

  return {
    version: 1,
    grid: {
      originX: xs[0]!,
      originY: ys[0]!,
      spacing,
      nx,
      ny,
      z,
      lux,
    },
    summary: {
      eave,
      emin: Number.isFinite(emin) ? emin : 0,
      emax: Number.isFinite(emax) ? emax : 0,
      uo,
      ugr,
      lpd,
      totalWatts,
      areaM2,
    },
    ugrObservers,
    meta: {
      interreflection: Boolean(options.interreflection),
      bounces: options.bounces ?? 0,
      calculatedAt: new Date().toISOString(),
      disclaimer: DISCLAIMER,
    },
  };
}
