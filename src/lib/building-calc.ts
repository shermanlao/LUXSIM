/** User-facing status after a multi-room client calculation. */
export function formatCalcCompletionMessage(opts: {
  roomsCalculated: number;
  instanceCount: number;
}): string | null {
  if (opts.roomsCalculated <= 0) return null;
  if (opts.instanceCount === 0) {
    const n = opts.roomsCalculated;
    return `Calculation complete — 0 lx workplane (${n} room${n === 1 ? "" : "s"}, no luminaires placed)`;
  }
  return "Calculation complete (client-side)";
}
