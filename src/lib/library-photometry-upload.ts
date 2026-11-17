/** Helpers for library photometry import: IES/LDT filtering, name prompts, and batch upload. */

export type NamedFile = { name: string };

export type PendingPhotometryFile<T extends NamedFile = File> = {
  file: T;
  fileName: string;
  displayName: string;
};

export type PhotometryNamePrompt<T extends NamedFile = File> = {
  kind: "single" | "multi";
  items: PendingPhotometryFile<T>[];
};

export type PhotometryFileSelection<T extends NamedFile = File> = {
  accepted: T[];
  rejected: T[];
  prompt: PhotometryNamePrompt<T> | null;
  rejectedMessage: string | null;
};

export type PhotometryUploadResult = {
  fileName: string;
  ok: boolean;
  luminaireId?: string;
  error?: string;
};

export type PhotometryBatchOutcome = {
  results: PhotometryUploadResult[];
  lastSuccessId: string | null;
  errorMessage: string | null;
};

const PHOTOMETRY_EXT = /\.(ies|ldt)$/i;

export function isPhotometryFileName(name: string): boolean {
  return PHOTOMETRY_EXT.test(name.trim());
}

export function filterPhotometryFiles<T extends NamedFile>(
  files: Iterable<T> | ArrayLike<T>,
): { accepted: T[]; rejected: T[] } {
  const accepted: T[] = [];
  const rejected: T[] = [];
  for (const file of Array.from(files)) {
    if (isPhotometryFileName(file.name)) accepted.push(file);
    else rejected.push(file);
  }
  return { accepted, rejected };
}

export function rejectedPhotometryMessage(rejected: NamedFile[]): string | null {
  if (rejected.length === 0) return null;
  const names = rejected.map((file) => file.name).join(", ");
  if (rejected.length === 1) {
    return `${names} is not an IES or LDT file and was skipped.`;
  }
  return `These files are not IES or LDT and were skipped: ${names}`;
}

export function buildPendingPhotometryNames<T extends NamedFile>(
  files: T[],
): PendingPhotometryFile<T>[] {
  return files.map((file) => ({
    file,
    fileName: file.name,
    displayName: "",
  }));
}

export function photometryNamePromptShape<T extends NamedFile>(
  files: T[],
): PhotometryNamePrompt<T> | null {
  if (files.length === 0) return null;
  return {
    kind: files.length === 1 ? "single" : "multi",
    items: buildPendingPhotometryNames(files),
  };
}

export function selectPhotometryFiles<T extends NamedFile>(
  files: Iterable<T> | ArrayLike<T> | null | undefined,
): PhotometryFileSelection<T> {
  const list = files ? Array.from(files) : [];
  if (list.length === 0) {
    return { accepted: [], rejected: [], prompt: null, rejectedMessage: null };
  }
  const { accepted, rejected } = filterPhotometryFiles(list);
  return {
    accepted,
    rejected,
    prompt: photometryNamePromptShape(accepted),
    rejectedMessage: rejectedPhotometryMessage(rejected),
  };
}

export function formatPhotometryUploadErrors(results: PhotometryUploadResult[]): string | null {
  const failed = results.filter((result) => !result.ok);
  if (failed.length === 0) return null;
  return failed.map((result) => `${result.fileName}: ${result.error || "Upload failed"}`).join("\n");
}

export function combinePhotometryMessages(...parts: Array<string | null | undefined>): string | null {
  const text = parts.filter((part): part is string => Boolean(part && part.trim())).join("\n");
  return text || null;
}

/**
 * Upload each file with the existing single-file API shape (`file`, optional `name`).
 * Continues after a failure so earlier successes are kept and later files still run.
 */
export async function uploadPhotometryBatch(
  items: PendingPhotometryFile[],
  postFile: (
    file: File,
    name: string,
  ) => Promise<{ ok: boolean; error?: string; luminaireId?: string }>,
): Promise<PhotometryBatchOutcome> {
  const results: PhotometryUploadResult[] = [];
  let lastSuccessId: string | null = null;
  for (const item of items) {
    const posted = await postFile(item.file, item.displayName.trim());
    if (posted.ok) {
      if (posted.luminaireId) lastSuccessId = posted.luminaireId;
      results.push({
        fileName: item.fileName,
        ok: true,
        luminaireId: posted.luminaireId,
      });
    } else {
      results.push({
        fileName: item.fileName,
        ok: false,
        error: posted.error || "Upload failed",
      });
    }
  }
  return {
    results,
    lastSuccessId,
    errorMessage: formatPhotometryUploadErrors(results),
  };
}
