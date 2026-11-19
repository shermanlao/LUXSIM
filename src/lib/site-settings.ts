import { DEFAULT_AUTOSAVE_MS, parseAutosaveMs, type AutosaveMs } from "@/lib/account-settings";
import { prisma } from "@/lib/prisma";

export const SETTING_PUBLIC_REGISTRATION = "publicRegistration";
export const SETTING_DEFAULT_AUTOSAVE_MS = "defaultAutosaveMs";
export const SETTING_REPORT_WEBSITE = "reportWebsite";

export type SiteSettings = {
  publicRegistration: boolean;
  defaultAutosaveMs: AutosaveMs;
  /** Address printed in lighting-report PDF footers. Empty string omits the line. */
  reportWebsite: string;
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  publicRegistration: true,
  defaultAutosaveMs: DEFAULT_AUTOSAVE_MS,
  reportWebsite: "",
};

/** Public fields safe to expose to any signed-in designer (or a public GET). */
export type PublicSiteInfo = {
  reportWebsite: string;
};

const WEBSITE_MAX_LEN = 200;
const HOST_PORT_RE =
  /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*|\d{1,3}(?:\.\d{1,3}){3})(?::\d{1,5})?$/;

/**
 * Accept a reasonable http(s) URL or a bare host[:port].
 * Empty/whitespace is valid and means "omit from the PDF".
 * Returns null when the value is not a string or is an unsafe/invalid address.
 */
export function parseReportWebsite(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (raw === "") return "";
  if (raw.length > WEBSITE_MAX_LEN) return null;
  if (/[\s\u0000-\u001f\u007f]/.test(raw)) return null;
  const stripped = raw.replace(/\/+$/, "");
  if (stripped === "") return "";

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(stripped)) {
    if (!/^https?:\/\//i.test(stripped)) return null;
    try {
      const url = new URL(stripped);
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
      if (!url.hostname) return null;
      return stripped;
    } catch {
      return null;
    }
  }

  if (HOST_PORT_RE.test(stripped)) return stripped;
  return null;
}

/** AUTH_URL, then NEXTAUTH_URL, stripped; empty when unset or invalid. */
export function defaultReportWebsite(): string {
  const env = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "";
  return parseReportWebsite(env) ?? "";
}

export function settingsFromRows(rows: { key: string; value: string }[]): SiteSettings {
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const reg = parsePublicRegistration(map.get(SETTING_PUBLIC_REGISTRATION));
  const auto = parseAutosaveMs(map.get(SETTING_DEFAULT_AUTOSAVE_MS));
  let reportWebsite = defaultReportWebsite();
  if (map.has(SETTING_REPORT_WEBSITE)) {
    const parsed = parseReportWebsite(map.get(SETTING_REPORT_WEBSITE));
    if (parsed != null) reportWebsite = parsed;
  }
  return {
    publicRegistration: reg ?? DEFAULT_SITE_SETTINGS.publicRegistration,
    defaultAutosaveMs: auto ?? DEFAULT_SITE_SETTINGS.defaultAutosaveMs,
    reportWebsite,
  };
}

export function publicSiteInfo(settings: SiteSettings): PublicSiteInfo {
  return { reportWebsite: settings.reportWebsite };
}

export function parsePublicRegistration(value: unknown): boolean | null {
  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0") return false;
  return null;
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const rows = await prisma.siteSetting.findMany();
  return settingsFromRows(rows);
}

export async function getPublicSiteInfo(): Promise<PublicSiteInfo> {
  return publicSiteInfo(await getSiteSettings());
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
  if (patch.reportWebsite !== undefined) {
    const value = patch.reportWebsite;
    await prisma.siteSetting.upsert({
      where: { key: SETTING_REPORT_WEBSITE },
      update: { value },
      create: { key: SETTING_REPORT_WEBSITE, value },
    });
  }
  return getSiteSettings();
}
