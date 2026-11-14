import { generateLibraryCone, type PhotometricFamily } from "@luxsim/photometry";

/** Current Generate LDT form field values, including the compact editor path. */
export type GenerateLdtFormValues = {
  family: PhotometricFamily;
  beamDegrees: number;
  name: string;
  catalogNumber: string;
  lumens: string;
  watts: string;
  cctK: string;
  cri: string;
  size: string;
};

export type GenerateLdtDownloadReady = {
  canDownload: true;
  filename: string;
  text: string;
};

export type GenerateLdtDownloadBlocked = {
  canDownload: false;
  filename: null;
  text: null;
};

export type GenerateLdtDownload = GenerateLdtDownloadReady | GenerateLdtDownloadBlocked;

const BLOCKED: GenerateLdtDownloadBlocked = {
  canDownload: false,
  filename: null,
  text: null,
};

export function optionalFormNumber(value: string): number | undefined {
  const t = value.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Decide whether the current form can download an LDT, and build that file.
 * Uses the same generateLibraryCone path as the live preview and save API.
 * Does not write to the library.
 */
export function buildGenerateLdtDownload(input: GenerateLdtFormValues): GenerateLdtDownload {
  const lumens = optionalFormNumber(input.lumens);
  if (lumens == null || lumens <= 0) return BLOCKED;
  try {
    const generated = generateLibraryCone({
      family: input.family,
      beamDegrees: input.beamDegrees,
      name: input.name.trim() || undefined,
      catalogNumber: input.catalogNumber.trim() || undefined,
      lumens,
      watts: optionalFormNumber(input.watts) ?? null,
      cctK: optionalFormNumber(input.cctK) ?? null,
      cri: optionalFormNumber(input.cri) ?? null,
      size: input.size.trim() || undefined,
    });
    return {
      canDownload: true,
      filename: generated.downloadName,
      text: generated.text,
    };
  } catch {
    return BLOCKED;
  }
}

export type TextFileDownloadHost = {
  createObjectURL: (obj: Blob) => string;
  revokeObjectURL: (url: string) => void;
  document: {
    createElement: Document["createElement"];
    body: { appendChild: ParentNode["appendChild"] };
  };
};

function defaultDownloadHost(): TextFileDownloadHost {
  return {
    createObjectURL: (obj) => URL.createObjectURL(obj),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
    document,
  };
}

/** Trigger a browser file download from generated text. Does not save to the library. */
export function triggerTextFileDownload(
  text: string,
  filename: string,
  host: TextFileDownloadHost = defaultDownloadHost(),
): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = host.createObjectURL(blob);
  try {
    const a = host.document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.style.display = "none";
    host.document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    host.revokeObjectURL(url);
  }
}
