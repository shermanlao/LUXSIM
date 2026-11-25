/**
 * Workspace-level settings JSON, stored in the existing SiteSetting key-value
 * table as `orgSettings:<orgId>`. This avoids a Prisma schema change while
 * keeping templates (and any later workspace settings) off the project file
 * and available to every project in the same workspace.
 *
 * Admin site settings still only read their known keys; these rows are ignored
 * there. The false-colour template API reads and writes one key at a time.
 */
import { prisma } from "@/lib/prisma";
import {
  parseFalseColorScaleTemplates,
  type FalseColorScaleTemplate,
} from "@/lib/false-color-scale-templates";

export function orgSettingsKey(orgId: string): string {
  return `orgSettings:${orgId}`;
}

export type OrgSettings = {
  falseColorScaleTemplates: FalseColorScaleTemplate[];
};

export const EMPTY_ORG_SETTINGS: OrgSettings = {
  falseColorScaleTemplates: [],
};

export function parseOrgSettings(raw: unknown): OrgSettings {
  const rec = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    falseColorScaleTemplates: parseFalseColorScaleTemplates(rec.falseColorScaleTemplates),
  };
}

export async function getOrgSettings(orgId: string): Promise<OrgSettings> {
  const row = await prisma.siteSetting.findUnique({
    where: { key: orgSettingsKey(orgId) },
    select: { value: true },
  });
  if (!row?.value) return { ...EMPTY_ORG_SETTINGS };
  try {
    return parseOrgSettings(JSON.parse(row.value));
  } catch {
    return { ...EMPTY_ORG_SETTINGS };
  }
}

export async function setOrgSettings(orgId: string, settings: OrgSettings): Promise<OrgSettings> {
  const parsed = parseOrgSettings(settings);
  const value = JSON.stringify(parsed);
  await prisma.siteSetting.upsert({
    where: { key: orgSettingsKey(orgId) },
    create: { key: orgSettingsKey(orgId), value },
    update: { value },
  });
  return parsed;
}

/** Drop the workspace settings row when an org is deleted. */
export async function deleteOrgSettings(orgId: string): Promise<void> {
  await prisma.siteSetting.deleteMany({
    where: { key: orgSettingsKey(orgId) },
  });
}
