import { DEFAULT_AUTOSAVE_MS, parseAutosaveMs, type AutosaveMs } from "@/lib/account-settings";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_ROOM_ANALYSIS_AI_MODEL,
  DEFAULT_ROOM_ANALYSIS_AI_PROVIDER,
  SETTING_ROOM_ANALYSIS_AI_ENABLED,
  SETTING_ROOM_ANALYSIS_AI_KEY,
  SETTING_ROOM_ANALYSIS_AI_MODEL,
  SETTING_ROOM_ANALYSIS_AI_PROVIDER,
  decryptRoomAnalysisAiKey,
  encryptRoomAnalysisAiKey,
  maskRoomAnalysisAiKey,
  parseRoomAnalysisAiEnabled,
  parseRoomAnalysisAiModel,
  parseRoomAnalysisAiProvider,
  resolveRoomAnalysisAiConfig,
  type ResolvedRoomAnalysisAiConfig,
  type RoomAnalysisAiProvider,
} from "@/lib/room-analysis-ai-settings";

export const SETTING_PUBLIC_REGISTRATION = "publicRegistration";
export const SETTING_DEFAULT_AUTOSAVE_MS = "defaultAutosaveMs";
export const SETTING_REPORT_WEBSITE = "reportWebsite";

export type SiteSettings = {
  publicRegistration: boolean;
  defaultAutosaveMs: AutosaveMs;
  /** Address printed in lighting-report PDF footers. Empty string omits the line. */
  reportWebsite: string;
  /** Room-analysis AI is off until a site admin enables it. */
  roomAnalysisAiEnabled: boolean;
  roomAnalysisAiProvider: RoomAnalysisAiProvider;
  roomAnalysisAiModel: string;
  roomAnalysisAiKeyConfigured: boolean;
  /** Masked hint only (e.g. ••••ab12). Never the full key. */
  roomAnalysisAiKeyMasked: string;
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  publicRegistration: true,
  defaultAutosaveMs: DEFAULT_AUTOSAVE_MS,
  reportWebsite: "",
  roomAnalysisAiEnabled: false,
  roomAnalysisAiProvider: DEFAULT_ROOM_ANALYSIS_AI_PROVIDER,
  roomAnalysisAiModel: DEFAULT_ROOM_ANALYSIS_AI_MODEL,
  roomAnalysisAiKeyConfigured: false,
  roomAnalysisAiKeyMasked: "",
};

export type SiteSettingsPatch = Partial<{
  publicRegistration: boolean;
  defaultAutosaveMs: AutosaveMs;
  reportWebsite: string;
  roomAnalysisAiEnabled: boolean;
  roomAnalysisAiProvider: RoomAnalysisAiProvider;
  roomAnalysisAiModel: string;
  /** New API key to store. Omit to leave the saved key unchanged. */
  roomAnalysisAiKey: string;
  clearRoomAnalysisAiKey: boolean;
}>;

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
  const enabled =
    parseRoomAnalysisAiEnabled(map.get(SETTING_ROOM_ANALYSIS_AI_ENABLED)) ??
    DEFAULT_SITE_SETTINGS.roomAnalysisAiEnabled;
  const provider =
    parseRoomAnalysisAiProvider(map.get(SETTING_ROOM_ANALYSIS_AI_PROVIDER)) ??
    DEFAULT_SITE_SETTINGS.roomAnalysisAiProvider;
  const storedModel = parseRoomAnalysisAiModel(map.get(SETTING_ROOM_ANALYSIS_AI_MODEL));
  const model =
    storedModel && storedModel.length > 0
      ? storedModel
      : DEFAULT_SITE_SETTINGS.roomAnalysisAiModel;
  const plainKey = decryptRoomAnalysisAiKey(map.get(SETTING_ROOM_ANALYSIS_AI_KEY));
  return {
    publicRegistration: reg ?? DEFAULT_SITE_SETTINGS.publicRegistration,
    defaultAutosaveMs: auto ?? DEFAULT_SITE_SETTINGS.defaultAutosaveMs,
    reportWebsite,
    roomAnalysisAiEnabled: enabled,
    roomAnalysisAiProvider: provider,
    roomAnalysisAiModel: model,
    roomAnalysisAiKeyConfigured: plainKey.length > 0,
    roomAnalysisAiKeyMasked: plainKey ? maskRoomAnalysisAiKey(plainKey) : "",
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

export async function setSiteSettings(patch: SiteSettingsPatch): Promise<SiteSettings> {
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
  if (patch.roomAnalysisAiEnabled !== undefined) {
    const value = String(patch.roomAnalysisAiEnabled);
    await prisma.siteSetting.upsert({
      where: { key: SETTING_ROOM_ANALYSIS_AI_ENABLED },
      update: { value },
      create: { key: SETTING_ROOM_ANALYSIS_AI_ENABLED, value },
    });
  }
  if (patch.roomAnalysisAiProvider !== undefined) {
    const value = patch.roomAnalysisAiProvider;
    await prisma.siteSetting.upsert({
      where: { key: SETTING_ROOM_ANALYSIS_AI_PROVIDER },
      update: { value },
      create: { key: SETTING_ROOM_ANALYSIS_AI_PROVIDER, value },
    });
  }
  if (patch.roomAnalysisAiModel !== undefined) {
    const value = patch.roomAnalysisAiModel;
    await prisma.siteSetting.upsert({
      where: { key: SETTING_ROOM_ANALYSIS_AI_MODEL },
      update: { value },
      create: { key: SETTING_ROOM_ANALYSIS_AI_MODEL, value },
    });
  }
  if (patch.clearRoomAnalysisAiKey) {
    await prisma.siteSetting.upsert({
      where: { key: SETTING_ROOM_ANALYSIS_AI_KEY },
      update: { value: "" },
      create: { key: SETTING_ROOM_ANALYSIS_AI_KEY, value: "" },
    });
  } else if (patch.roomAnalysisAiKey !== undefined && patch.roomAnalysisAiKey !== "") {
    const encrypted = encryptRoomAnalysisAiKey(patch.roomAnalysisAiKey);
    if (!encrypted) {
      throw new Error("AUTH_SECRET is required to save the room-analysis AI key");
    }
    await prisma.siteSetting.upsert({
      where: { key: SETTING_ROOM_ANALYSIS_AI_KEY },
      update: { value: encrypted },
      create: { key: SETTING_ROOM_ANALYSIS_AI_KEY, value: encrypted },
    });
  }
  return getSiteSettings();
}

/** Server-only. Includes the decrypted key for the analyse-rooms API. Never send this to a client. */
export async function getRoomAnalysisAiRuntimeConfig(): Promise<ResolvedRoomAnalysisAiConfig> {
  const rows = await prisma.siteSetting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const enabled =
    parseRoomAnalysisAiEnabled(map.get(SETTING_ROOM_ANALYSIS_AI_ENABLED)) ?? false;
  const provider =
    parseRoomAnalysisAiProvider(map.get(SETTING_ROOM_ANALYSIS_AI_PROVIDER)) ??
    DEFAULT_ROOM_ANALYSIS_AI_PROVIDER;
  const storedModel = parseRoomAnalysisAiModel(map.get(SETTING_ROOM_ANALYSIS_AI_MODEL));
  const model =
    storedModel && storedModel.length > 0
      ? storedModel
      : DEFAULT_ROOM_ANALYSIS_AI_MODEL;
  const storedKey = decryptRoomAnalysisAiKey(map.get(SETTING_ROOM_ANALYSIS_AI_KEY));
  return resolveRoomAnalysisAiConfig({
    enabled,
    provider,
    model,
    storedKey,
  });
}
