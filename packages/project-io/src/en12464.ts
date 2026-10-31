import type { CalcResults } from "../../solver/src/types";

/** Assist-only EN 12464-1 style targets (maintained illuminance, lx). Not certification. */
export interface En12464Template {
  id: string;
  label: string;
  /** Maintained average illuminance Ēm (lx) */
  em: number;
  /** Minimum uniformity Uo (Emin/Ēm) */
  uo: number;
  /** Maximum UGR (null = not evaluated) */
  ugrMax: number | null;
}

export const EN12464_TEMPLATES: En12464Template[] = [
  { id: "", label: "None (no target)", em: 0, uo: 0, ugrMax: null },
  { id: "office", label: "Office — general (500 lx)", em: 500, uo: 0.6, ugrMax: 19 },
  { id: "corridor", label: "Circulation / corridor (100 lx)", em: 100, uo: 0.4, ugrMax: 25 },
  { id: "classroom", label: "Education — classroom (300 lx)", em: 300, uo: 0.6, ugrMax: 19 },
  { id: "warehouse", label: "Storage / warehouse (200 lx)", em: 200, uo: 0.6, ugrMax: 25 },
  { id: "meeting", label: "Meeting / conference (500 lx)", em: 500, uo: 0.6, ugrMax: 19 },
  { id: "retail", label: "Retail sales (300 lx)", em: 300, uo: 0.6, ugrMax: 22 },
];

export function getEn12464Template(id: string | undefined | null): En12464Template | null {
  if (!id) return null;
  return EN12464_TEMPLATES.find((t) => t.id === id && t.id !== "") ?? null;
}

export type En12464Check = {
  templateId: string;
  templateLabel: string;
  maintenanceFactor: number;
  maintainedEave: number;
  checks: {
    em: { pass: boolean | null; target: number; actual: number };
    uo: { pass: boolean | null; target: number; actual: number };
    ugr: { pass: boolean | null; target: number | null; actual: number | null };
  };
  overallPass: boolean | null;
};

export function evaluateEn12464(
  results: CalcResults,
  templateId: string | undefined | null,
  maintenanceFactor: number
): En12464Check | null {
  const template = getEn12464Template(templateId);
  if (!template) return null;
  const mf = clampMf(maintenanceFactor);
  const s = results.summary;
  const maintainedEave = s.eave * mf;
  const maintainedEmin = s.emin * mf;
  const uo = s.eave > 1e-6 ? maintainedEmin / maintainedEave : s.uo;

  const emPass = maintainedEave >= template.em - 1e-6;
  const uoPass = uo >= template.uo - 1e-6;
  const ugrPass =
    template.ugrMax == null
      ? null
      : s.ugr != null
        ? s.ugr <= template.ugrMax + 1e-6
        : null;

  const parts = [emPass, uoPass, ugrPass].filter((p) => p !== null) as boolean[];
  const overallPass = parts.length ? parts.every(Boolean) : null;

  return {
    templateId: template.id,
    templateLabel: template.label,
    maintenanceFactor: mf,
    maintainedEave,
    checks: {
      em: { pass: emPass, target: template.em, actual: maintainedEave },
      uo: { pass: uoPass, target: template.uo, actual: uo },
      ugr: {
        pass: ugrPass,
        target: template.ugrMax,
        actual: s.ugr,
      },
    },
    overallPass,
  };
}

export function defaultMaintenanceFactor(): number {
  return 0.8;
}

export function clampMf(value: number | undefined | null): number {
  if (value == null || !Number.isFinite(value)) return defaultMaintenanceFactor();
  return Math.min(1, Math.max(0.5, value));
}
