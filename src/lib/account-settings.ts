export const DEFAULT_AUTOSAVE_MS = 300_000;

export const AUTOSAVE_INTERVALS = [
  { label: "Off", ms: 0 },
  { label: "1 minute", ms: 60_000 },
  { label: "5 minutes", ms: 300_000 },
  { label: "15 minutes", ms: 900_000 },
] as const;

export type AutosaveMs = (typeof AUTOSAVE_INTERVALS)[number]["ms"];

const ALLOWED = new Set<number>(AUTOSAVE_INTERVALS.map((o) => o.ms));

/** Accept only the four account-settings intervals; otherwise null. */
export function parseAutosaveMs(value: unknown): AutosaveMs | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isInteger(n) || !ALLOWED.has(n)) return null;
  return n as AutosaveMs;
}

/** PATCH /api/account writes only the session user — never a client-supplied id. */
export function accountPatchForSessionUser(
  sessionUserId: string | undefined,
  body: unknown
):
  | { ok: true; where: { id: string }; data: { autosaveMs: AutosaveMs } }
  | { ok: false; status: 401 | 400; error: string } {
  if (!sessionUserId) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  const raw =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  const parsed = parseAutosaveMs(raw?.autosaveMs);
  if (parsed == null) {
    return { ok: false, status: 400, error: "Invalid autosave interval" };
  }
  return {
    ok: true,
    where: { id: sessionUserId },
    data: { autosaveMs: parsed },
  };
}
