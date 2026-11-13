/**
 * CIE 97–style maintenance factor breakdown (assist / planning only).
 * MF = LLMF × LSF × LMF × RSMF, then clamped to [0.5, 1.0].
 */

export interface MfBreakdown {
  /** Lamp lumen maintenance factor */
  llmf: number;
  /** Luminaire surface maintenance (dirt on optics) */
  lsf: number;
  /** Lamp survival / operational factor */
  lmf: number;
  /** Room surface maintenance (dirt on walls/ceiling) */
  rsmf: number;
}

/** Typical indoor office-style product ≈ 0.81 (not a standard mandate). */
export const DEFAULT_MF_BREAKDOWN: MfBreakdown = {
  llmf: 0.89,
  lsf: 0.96,
  lmf: 0.96,
  rsmf: 0.97,
};

export function defaultMaintenanceFactor(): number {
  return productMf(DEFAULT_MF_BREAKDOWN);
}

export function clampMfComponent(value: number | undefined | null): number {
  if (value == null || !Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0.5, value));
}

export function clampMf(value: number | undefined | null): number {
  if (value == null || !Number.isFinite(value)) return defaultMaintenanceFactor();
  return Math.min(1, Math.max(0.5, value));
}

export function productMf(b: MfBreakdown): number {
  return clampMf(b.llmf * b.lsf * b.lmf * b.rsmf);
}

export function normalizeMfBreakdown(
  partial?: Partial<MfBreakdown> | null
): MfBreakdown {
  const d = DEFAULT_MF_BREAKDOWN;
  return {
    llmf: clampMfComponent(partial?.llmf ?? d.llmf),
    lsf: clampMfComponent(partial?.lsf ?? d.lsf),
    lmf: clampMfComponent(partial?.lmf ?? d.lmf),
    rsmf: clampMfComponent(partial?.rsmf ?? d.rsmf),
  };
}

/**
 * Prefer explicit breakdown when any component is stored on the room;
 * otherwise use overall maintenanceFactor or default product.
 */
export function resolveMaintenanceFactor(opts: {
  maintenanceFactor?: number | null;
  mfBreakdown?: Partial<MfBreakdown> | null;
  useBreakdown?: boolean;
}): { mf: number; breakdown: MfBreakdown; source: "breakdown" | "overall" | "default" } {
  const hasBreakdown =
    opts.useBreakdown !== false &&
    opts.mfBreakdown != null &&
    (opts.mfBreakdown.llmf != null ||
      opts.mfBreakdown.lsf != null ||
      opts.mfBreakdown.lmf != null ||
      opts.mfBreakdown.rsmf != null);

  if (hasBreakdown) {
    const breakdown = normalizeMfBreakdown(opts.mfBreakdown);
    return { mf: productMf(breakdown), breakdown, source: "breakdown" };
  }
  if (opts.maintenanceFactor != null && Number.isFinite(opts.maintenanceFactor)) {
    const mf = clampMf(opts.maintenanceFactor);
    return { mf, breakdown: DEFAULT_MF_BREAKDOWN, source: "overall" };
  }
  const breakdown = DEFAULT_MF_BREAKDOWN;
  return { mf: productMf(breakdown), breakdown, source: "default" };
}
