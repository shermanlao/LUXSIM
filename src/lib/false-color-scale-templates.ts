/**
 * Named false-colour / greyscale scale templates.
 * Stored at workspace level (same org as the open project) so they survive
 * reload and can be reused in other projects in that workspace.
 */
import type { FalseColorScale, IsoluxPalette } from "@luxsim/project-io";
import { normalizeFalseColorMapping } from "@luxsim/project-io";

export const FALSE_COLOR_TEMPLATE_NAME_MAX = 80;
export const FALSE_COLOR_TEMPLATES_MAX = 50;

export type FalseColorScaleTemplate = {
  id: string;
  name: string;
  minLux: number;
  maxLux: number;
  tMin: number;
  tMax: number;
  winMin: number;
  winMax: number;
  /** Display mode the bar was in when saved. Loading applies the six numbers only. */
  palette: IsoluxPalette;
  updatedAt: string;
};

export const FALSE_COLOR_TEMPLATE_COPY = {
  saveAs: "Save as template / 儲存範本",
  saveTitleEn: "Save as template",
  saveTitleZh: "儲存範本",
  nameLabel: "Name / 名稱",
  namePlaceholder: "Name / 名稱",
  emptyName: "Enter a template name. / 請輸入範本名稱。",
  overwriteHintEn: "If this name already exists, that template will be updated.",
  overwriteHintZh: "若名稱已存在，將更新該範本。",
  overwriteNowEn: "A template with this name already exists. Saving will replace it.",
  overwriteNowZh: "已有相同名稱的範本，儲存後將會取代它。",
  cancel: "Cancel / 取消",
  save: "Save / 儲存",
  templates: "Templates / 範本",
  selectPlaceholder: "Select / 選擇",
  delete: "Delete / 刪除",
  deleteTitleEn: "Delete template",
  deleteTitleZh: "刪除範本",
  confirmDelete: "Delete / 刪除",
  loadFailed: "Could not load scale templates. / 無法載入比例尺範本。",
  saveFailed: "Could not save the scale template. / 無法儲存比例尺範本。",
  deleteFailed: "Could not delete the scale template. / 無法刪除比例尺範本。",
  tooMany: "The workspace already has the maximum number of scale templates. / 此工作區的比例尺範本數量已達上限。",
} as const;

export function deleteTemplateBodyEn(name: string): string {
  return `Delete the template “${name}”? This does not change the current scale bar.`;
}

export function deleteTemplateBodyZh(name: string): string {
  return `刪除範本「${name}」？目前刻度條不會因此改變。`;
}

export function normalizeFalseColorTemplateName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  if (name.length === 0 || name.length > FALSE_COLOR_TEMPLATE_NAME_MAX) return null;
  return name;
}

export function templateScaleFromRecord(template: FalseColorScaleTemplate): FalseColorScale {
  return normalizeFalseColorMapping({
    minLux: template.minLux,
    maxLux: template.maxLux,
    tMin: template.tMin,
    tMax: template.tMax,
    winMin: template.winMin,
    winMax: template.winMax,
  });
}

function isPalette(value: unknown): value is IsoluxPalette {
  return value === "falsecolor" || value === "greyscale";
}

export function parseFalseColorScaleTemplate(raw: unknown): FalseColorScaleTemplate | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const id = typeof rec.id === "string" && rec.id.trim() ? rec.id.trim() : null;
  const name = normalizeFalseColorTemplateName(rec.name);
  if (!id || !name) return null;
  const scale = normalizeFalseColorMapping({
    minLux: rec.minLux,
    maxLux: rec.maxLux,
    tMin: rec.tMin,
    tMax: rec.tMax,
    winMin: rec.winMin,
    winMax: rec.winMax,
  } as FalseColorScale);
  const palette: IsoluxPalette = isPalette(rec.palette) ? rec.palette : "falsecolor";
  const updatedAt =
    typeof rec.updatedAt === "string" && rec.updatedAt.trim() ? rec.updatedAt : new Date(0).toISOString();
  return {
    id,
    name,
    minLux: scale.minLux,
    maxLux: scale.maxLux,
    tMin: scale.tMin ?? 0,
    tMax: scale.tMax ?? 1,
    winMin: scale.winMin ?? scale.minLux,
    winMax: scale.winMax ?? scale.maxLux,
    palette,
    updatedAt,
  };
}

export function parseFalseColorScaleTemplates(raw: unknown): FalseColorScaleTemplate[] {
  if (!Array.isArray(raw)) return [];
  const out: FalseColorScaleTemplate[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const parsed = parseFalseColorScaleTemplate(item);
    if (!parsed || seen.has(parsed.id)) continue;
    seen.add(parsed.id);
    out.push(parsed);
  }
  out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  return out.slice(0, FALSE_COLOR_TEMPLATES_MAX);
}

export function findFalseColorScaleTemplateByName(
  templates: readonly FalseColorScaleTemplate[],
  name: string
): FalseColorScaleTemplate | undefined {
  const key = name.trim().toLowerCase();
  return templates.find((template) => template.name.toLowerCase() === key);
}

export function newFalseColorScaleTemplateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `tpl_${crypto.randomUUID()}`;
  }
  return `tpl_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
}

export type SaveFalseColorScaleTemplateResult =
  | { ok: true; templates: FalseColorScaleTemplate[]; template: FalseColorScaleTemplate; overwritten: boolean }
  | { ok: false; error: string; status: 400 };

export function saveFalseColorScaleTemplate(
  current: readonly FalseColorScaleTemplate[],
  nameRaw: unknown,
  scale: FalseColorScale,
  palette: IsoluxPalette,
  nowIso = new Date().toISOString()
): SaveFalseColorScaleTemplateResult {
  const name = normalizeFalseColorTemplateName(nameRaw);
  if (!name) {
    return { ok: false, error: FALSE_COLOR_TEMPLATE_COPY.emptyName, status: 400 };
  }
  const mapping = normalizeFalseColorMapping(scale);
  const existing = findFalseColorScaleTemplateByName(current, name);
  if (!existing && current.length >= FALSE_COLOR_TEMPLATES_MAX) {
    return { ok: false, error: FALSE_COLOR_TEMPLATE_COPY.tooMany, status: 400 };
  }
  const template: FalseColorScaleTemplate = {
    id: existing?.id ?? newFalseColorScaleTemplateId(),
    name,
    minLux: mapping.minLux,
    maxLux: mapping.maxLux,
    tMin: mapping.tMin ?? 0,
    tMax: mapping.tMax ?? 1,
    winMin: mapping.winMin ?? mapping.minLux,
    winMax: mapping.winMax ?? mapping.maxLux,
    palette: isPalette(palette) ? palette : "falsecolor",
    updatedAt: nowIso,
  };
  const templates = existing
    ? current.map((item) => (item.id === existing.id ? template : item))
    : [...current, template];
  return {
    ok: true,
    templates: parseFalseColorScaleTemplates(templates),
    template,
    overwritten: Boolean(existing),
  };
}

export function deleteFalseColorScaleTemplate(
  current: readonly FalseColorScaleTemplate[],
  templateId: string
): { ok: true; templates: FalseColorScaleTemplate[] } | { ok: false; status: 404 } {
  if (!current.some((item) => item.id === templateId)) {
    return { ok: false, status: 404 };
  }
  return {
    ok: true,
    templates: parseFalseColorScaleTemplates(current.filter((item) => item.id !== templateId)),
  };
}
