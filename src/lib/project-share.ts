/** View-only project links and QR targets. */

export const DEFAULT_SHARE_LINKS_ENABLED = true;
export const VIEW_SHARE_PATH = "/view";

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const encoded =
    typeof Buffer !== "undefined"
      ? Buffer.from(bytes).toString("base64")
      : btoa(bin);
  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** Unguessable URL token for a project share link. */
export function newShareToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export function parseShareLinksEnabled(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return null;
}

/** Public visitors can open the link only when both switches are on. */
export function publicShareAllowed(opts: {
  projectShareEnabled: boolean;
  ownerShareLinksEnabled: boolean[];
}): boolean {
  if (!opts.projectShareEnabled) return false;
  if (!opts.ownerShareLinksEnabled.length) return false;
  return opts.ownerShareLinksEnabled.some((on) => on);
}

export function formatShareOrigin(raw?: string | null): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/\/+$/, "");
}

export function projectShareUrl(origin: string, token: string): string {
  const base = formatShareOrigin(origin) ?? origin;
  return `${base}${VIEW_SHARE_PATH}/${token}`;
}
