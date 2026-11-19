const STORAGE_PREFIX = "luxsim-import-warnings:";

/** Remember official open/import warnings until the editor can show them. */
export function storeImportLuxsimWarnings(projectId: string, warnings: string[]): void {
  if (typeof sessionStorage === "undefined" || !projectId || !warnings.length) return;
  sessionStorage.setItem(`${STORAGE_PREFIX}${projectId}`, JSON.stringify(warnings));
}

export function takeImportLuxsimWarnings(projectId: string): string[] {
  if (typeof sessionStorage === "undefined" || !projectId) return [];
  const key = `${STORAGE_PREFIX}${projectId}`;
  const raw = sessionStorage.getItem(key);
  if (!raw) return [];
  sessionStorage.removeItem(key);
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  } catch {
    return [];
  }
}
