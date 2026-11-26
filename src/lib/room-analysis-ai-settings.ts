import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const SETTING_ROOM_ANALYSIS_AI_ENABLED = "roomAnalysisAiEnabled";
export const SETTING_ROOM_ANALYSIS_AI_PROVIDER = "roomAnalysisAiProvider";
export const SETTING_ROOM_ANALYSIS_AI_MODEL = "roomAnalysisAiModel";
export const SETTING_ROOM_ANALYSIS_AI_KEY = "roomAnalysisAiKey";

export const ROOM_ANALYSIS_AI_PROVIDERS = ["xai", "openai"] as const;
export type RoomAnalysisAiProvider = (typeof ROOM_ANALYSIS_AI_PROVIDERS)[number];

export const DEFAULT_ROOM_ANALYSIS_AI_PROVIDER: RoomAnalysisAiProvider = "xai";
export const DEFAULT_ROOM_ANALYSIS_AI_MODELS: Record<RoomAnalysisAiProvider, string> = {
  xai: "grok-4.7",
  openai: "gpt-4o",
};

/** Retired xAI chat / vision ids that must not be sent to the live API. */
const RETIRED_XAI_CHAT_MODELS = new Set([
  "grok-2",
  "grok-2-1212",
  "grok-2-image-1212",
  "grok-2-latest",
  "grok-2-vision",
  "grok-2-vision-1212",
  "grok-2-vision-latest",
  "grok-beta",
  "grok-vision-beta",
]);

/** Map a stored or default model id to one the provider still accepts. */
export function canonicalRoomAnalysisAiModel(
  provider: RoomAnalysisAiProvider,
  model: string
): string {
  const raw = model.trim() || DEFAULT_ROOM_ANALYSIS_AI_MODELS[provider];
  if (provider === "xai" && RETIRED_XAI_CHAT_MODELS.has(raw.toLowerCase())) {
    return DEFAULT_ROOM_ANALYSIS_AI_MODELS.xai;
  }
  return raw;
}

export const DEFAULT_ROOM_ANALYSIS_AI_MODEL =
  DEFAULT_ROOM_ANALYSIS_AI_MODELS[DEFAULT_ROOM_ANALYSIS_AI_PROVIDER];

const KEY_PREFIX = "enc:v1:";
const MODEL_MAX_LEN = 80;
const API_KEY_MAX_LEN = 512;

export function parseRoomAnalysisAiEnabled(value: unknown): boolean | null {
  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0") return false;
  return null;
}

export function parseRoomAnalysisAiProvider(value: unknown): RoomAnalysisAiProvider | null {
  if (typeof value !== "string") return null;
  const raw = value.trim().toLowerCase();
  return ROOM_ANALYSIS_AI_PROVIDERS.includes(raw as RoomAnalysisAiProvider)
    ? (raw as RoomAnalysisAiProvider)
    : null;
}

export function parseRoomAnalysisAiModel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (raw === "") return "";
  if (raw.length > MODEL_MAX_LEN) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(raw)) return null;
  return raw;
}

export function parseRoomAnalysisAiKeyInput(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (raw === "") return "";
  if (raw.length > API_KEY_MAX_LEN) return null;
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null;
  return raw;
}

/** Mask a secret for admin UI. Never return the full key. */
export function maskRoomAnalysisAiKey(key: string): string {
  const raw = key.trim();
  if (!raw) return "";
  if (raw.length >= 8) return `••••${raw.slice(-4)}`;
  return "••••";
}

function secretKey(): Buffer | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.trim() === "") return null;
  return createHash("sha256").update(secret).digest();
}

/** Encrypt a key for SiteSetting storage. Returns null when AUTH_SECRET is missing. */
export function encryptRoomAnalysisAiKey(plain: string): string | null {
  const key = secretKey();
  if (!key) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${KEY_PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptRoomAnalysisAiKey(stored: string | null | undefined): string {
  if (typeof stored !== "string" || stored.trim() === "") return "";
  const raw = stored.trim();
  if (!raw.startsWith(KEY_PREFIX)) return raw;
  const key = secretKey();
  if (!key) return "";
  const parts = raw.slice(KEY_PREFIX.length).split(":");
  if (parts.length !== 3) return "";
  try {
    const iv = Buffer.from(parts[0]!, "base64");
    const tag = Buffer.from(parts[1]!, "base64");
    const data = Buffer.from(parts[2]!, "base64");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

export type ResolvedRoomAnalysisAiConfig = {
  enabled: boolean;
  configured: boolean;
  provider: RoomAnalysisAiProvider;
  model: string;
  apiKey: string;
  source: "admin" | "env" | "none";
};

function envKeyFor(provider: RoomAnalysisAiProvider): string {
  const raw =
    provider === "openai"
      ? process.env.OPENAI_API_KEY
      : process.env.XAI_API_KEY;
  return typeof raw === "string" ? raw.trim() : "";
}

function defaultBaseUrl(provider: RoomAnalysisAiProvider): string {
  return provider === "openai" ? "https://api.openai.com/v1" : "https://api.x.ai/v1";
}

export function roomAnalysisAiBaseUrl(provider: RoomAnalysisAiProvider): string {
  const override =
    provider === "openai" ? process.env.OPENAI_API_BASE : process.env.XAI_API_BASE;
  if (typeof override === "string" && override.trim()) {
    return override.trim().replace(/\/+$/, "");
  }
  return defaultBaseUrl(provider);
}

/**
 * Official config: admin setting first. Env vars are only a fallback when AI is
 * enabled and no admin key has been saved. Disabled AI never uses an env key.
 */
export function resolveRoomAnalysisAiConfig(input: {
  enabled: boolean;
  provider: RoomAnalysisAiProvider;
  model: string;
  storedKey: string;
}): ResolvedRoomAnalysisAiConfig {
  const provider = input.provider;
  const model = canonicalRoomAnalysisAiModel(provider, input.model);
  if (!input.enabled) {
    return {
      enabled: false,
      configured: false,
      provider,
      model,
      apiKey: "",
      source: "none",
    };
  }
  const adminKey = input.storedKey.trim();
  if (adminKey) {
    return {
      enabled: true,
      configured: true,
      provider,
      model,
      apiKey: adminKey,
      source: "admin",
    };
  }
  const envKey = envKeyFor(provider);
  if (envKey) {
    return {
      enabled: true,
      configured: true,
      provider,
      model,
      apiKey: envKey,
      source: "env",
    };
  }
  return {
    enabled: true,
    configured: false,
    provider,
    model,
    apiKey: "",
    source: "none",
  };
}
