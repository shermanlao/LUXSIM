/** Official workspace name rules for Org.name. */

export const WORKSPACE_NAME_MAX_LENGTH = 100;

export type ParsedWorkspaceName =
  | { ok: true; name: string }
  | { ok: false; error: string };

/**
 * Trim whitespace; reject a missing, empty, whitespace-only, or over-long name.
 * Does not invent a fallback name when the input is invalid.
 */
export function parseWorkspaceName(value: unknown): ParsedWorkspaceName {
  if (typeof value !== "string") {
    return { ok: false, error: "Workspace name is required" };
  }
  const name = value.trim();
  if (!name) {
    return { ok: false, error: "Workspace name cannot be empty" };
  }
  if (name.length > WORKSPACE_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `Workspace name cannot be longer than ${WORKSPACE_NAME_MAX_LENGTH} characters`,
    };
  }
  return { ok: true, name };
}
