/**
 * Project and workspace memory for the six-number false-colour / greyscale scale.
 *
 * Project memory lives in the project file as scene.ui.falseColorScale
 * (snapshot) and scene.ui.falseColorScaleTemplateId (optional). No Prisma
 * schema change. Older projects without these fields keep the official default.
 *
 * On reopen, if the remembered template id still exists in the workspace,
 * the template's current six numbers win (it may have been overwritten).
 * If the template was deleted, the snapshot is used and the dropdown has
 * no selection.
 *
 * Workspace last-used lives in SiteSetting orgSettings:<orgId> as
 * lastUsedFalseColorScale, and is applied only when creating a new project
 * in that workspace — never silently onto existing projects.
 */
import type { FalseColorScale, IsoluxPalette } from "@luxsim/project-io";
import {
  normalizeFalseColorMapping,
  parseStoredFalseColorScale,
  parseStoredFalseColorScaleTemplateId,
  storedFalseColorScale,
} from "@luxsim/project-io";

export type LastUsedFalseColorScale = {
  scale: ReturnType<typeof storedFalseColorScale>;
  templateId: string | null;
  palette: IsoluxPalette;
  updatedAt: string;
};

export function parseLastUsedFalseColorScale(raw: unknown): LastUsedFalseColorScale | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const scale = parseStoredFalseColorScale(rec.scale);
  if (!scale) return null;
  const palette: IsoluxPalette = rec.palette === "greyscale" ? "greyscale" : "falsecolor";
  const updatedAt =
    typeof rec.updatedAt === "string" && rec.updatedAt.trim() ? rec.updatedAt : new Date(0).toISOString();
  return {
    scale: storedFalseColorScale(scale),
    templateId: parseStoredFalseColorScaleTemplateId(rec.templateId),
    palette,
    updatedAt,
  };
}

export function lastUsedFromScale(
  scale: FalseColorScale,
  templateId: string | null,
  palette: IsoluxPalette,
  nowIso = new Date().toISOString()
): LastUsedFalseColorScale {
  return {
    scale: storedFalseColorScale(normalizeFalseColorMapping(scale)),
    templateId: parseStoredFalseColorScaleTemplateId(templateId),
    palette: palette === "greyscale" ? "greyscale" : "falsecolor",
    updatedAt: nowIso,
  };
}
