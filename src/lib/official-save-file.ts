/**
 * Save an exported file with the browser's "Save as" path dialog when available.
 * If the user cancels, nothing is written. If the picker is unavailable, fall back
 * to a regular download.
 */

export type OfficialSaveResult = "saved" | "cancelled" | "downloaded";

export type OfficialSaveType = {
  description: string;
  accept: Record<string, string[]>;
};

export const OFFICIAL_SAVE_TYPES = {
  pdf: { description: "PDF", accept: { "application/pdf": [".pdf"] } },
  lxm: { description: "LUXSIM project", accept: { "application/json": [".lxm"] } },
  zip: { description: "ZIP archive", accept: { "application/zip": [".zip"] } },
  ldt: { description: "EULUMDAT", accept: { "text/plain": [".ldt"] } },
} as const satisfies Record<string, OfficialSaveType>;

export type OfficialSavePicker = (options: {
  suggestedName?: string;
  types?: OfficialSaveType[];
  excludeAcceptAllOption?: boolean;
}) => Promise<{
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
}>;

export type OfficialSaveHost = {
  showSaveFilePicker?: OfficialSavePicker;
  download?: (blob: Blob, filename: string) => void;
};

export function officialDownloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.click();
  URL.revokeObjectURL(url);
}

export function canUseOfficialSavePicker(picker?: OfficialSavePicker | undefined): boolean {
  return typeof picker === "function";
}

function defaultPicker(): OfficialSavePicker | undefined {
  if (typeof window === "undefined") return undefined;
  const fn = (window as Window & { showSaveFilePicker?: OfficialSavePicker }).showSaveFilePicker;
  return typeof fn === "function" ? fn.bind(window) : undefined;
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String((error as { name?: string }).name) : "";
  return name === "AbortError";
}

/** Show a save-path dialog and write the blob, or fall back to a download. */
export async function officialSaveBlob(
  blob: Blob,
  options: {
    suggestedName: string;
    types: OfficialSaveType[];
    host?: OfficialSaveHost;
  }
): Promise<OfficialSaveResult> {
  const picker = options.host?.showSaveFilePicker ?? defaultPicker();
  const download = options.host?.download ?? officialDownloadBlob;
  if (canUseOfficialSavePicker(picker) && picker) {
    try {
      const handle = await picker({
        suggestedName: options.suggestedName,
        types: options.types,
        excludeAcceptAllOption: false,
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return "saved";
    } catch (error) {
      if (isAbortError(error)) return "cancelled";
      download(blob, options.suggestedName);
      return "downloaded";
    }
  }
  download(blob, options.suggestedName);
  return "downloaded";
}
