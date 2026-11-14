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

export type MfSource = "breakdown" | "overall" | "default";

export type MfResolution = {
  mf: number;
  /**
   * Active CIE 97 components when they (or the built-in default product) are
   * the source of MF. Absent when an overall value is in force, so callers must
   * not present DEFAULT_MF_BREAKDOWN as if it were still applied.
   */
  breakdown: MfBreakdown | undefined;
  source: MfSource;
};

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

/** True when stored components are the active CIE 97 breakdown. */
export function hasActiveMfBreakdown(
  partial?: Partial<MfBreakdown> | null,
  useBreakdown = true
): boolean {
  return (
    useBreakdown !== false &&
    partial != null &&
    (partial.llmf != null ||
      partial.lsf != null ||
      partial.lmf != null ||
      partial.rsmf != null)
  );
}

/**
 * Prefer explicit breakdown when any component is stored on the room;
 * otherwise use overall maintenanceFactor or default product.
 */
export function resolveMaintenanceFactor(opts: {
  maintenanceFactor?: number | null;
  mfBreakdown?: Partial<MfBreakdown> | null;
  useBreakdown?: boolean;
}): MfResolution {
  if (hasActiveMfBreakdown(opts.mfBreakdown, opts.useBreakdown)) {
    const breakdown = normalizeMfBreakdown(opts.mfBreakdown);
    return { mf: productMf(breakdown), breakdown, source: "breakdown" };
  }
  if (opts.maintenanceFactor != null && Number.isFinite(opts.maintenanceFactor)) {
    return {
      mf: clampMf(opts.maintenanceFactor),
      breakdown: undefined,
      source: "overall",
    };
  }
  return {
    mf: productMf(DEFAULT_MF_BREAKDOWN),
    breakdown: DEFAULT_MF_BREAKDOWN,
    source: "default",
  };
}

/**
 * Component values the property panel may show as the active CIE 97 breakdown.
 * Undefined when overall MF is in force, so stale defaults are not presented.
 */
export function presentMfBreakdown(opts: {
  maintenanceFactor?: number | null;
  mfBreakdown?: Partial<MfBreakdown> | null;
  useBreakdown?: boolean;
}): MfBreakdown | undefined {
  const resolved = resolveMaintenanceFactor(opts);
  return resolved.source === "overall" ? undefined : resolved.breakdown;
}

type CalcMfFields = {
  maintenanceFactor?: number;
  mfBreakdown?: Partial<MfBreakdown>;
};

/** Official property-panel write: set overall MF and clear the stored breakdown. */
export function applyOverallMaintenanceFactor<T extends CalcMfFields>(
  calc: T,
  value: number
): T {
  return {
    ...calc,
    maintenanceFactor: clampMf(value),
    mfBreakdown: undefined,
  };
}

/**
 * Official property-panel write: editing any component rebuilds the breakdown
 * (defaults fill unspecified parts) and sets the product as overall MF.
 */
export function applyMfComponentEdit<T extends CalcMfFields>(
  calc: T,
  key: keyof MfBreakdown,
  value: number
): T {
  const nextBd = normalizeMfBreakdown({
    ...calc.mfBreakdown,
    [key]: value,
  });
  const resolved = resolveMaintenanceFactor({
    mfBreakdown: nextBd,
    useBreakdown: true,
  });
  return {
    ...calc,
    mfBreakdown: nextBd,
    maintenanceFactor: resolved.mf,
  };
}
