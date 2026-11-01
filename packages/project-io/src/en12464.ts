import type { CalcResults } from "../../solver/src/types";
import {
  clampMf,
  defaultMaintenanceFactor,
  resolveMaintenanceFactor,
  type MfBreakdown,
} from "./maintenance-factor";

/** Assist-only EN 12464-1 style targets. Not certification. */
export interface En12464Template {
  id: string;
  label: string;
  /** Task / reference plane maintained average illuminance Ēm (lx) */
  em: number;
  /** Minimum uniformity Uo on task plane (Emin/Ēm) */
  uo: number;
  /** Maximum UGR on task area (null = skip) */
  ugrMax: number | null;
  /**
   * Surrounding area maintained Em as fraction of task Em (EN 12464-1 practice).
   * Evaluated only when `surroundingResults` supplied to evaluateEn12464.
   */
  surroundingEmRatio: number | null;
  /** Background area maintained Em (lx), when applicable */
  backgroundEm: number | null;
}

export const EN12464_TEMPLATES: En12464Template[] = [
  {
    id: "",
    label: "None (no target)",
    em: 0,
    uo: 0,
    ugrMax: null,
    surroundingEmRatio: null,
    backgroundEm: null,
  },
  {
    id: "office",
    label: "Office — general (500 lx)",
    em: 500,
    uo: 0.6,
    ugrMax: 19,
    surroundingEmRatio: 0.6,
    backgroundEm: null,
  },
  {
    id: "corridor",
    label: "Circulation / corridor (100 lx)",
    em: 100,
    uo: 0.4,
    ugrMax: 25,
    surroundingEmRatio: null,
    backgroundEm: 75,
  },
  {
    id: "classroom",
    label: "Education — classroom (300 lx)",
    em: 300,
    uo: 0.6,
    ugrMax: 19,
    surroundingEmRatio: 0.6,
    backgroundEm: null,
  },
  {
    id: "warehouse",
    label: "Storage / warehouse (200 lx)",
    em: 200,
    uo: 0.6,
    ugrMax: 25,
    surroundingEmRatio: 0.5,
    backgroundEm: null,
  },
  {
    id: "meeting",
    label: "Meeting / conference (500 lx)",
    em: 500,
    uo: 0.6,
    ugrMax: 19,
    surroundingEmRatio: 0.6,
    backgroundEm: null,
  },
  {
    id: "retail",
    label: "Retail sales (300 lx)",
    em: 300,
    uo: 0.6,
    ugrMax: 22,
    surroundingEmRatio: 0.6,
    backgroundEm: null,
  },
  {
    id: "lobby",
    label: "Lobby / reception (200 lx)",
    em: 200,
    uo: 0.4,
    ugrMax: 22,
    surroundingEmRatio: 0.5,
    backgroundEm: 100,
  },
  {
    id: "restroom",
    label: "Restroom (200 lx)",
    em: 200,
    uo: 0.4,
    ugrMax: 25,
    surroundingEmRatio: null,
    backgroundEm: null,
  },
];

export function getEn12464Template(id: string | undefined | null): En12464Template | null {
  if (!id) return null;
  return EN12464_TEMPLATES.find((t) => t.id === id && t.id !== "") ?? null;
}

export type En12464ZoneCheck = {
  pass: boolean | null;
  target: number | null;
  actual: number | null;
  note?: string;
};

export type En12464Check = {
  templateId: string;
  templateLabel: string;
  maintenanceFactor: number;
  mfBreakdown: MfBreakdown;
  maintainedEave: number;
  checks: {
    taskEm: En12464ZoneCheck;
    taskUo: En12464ZoneCheck;
    surroundingEm: En12464ZoneCheck;
    backgroundEm: En12464ZoneCheck;
    ugr: En12464ZoneCheck;
  };
  overallPass: boolean | null;
};

export type En12464EvaluateInput = {
  templateId: string | undefined | null;
  maintenanceFactor?: number | null;
  mfBreakdown?: Partial<MfBreakdown> | null;
  /** Primary task / reference plane results (required) */
  taskResults: CalcResults;
  /** Optional second grid (not computed by v2 editor today) */
  surroundingResults?: CalcResults | null;
  backgroundResults?: CalcResults | null;
};

export function evaluateEn12464(input: En12464EvaluateInput): En12464Check | null {
  const template = getEn12464Template(input.templateId);
  if (!template) return null;

  const { mf, breakdown } = resolveMaintenanceFactor({
    maintenanceFactor: input.maintenanceFactor,
    mfBreakdown: input.mfBreakdown,
  });

  const task = input.taskResults.summary;
  const maintainedTaskEave = task.eave * mf;
  const maintainedTaskEmin = task.emin * mf;
  const taskUo = task.eave > 1e-6 ? maintainedTaskEmin / maintainedTaskEave : task.uo;

  const taskEmPass = maintainedTaskEave >= template.em - 1e-6;
  const taskUoPass = taskUo >= template.uo - 1e-6;

  const ugrPass: En12464ZoneCheck =
    template.ugrMax == null
      ? { pass: null, target: null, actual: task.ugr, note: "No UGR limit for template" }
      : task.ugr != null
        ? {
            pass: task.ugr <= template.ugrMax + 1e-6,
            target: template.ugrMax,
            actual: task.ugr,
          }
        : { pass: null, target: template.ugrMax, actual: null, note: "UGR not calculated" };

  let surroundingEm: En12464ZoneCheck = {
    pass: null,
    target: null,
    actual: null,
    note: "Single workplane — no surrounding grid in LUXSIM v2",
  };
  if (template.surroundingEmRatio != null) {
    const target = template.em * template.surroundingEmRatio;
    if (input.surroundingResults) {
      const s = input.surroundingResults.summary;
      const actual = s.eave * mf;
      surroundingEm = {
        pass: actual >= target - 1e-6,
        target,
        actual,
      };
    } else {
      surroundingEm = {
        pass: null,
        target,
        actual: null,
        note: "Surrounding target defined; supply surroundingResults to evaluate",
      };
    }
  }

  let backgroundEm: En12464ZoneCheck = {
    pass: null,
    target: null,
    actual: null,
    note: "No background target for template",
  };
  if (template.backgroundEm != null) {
    if (input.backgroundResults) {
      const actual = input.backgroundResults.summary.eave * mf;
      backgroundEm = {
        pass: actual >= template.backgroundEm - 1e-6,
        target: template.backgroundEm,
        actual,
      };
    } else {
      backgroundEm = {
        pass: null,
        target: template.backgroundEm,
        actual: null,
        note: "Background target defined; supply backgroundResults to evaluate",
      };
    }
  }

  const parts = [
    taskEmPass,
    taskUoPass,
    ugrPass.pass,
    surroundingEm.pass,
    backgroundEm.pass,
  ].filter((p) => p !== null) as boolean[];
  const overallPass = parts.length ? parts.every(Boolean) : null;

  return {
    templateId: template.id,
    templateLabel: template.label,
    maintenanceFactor: mf,
    mfBreakdown: breakdown,
    maintainedEave: maintainedTaskEave,
    checks: {
      taskEm: { pass: taskEmPass, target: template.em, actual: maintainedTaskEave },
      taskUo: { pass: taskUoPass, target: template.uo, actual: taskUo },
      surroundingEm,
      backgroundEm,
      ugr: ugrPass,
    },
    overallPass,
  };
}

/** @deprecated use resolveMaintenanceFactor from maintenance-factor */
export { clampMf, defaultMaintenanceFactor, resolveMaintenanceFactor, type MfBreakdown };
