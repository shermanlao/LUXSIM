import { DEFAULT_AUTOSAVE_MS, parseAutosaveMs, type AutosaveMs } from "@/lib/account-settings";
import { prisma } from "@/lib/prisma";

export const SETTING_PUBLIC_REGISTRATION = "publicRegistration";
export const SETTING_DEFAULT_AUTOSAVE_MS = "defaultAutosaveMs";

export type SiteSettings = {
  publicRegistration: boolean;
  defaultAutosaveMs: AutosaveMs;
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  publicRegistration: true,
  defaultAutosaveMs: DEFAULT_AUTOSAVE_MS,
};

export function parsePublicRegistration(value: unknown): boolean | null {
  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0") return false;
  return null;
}

export function settingsFromRows(rows: { key: string; value: string }[]): SiteSettings {
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const reg = parsePublicRegistration(map.get(SETTING_PUBLIC_REGISTRATION));
  const auto = parseAutosaveMs(map.get(SETTING_DEFAULT_AUTOSAVE_MS));
  return {
    publicRegistration: reg ?? DEFAULT_SITE_SETTINGS.publicRegistration,
    defaultAutosaveMs: auto ?? DEFAULT_SITE_SETTINGS.defaultAutosaveMs,
  };
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const rows = await prisma.siteSetting.findMany();
  return settingsFromRows(rows);
}

export async function setSiteSettings(patch: Partial<SiteSettings>): Promise<SiteSettings> {
  if (patch.publicRegistration !== undefined) {
    const value = String(patch.publicRegistration);
    await prisma.siteSetting.upsert({
      where: { key: SETTING_PUBLIC_REGISTRATION },
      update: { value },
      create: { key: SETTING_PUBLIC_REGISTRATION, value },
    });
  }
  if (patch.defaultAutosaveMs !== undefined) {
    const value = String(patch.defaultAutosaveMs);
    await prisma.siteSetting.upsert({
      where: { key: SETTING_DEFAULT_AUTOSAVE_MS },
      update: { value },
      create: { key: SETTING_DEFAULT_AUTOSAVE_MS, value },
    });
  }
  return getSiteSettings();
}
